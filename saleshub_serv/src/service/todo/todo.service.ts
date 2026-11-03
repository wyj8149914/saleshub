import dayjs from 'dayjs';
import { EntityManager, In } from 'typeorm';
import { v7 } from 'uuid';
import { AppDataSource } from '../../config/database.config';
import { Todo, TodoExecutor, TodoPostpone, TodoType } from '../../entity/todo.entity';
import {
    CompleteTodoDto,
    CreateTodoDto,
    ListTodoDto,
    PostponeTodoDto,
    TodoIdDto,
    UpdateTodoDto,
} from '../../dto/todo.dto';
import { getLogger } from '../../utils/logger.util';
import { BusinessError } from '../../utils/error.util';

/** 正常状态 */
const STATUS_NORMAL = 1;
/** 停用/删除状态(软删除) */
const STATUS_DELETED = 2;
/** 是否完成:1-否 */
const TODO_UNCOMPLETED = 1;
/** 是否完成:2-是 */
const TODO_COMPLETED = 2;

/** 列表/详情中的执行人信息 */
interface ExecutorItem {
    user_id: string;
}

/** 列表条目(含执行人、剩余天数、延期信息) */
interface TodoListItem {
    todo_id: string;
    title: string;
    type_id: string | null;
    type_name: string | null;
    priority: number;
    deadline: string;
    /** 剩余天数(截止日期-当前日期,负数表示已过期N天) */
    remaining_days: number;
    is_completed: number;
    completed_time: string | null;
    attachments: string[] | null;
    remark: string | null;
    user_id: string;
    executors: ExecutorItem[];
    /** 延期次数 */
    postpone_count: number;
    /** 累计延期天数(距最初截止日期) */
    total_delay_days: number;
    status: number;
    create_time: string;
}

/** 列表响应 */
interface TodoListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: TodoListItem[] };
}

/** 详情数据(在列表条目基础上增加延期记录列表) */
interface TodoDetailData extends Omit<TodoListItem, 'postpone_count' | 'total_delay_days'> {
    update_time: string;
    postpone_records: {
        postpone_id: string;
        old_deadline: string;
        new_deadline: string;
        delay_days: number;
        reason: string;
        operator_id: string;
        create_time: string;
    }[];
}

/** 详情响应 */
interface TodoDetailResult {
    result: number;
    msg: string;
    datas?: TodoDetailData;
}

/** 创建响应 */
interface TodoCreateResult {
    result: number;
    msg: string;
    datas?: { todo_id: string };
}

/** 操作类响应(修改/删除/完成/延期) */
interface TodoOpResult {
    result: number;
    msg: string;
}

/** 列表原始行(getRawMany 返回,attachments 为 JSONB 解析后的数组) */
type RawTodoRow = Omit<
    TodoListItem,
    'executors' | 'postpone_count' | 'total_delay_days' | 'remaining_days' | 'type_name'
>;

export class TodoService {
    private todoRepository = AppDataSource.getRepository(Todo);
    private executorRepository = AppDataSource.getRepository(TodoExecutor);
    private postponeRepository = AppDataSource.getRepository(TodoPostpone);
    private typeRepository = AppDataSource.getRepository(TodoType);
    private logger = getLogger('TODO_SERV');

    /**
     * 新建待办事项(POST /todo/create)
     * - 事务内插入主表与执行人关联表
     * - 初始 is_completed=1-未完成;剩余天数由截止日期查询时计算
     *
     * @param dto 新建参数
     */
    async create(dto: CreateTodoDto): Promise<TodoCreateResult> {
        try {
            const todoId = await AppDataSource.transaction(async (manager) => {
                // 1. 类型存在性校验(传入时)
                if (dto.type_id) {
                    const typeExists = await manager.findOne(TodoType, {
                        where: { type_id: dto.type_id, status: STATUS_NORMAL },
                    });
                    if (!typeExists) {
                        throw new BusinessError(9000, '待办类型不存在或已停用');
                    }
                }

                // 2. 插入主表
                const now = new Date();
                const todo = manager.create(Todo, {
                    todo_id: v7().replace(/-/g, ''),
                    title: dto.title,
                    type_id: dto.type_id ?? null,
                    priority: dto.priority,
                    deadline: new Date(dto.deadline),
                    is_completed: TODO_UNCOMPLETED,
                    completed_time: null,
                    attachments: dto.attachments ?? null,
                    remark: dto.remark ?? null,
                    user_id: dto.user_id,
                    status: STATUS_NORMAL,
                    create_time: now,
                    update_time: now,
                });
                await manager.save(todo);

                // 3. 批量插入执行人关联
                await this.saveExecutors(manager, todo.todo_id, dto.executor_ids);

                this.logger.info('待办事项新建完成:', { todo_id: todo.todo_id, title: todo.title });
                return todo.todo_id;
            });
            return { result: 0, msg: '创建成功', datas: { todo_id: todoId } };
        } catch (error) {
            this.logger.error('待办事项新建失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '新建失败' };
        }
    }

    /**
     * 修改待办事项(POST /todo/update)
     * - 仅正常状态待办可修改;创建人不可改
     * - 全部业务字段可选,仅更新传入字段
     * - 直接修改截止日期不产生延期记录,延期请走 /todo/postpone
     * - 传入 executor_ids 时整体替换执行人列表
     *
     * @param dto 修改参数(todo_id 必填,其余可选)
     */
    async update(dto: UpdateTodoDto): Promise<TodoOpResult> {
        try {
            const todo = await this.todoRepository.findOne({
                where: { todo_id: dto.todo_id, status: STATUS_NORMAL },
            });
            if (!todo) {
                return { result: 1, msg: '待办事项不存在或已删除' };
            }

            await AppDataSource.transaction(async (manager) => {
                // 1. 类型存在性校验(传入时)
                if (dto.type_id) {
                    const typeExists = await manager.findOne(TodoType, {
                        where: { type_id: dto.type_id, status: STATUS_NORMAL },
                    });
                    if (!typeExists) {
                        throw new BusinessError(9000, '待办类型不存在或已停用');
                    }
                }

                // 2. 更新主表(仅更新传入字段)
                if (dto.deadline) {
                    todo.deadline = new Date(dto.deadline);
                }
                if (dto.title) {
                    todo.title = dto.title;
                }
                if (dto.type_id) {
                    todo.type_id = dto.type_id;
                }
                if (dto.priority) {
                    todo.priority = dto.priority;
                }
                if (dto.attachments) {
                    todo.attachments = dto.attachments;
                }
                if (dto.remark) {
                    todo.remark = dto.remark;
                }
                todo.update_time = new Date();

                await manager.save(Todo, todo);

                // 3. 执行人列表传入时整体替换
                if (dto.executor_ids) {
                    await manager.delete(TodoExecutor, { todo_id: dto.todo_id });
                    await this.saveExecutors(manager, dto.todo_id, dto.executor_ids);
                }
            });

            this.logger.info('待办事项修改完成:', { todo_id: dto.todo_id });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('待办事项修改失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '修改失败' };
        }
    }

    /**
     * 分页查询待办事项列表(GET /todo/list)
     * - 只查正常状态(status=1)
     * - 支持筛选:执行人("我的待办")、类型、重要程度、完成状态、截止日期区间、关键字
     * - 执行人/延期信息/类型名批量联查后内存组装
     * - 剩余天数=截止日期-当前日期,负数表示已过期N天
     * - 按创建时间降序
     *
     * @param dto 分页与筛选参数
     */
    async list(dto: ListTodoDto): Promise<TodoListResult> {
        try {
            const queryBuilder = this.todoRepository
                .createQueryBuilder('todo')
                .select([
                    'todo.todo_id AS todo_id',
                    'todo.title AS title',
                    'todo.type_id AS type_id',
                    'todo.priority AS priority',
                    "to_char(todo.deadline, 'YYYY-MM-DD') AS deadline",
                    'todo.is_completed AS is_completed',
                    "to_char(todo.completed_time, 'YYYY-MM-DD HH24:MI:SS') AS completed_time",
                    'todo.attachments AS attachments',
                    'todo.remark AS remark',
                    'todo.user_id AS user_id',
                    'todo.status AS status',
                    "to_char(todo.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('todo.status = :status', { status: STATUS_NORMAL });

            if (dto.executor_id) {
                queryBuilder.andWhere(
                    `EXISTS (
                        SELECT 1 FROM inventory.todo_executor te
                        WHERE te.todo_id = todo.todo_id AND te.user_id = :executorId
                    )`,
                    { executorId: dto.executor_id }
                );
            }
            if (dto.type_id) {
                queryBuilder.andWhere('todo.type_id = :typeId', { typeId: dto.type_id });
            }
            if (dto.priority) {
                queryBuilder.andWhere('todo.priority = :priority', { priority: dto.priority });
            }
            if (dto.is_completed) {
                queryBuilder.andWhere('todo.is_completed = :isCompleted', {
                    isCompleted: dto.is_completed,
                });
            }
            if (dto.start_date) {
                queryBuilder.andWhere('todo.deadline >= :startDate', {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                // 结束日期含当天:与「止日期次日」比较
                queryBuilder.andWhere('todo.deadline < :endDate', {
                    endDate: dayjs(dto.end_date).add(1, 'day').format('YYYY-MM-DD'),
                });
            }
            if (dto.keyword) {
                queryBuilder.andWhere('todo.title LIKE :keyword', {
                    keyword: `%${dto.keyword}%`,
                });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();

            if (dto.sort === 1) {
                queryBuilder.orderBy('todo.create_time', 'DESC');
            } else if (dto.sort === 2) {
                queryBuilder.orderBy('todo.deadline', 'ASC');
            } else if (dto.sort === 3) {
                queryBuilder.orderBy('todo.priority', 'ASC');
            }

            const rows = await queryBuilder
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<RawTodoRow>();

            // 批量组装关联数据(执行人、类型名、延期汇总)
            const todoIds = rows.map((row) => row.todo_id);
            const [executorMap, postponeMap, typeMap] = await Promise.all([
                this.loadExecutors(todoIds),
                this.loadPostponeSummary(todoIds),
                this.loadTypeNames(rows.map((row) => row.type_id)),
            ]);

            const today = dayjs().format('YYYY-MM-DD');
            const items: TodoListItem[] = rows.map((row) => {
                const postpone = postponeMap.get(row.todo_id) ?? { count: 0, totalDelay: 0 };
                return {
                    ...row,
                    type_name: row.type_id ? (typeMap.get(row.type_id) ?? null) : null,
                    executors: executorMap.get(row.todo_id) ?? [],
                    postpone_count: postpone.count,
                    total_delay_days: postpone.totalDelay,
                    remaining_days: dayjs(row.deadline).diff(dayjs(today), 'day'),
                };
            });

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询待办事项列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询待办事项详情(GET /todo/detail)
     * - 只查正常状态(status=1),不存在或已删除返回错误
     * - 返回全部业务字段、执行人列表、延期记录列表、剩余天数
     *
     * @param dto 待办ID
     */
    async detail(dto: TodoIdDto): Promise<TodoDetailResult> {
        try {
            const todo = await this.todoRepository.findOne({
                where: { todo_id: dto.todo_id, status: STATUS_NORMAL },
            });
            if (!todo) {
                return { result: 1, msg: '待办事项不存在或已删除' };
            }

            // 并行查询执行人、延期记录、类型名
            const [executors, postponeRecords, typeName] = await Promise.all([
                this.executorRepository.find({
                    where: { todo_id: dto.todo_id },
                    order: { create_time: 'ASC' },
                }),
                this.postponeRepository.find({
                    where: { todo_id: dto.todo_id },
                    order: { create_time: 'DESC' },
                }),
                todo.type_id ? this.loadTypeNames([todo.type_id]) : Promise.resolve(new Map()),
            ]);

            const datas: TodoDetailData = {
                todo_id: todo.todo_id,
                title: todo.title,
                type_id: todo.type_id,
                type_name: todo.type_id ? (typeName.get(todo.type_id) ?? null) : null,
                priority: todo.priority,
                deadline: dayjs(todo.deadline).format('YYYY-MM-DD'),
                remaining_days: dayjs(todo.deadline)
                    .startOf('day')
                    .diff(dayjs().startOf('day'), 'day'),
                is_completed: todo.is_completed,
                completed_time: todo.completed_time
                    ? dayjs(todo.completed_time).format('YYYY-MM-DD HH:mm:ss')
                    : null,
                attachments: todo.attachments,
                remark: todo.remark,
                user_id: todo.user_id,
                executors: executors.map((item) => ({ user_id: item.user_id })),
                postpone_records: postponeRecords.map((record) => ({
                    postpone_id: record.postpone_id,
                    old_deadline: dayjs(record.old_deadline).format('YYYY-MM-DD'),
                    new_deadline: dayjs(record.new_deadline).format('YYYY-MM-DD'),
                    delay_days: record.delay_days,
                    reason: record.reason,
                    operator_id: record.operator_id,
                    create_time: dayjs(record.create_time).format('YYYY-MM-DD HH:mm:ss'),
                })),
                status: todo.status,
                create_time: dayjs(todo.create_time).format('YYYY-MM-DD HH:mm:ss'),
                update_time: dayjs(todo.update_time).format('YYYY-MM-DD HH:mm:ss'),
            };
            return { result: 0, msg: 'success', datas };
        } catch (error) {
            this.logger.error('查询待办事项详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 删除待办事项(POST /todo/delete)
     * - 软删除:主表 status 置为2,不再出现在列表/详情中
     *
     * @param dto 待办ID
     */
    async delete(dto: TodoIdDto): Promise<TodoOpResult> {
        try {
            const todo = await this.todoRepository.findOne({
                where: { todo_id: dto.todo_id, status: STATUS_NORMAL },
            });
            if (!todo) {
                return { result: 1, msg: '待办事项不存在或已删除' };
            }

            await this.todoRepository.update(
                { todo_id: dto.todo_id },
                { status: STATUS_DELETED, update_time: new Date() }
            );
            this.logger.info('待办事项删除完成:', { todo_id: dto.todo_id });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('待办事项删除失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 待办完成状态变更(POST /todo/complete)
     * - 整条待办的总体状态,任意执行人或管理员操作
     * - 标记完成时写入完成时间,取消完成时清空完成时间
     * - 传入与当前相同的状态视为幂等操作,直接返回成功
     *
     * @param dto 待办ID与目标完成状态
     */
    async complete(dto: CompleteTodoDto): Promise<TodoOpResult> {
        try {
            const todo = await this.todoRepository.findOne({
                where: { todo_id: dto.todo_id, status: STATUS_NORMAL },
            });
            if (!todo) {
                return { result: 1, msg: '待办事项不存在或已删除' };
            }
            if (todo.is_completed === dto.is_completed) {
                return { result: 0, msg: 'success' };
            }

            await this.todoRepository.update(
                { todo_id: dto.todo_id },
                {
                    is_completed: dto.is_completed,
                    completed_time: dto.is_completed === TODO_COMPLETED ? new Date() : null,
                    update_time: new Date(),
                }
            );
            this.logger.info('待办事项完成状态变更:', {
                todo_id: dto.todo_id,
                is_completed: dto.is_completed,
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('待办事项完成状态变更失败:', error);
            return { result: 1, msg: '操作失败' };
        }
    }

    /**
     * 待办延期(POST /todo/postpone)
     * - 处理人和管理员可操作,需填写新截止日期与延期原因
     * - 新截止日期必须晚于当前截止日期
     * - 事务内更新 deadline 并插入延期记录(记录只增不改)
     *
     * @param dto 待办ID、新截止日期、延期原因、操作人
     */
    async postpone(dto: PostponeTodoDto): Promise<TodoOpResult> {
        try {
            await AppDataSource.transaction(async (manager) => {
                // 1. 校验待办存在(行级锁防并发延期)
                const todo = await manager.findOne(Todo, {
                    where: { todo_id: dto.todo_id, status: STATUS_NORMAL },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!todo) {
                    throw new BusinessError(9000, '待办事项不存在或已删除');
                }

                // 2. 新截止日期必须晚于当前截止日期
                const oldDeadline = dayjs(todo.deadline).format('YYYY-MM-DD');
                const delayDays = dayjs(dto.new_deadline).diff(dayjs(oldDeadline), 'day');
                if (delayDays <= 0) {
                    throw new BusinessError(9000, '延期后截止日期必须晚于当前截止日期');
                }

                // 3. 更新截止日期并插入延期记录
                await manager.update(
                    Todo,
                    { todo_id: dto.todo_id },
                    { deadline: new Date(`${dto.new_deadline}T00:00:00`), update_time: new Date() }
                );
                await manager.save(
                    manager.create(TodoPostpone, {
                        postpone_id: v7().replace(/-/g, ''),
                        todo_id: dto.todo_id,
                        old_deadline: new Date(`${oldDeadline}T00:00:00`),
                        new_deadline: new Date(`${dto.new_deadline}T00:00:00`),
                        delay_days: delayDays,
                        reason: dto.reason,
                        operator_id: dto.operator_id,
                        create_time: new Date(),
                    })
                );

                this.logger.info('待办事项延期完成:', {
                    todo_id: dto.todo_id,
                    old_deadline: oldDeadline,
                    new_deadline: dto.new_deadline,
                    delay_days: delayDays,
                });
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('待办事项延期失败:', error);
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '操作失败' };
        }
    }

    /**
     * 批量插入执行人关联(须在事务内调用)
     *
     * @param manager 事务管理器
     * @param todoId 待办ID
     * @param executorIds 执行人用户ID列表
     */
    private async saveExecutors(
        manager: EntityManager,
        todoId: string,
        executorIds: string[]
    ): Promise<void> {
        const now = new Date();
        const executors = executorIds.map((userId) =>
            manager.create(TodoExecutor, {
                relation_id: v7().replace(/-/g, ''),
                todo_id: todoId,
                user_id: userId,
                create_time: now,
                update_time: now,
            })
        );
        await manager.save(executors);
    }

    /**
     * 批量查询待办的执行人列表,按 todo_id 分组
     *
     * @param todoIds 待办ID列表
     * @returns todo_id → 执行人列表 映射
     */
    private async loadExecutors(todoIds: string[]): Promise<Map<string, ExecutorItem[]>> {
        const map = new Map<string, ExecutorItem[]>();
        if (todoIds.length === 0) {
            return map;
        }
        const executors = await this.executorRepository.find({
            where: { todo_id: In(todoIds) },
            order: { create_time: 'ASC' },
        });
        for (const item of executors) {
            const list = map.get(item.todo_id) ?? [];
            list.push({ user_id: item.user_id });
            map.set(item.todo_id, list);
        }
        return map;
    }

    /**
     * 批量汇总待办的延期信息(延期次数、累计延期天数)
     *
     * @param todoIds 待办ID列表
     * @returns todo_id → { count-延期次数, totalDelay-累计延期天数 } 映射
     */
    private async loadPostponeSummary(
        todoIds: string[]
    ): Promise<Map<string, { count: number; totalDelay: number }>> {
        const map = new Map<string, { count: number; totalDelay: number }>();
        if (todoIds.length === 0) {
            return map;
        }
        const rows = await this.postponeRepository
            .createQueryBuilder('postpone')
            .select([
                'postpone.todo_id AS todo_id',
                'COUNT(*) AS count',
                'COALESCE(SUM(postpone.delay_days), 0) AS total_delay',
            ])
            .where('postpone.todo_id IN (:...todoIds)', { todoIds })
            .groupBy('postpone.todo_id')
            .getRawMany<{ todo_id: string; count: string; total_delay: string }>();

        for (const row of rows) {
            map.set(row.todo_id, { count: Number(row.count), totalDelay: Number(row.total_delay) });
        }
        return map;
    }

    /**
     * 批量查询类型名称(自动去空)
     *
     * @param typeIds 类型ID列表(可含 null/undefined)
     * @returns type_id → type_name 映射
     */
    private async loadTypeNames(
        typeIds: (string | null | undefined)[]
    ): Promise<Map<string, string>> {
        const ids = [...new Set(typeIds.filter((id): id is string => !!id))];
        const map = new Map<string, string>();
        if (ids.length === 0) {
            return map;
        }
        const types = await this.typeRepository.find({ where: { type_id: In(ids) } });
        for (const type of types) {
            map.set(type.type_id, type.type_name);
        }
        return map;
    }
}
