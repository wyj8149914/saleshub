import { v7 } from 'uuid';
import { AppDataSource } from '../../config/database.config';
import { TodoType } from '../../entity/todo.entity';
import { CreateTodoTypeDto, ListTodoTypeDto, TodoTypeIdDto } from '../../dto/todo.dto';
import { getLogger } from '../../utils/logger.util';
import { BusinessError } from '../../utils/error.util';
import { recordOperation } from '../log';

/** 正常状态 */
const STATUS_NORMAL = 1;
/** 停用状态(软删除) */
const STATUS_DELETED = 2;

/** 创建响应 */
interface TodoTypeCreateResult {
    result: number;
    msg: string;
    datas?: { type_id: string };
}

/** 类型条目 */
interface TodoTypeItem {
    type_id: string;
    type_name: string;
    user_id: string;
    status: number;
    create_time: string;
}

/** 列表响应 */
interface TodoTypeListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: TodoTypeItem[] };
}

/** 操作响应(删除) */
interface TodoTypeOpResult {
    result: number;
    msg: string;
}

export class TodoTypeService {
    private typeRepository = AppDataSource.getRepository(TodoType);
    private logger = getLogger('TODO_TYPE_SERV');

    /**
     * 新建待办类型(POST /todo/type/create)
     * - 类型名全局唯一,重名返回错误
     *
     * @param dto 创建参数
     */
    async create(dto: CreateTodoTypeDto): Promise<TodoTypeCreateResult> {
        try {
            const typeId = await AppDataSource.transaction(async (manager) => {
                // 类型名唯一性校验(并发重名由数据库唯一约束兜底)
                const exists = await manager.findOne(TodoType, {
                    where: { type_name: dto.type_name, status: STATUS_NORMAL },
                });
                if (exists) {
                    throw new BusinessError(9000, '类型名称已存在');
                }

                const now = new Date();
                const type = manager.create(TodoType, {
                    type_id: v7().replace(/-/g, ''),
                    type_name: dto.type_name,
                    user_id: dto.user_id,
                    status: STATUS_NORMAL,
                    create_time: now,
                    update_time: now,
                });
                await manager.save(type);
                this.logger.info('待办类型新建完成:', {
                    type_id: type.type_id,
                    type_name: type.type_name,
                });
                return type.type_id;
            });
            await recordOperation({
                operationType: 'TODO_TYPE',
                operationCode: 'create_todo_type',
                operationDesc: `新建待办类型「${dto.type_name}」`,
                operatorId: dto.user_id,
                targetType: 'todo_type',
                targetId: typeId,
                targetName: dto.type_name,
            });
            return { result: 0, msg: '创建成功', datas: { type_id: typeId } };
        } catch (error) {
            this.logger.error('待办类型新建失败:', error);
            await recordOperation({
                operationType: 'TODO_TYPE',
                operationCode: 'create_todo_type',
                operationDesc: '新建待办类型失败',
                operationResult: 2,
                errorMsg: (error as Error).message,
                operatorId: dto.user_id,
                targetName: dto.type_name,
            });
            if (error instanceof BusinessError) {
                return { result: 1, msg: error.message };
            }
            return { result: 1, msg: '新建失败' };
        }
    }

    /**
     * 查询待办类型列表(GET /todo/type/list)
     * - 只查正常状态(status=1)
     * - 支持按创建人、类型名关键字筛选
     * - 按创建时间降序,不分页(类型数量少)
     *
     * @param dto 筛选参数
     */
    async list(dto: ListTodoTypeDto): Promise<TodoTypeListResult> {
        try {
            const queryBuilder = this.typeRepository
                .createQueryBuilder('type')
                .select([
                    'type.type_id AS type_id',
                    'type.type_name AS type_name',
                    'type.user_id AS user_id',
                    'type.status AS status',
                    "to_char(type.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('type.status = :status', { status: STATUS_NORMAL });

            if (dto.keyword) {
                queryBuilder.andWhere('type.type_name LIKE :keyword', {
                    keyword: `%${dto.keyword}%`,
                });
            }

            const items = await queryBuilder
                .orderBy('type.create_time', 'DESC')
                .getRawMany<TodoTypeItem>();

            return { result: 0, msg: 'success', datas: { total: items.length, items } };
        } catch (error) {
            this.logger.error('查询待办类型列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 删除待办类型(POST /todo/type/delete)
     * - 软删除:type status 置为2,不再出现在列表中
     * - 已被待办引用时不影响既有待办的类型名展示(详情按 type_id 联查)
     *
     * @param dto 类型ID
     */
    async delete(dto: TodoTypeIdDto): Promise<TodoTypeOpResult> {
        try {
            const type = await this.typeRepository.findOne({
                where: { type_id: dto.type_id, status: STATUS_NORMAL },
            });
            if (!type) {
                return { result: 1, msg: '待办类型不存在或已删除' };
            }

            await this.typeRepository.update(
                { type_id: dto.type_id },
                { status: STATUS_DELETED, update_time: new Date() }
            );
            this.logger.info('待办类型删除完成:', { type_id: dto.type_id });

            await recordOperation({
                operationType: 'TODO_TYPE',
                operationCode: 'delete_todo_type',
                operationDesc: `删除待办类型「${type.type_name}」`,
                targetType: 'todo_type',
                targetId: type.type_id,
                targetName: type.type_name,
            });
            return { result: 0, msg: 'success' };
        } catch (error) {
            this.logger.error('待办类型删除失败:', error);
            await recordOperation({
                operationType: 'TODO_TYPE',
                operationCode: 'delete_todo_type',
                operationDesc: '删除待办类型失败',
                operationResult: 2,
                errorMsg: (error as Error).message,
                targetId: dto.type_id,
            });
            return { result: 1, msg: '删除失败' };
        }
    }
}
