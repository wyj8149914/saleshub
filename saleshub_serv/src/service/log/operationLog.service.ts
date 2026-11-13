import { v7 } from 'uuid';
import { QueryOperationLogDetailDto, QueryOperationLogListDto } from '../../dto/log.dto';
import { OperationLog } from '../../entity/log.entity';
import { User } from '../../entity/user.entity';
import { LogData } from '../../interface/log.interface';
import { AppDataSource } from '../../config/database.config';
import { getRequestContext, getRequestMeta } from '../../context/requestContext';
import { getLogger } from '../../utils/logger.util';

const logger = getLogger('LOG_SERV');
const MAX_VALUE_LEN = 8000;

// 缓存操作人姓名与角色,避免每条日志都查一次用户表
const operatorCache = new Map<string, { name: string; role: string }>();

/**
 * 追加操作审计日志(在各业务操作点显式调用)
 * - 操作人优先取传入 operatorId,缺省取请求上下文中的登录用户,两者都没有则跳过记录
 * - 写入失败只记 error 不抛异常,避免「业务已成功但日志失败」导致接口误报失败
 *
 * @param data 操作日志内容
 */
export async function recordOperation(data: LogData): Promise<void> {
    try {
        const ctx = getRequestContext();
        const operatorId = data.operatorId ?? ctx?.userId;
        if (!operatorId) {
            logger.warn('记录操作日志失败: 缺少 operatorId', {
                operationCode: data.operationCode,
            });
            return;
        }

        const meta = getRequestMeta();
        const operator = await resolveOperator(operatorId);

        const log = new OperationLog();
        log.log_id = v7().replace(/-/g, '');
        log.operation_time = new Date();
        log.operation_type = data.operationType;
        log.operation_code = data.operationCode;
        log.operation_desc = data.operationDesc;
        log.operator_id = operatorId;
        log.operator_name = operator.name ?? null;
        log.operator_role = operator.role ? [operator.role] : null;
        log.target_type = data.targetType ?? null;
        log.target_id = data.targetId ?? null;
        log.target_name = data.targetName ?? null;
        log.old_value = truncateValue(data.oldValue);
        log.new_value = truncateValue(data.newValue);
        log.attach_data = data.attachData ?? null;
        log.operation_result = data.operationResult ?? 1;
        log.error_msg = data.errorMsg ?? null;
        log.ip_address = data.ipAddress ?? meta.ipAddress ?? null;
        log.request_method = data.requestMethod ?? meta.requestMethod ?? null;
        log.request_path = data.requestPath ?? meta.requestPath ?? null;
        log.user_agent = data.userAgent ?? meta.userAgent ?? null;

        await AppDataSource.getRepository(OperationLog).save(log);
    } catch (error) {
        logger.error('记录操作日志失败:', {
            message: (error as Error).message,
            operationCode: data.operationCode,
        });
    }
}

/** 截断过长值,避免撑爆日志表 */
function truncateValue(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    if (value.length <= MAX_VALUE_LEN) {
        return value;
    }
    return `${value.slice(0, MAX_VALUE_LEN)}...[truncated]`;
}

/** 根据用户ID获取操作人姓名与角色(带缓存) */
async function resolveOperator(userId: string): Promise<{ name: string; role: string }> {
    const cached = operatorCache.get(userId);
    if (cached) {
        return cached;
    }

    const user = await AppDataSource.getRepository(User).findOne({
        where: { user_id: userId },
        select: ['name', 'role'],
    });
    const operator = { name: user?.name ?? '未知', role: user?.role ?? '' };
    operatorCache.set(userId, operator);
    return operator;
}

/** 校验查询者是否为管理员,非管理员返回错误信息,管理员返回null */
async function checkAdmin(requesterId: string): Promise<string | null> {
    const user = await AppDataSource.getRepository(User).findOne({
        where: { user_id: requesterId },
        select: ['role'],
    });
    if (!user) {
        return '用户不存在';
    }
    if (user.role !== 'admin') {
        return '无权限访问操作日志';
    }
    return null;
}

export class OperationLogService {
    private logRepository = AppDataSource.getRepository(OperationLog);

    /**
     * 分页查询操作日志列表(GET /log/list)
     * - 仅管理员可查询
     * - 支持筛选:操作大类、操作代码、操作人姓名、对象名称、操作结果、
     *   关键字(操作说明/对象名称模糊)、操作时间区间(含起止当天)
     * - 按操作时间降序
     *
     * @param dto 分页与筛选参数(user_id 为请求者用户ID,用于权限校验)
     */
    async list(dto: QueryOperationLogListDto): Promise<OperationLogListResult> {
        try {
            const denyMsg = await checkAdmin(dto.user_id);
            if (denyMsg) {
                return { result: 1, msg: denyMsg };
            }

            const qb = this.logRepository
                .createQueryBuilder('log')
                .select([
                    'log.log_id AS log_id',
                    "to_char(log.operation_time, 'YYYY-MM-DD HH24:MI:SS') AS operation_time",
                    'log.operation_type AS operation_type',
                    'log.operation_code AS operation_code',
                    'log.operation_desc AS operation_desc',
                    'log.operator_id AS operator_id',
                    'log.operator_name AS operator_name',
                    'log.operator_role AS operator_role',
                    'log.target_type AS target_type',
                    'log.target_id AS target_id',
                    'log.target_name AS target_name',
                    'log.operation_result AS operation_result',
                    'log.error_msg AS error_msg',
                    'log.ip_address AS ip_address',
                    'log.request_method AS request_method',
                    'log.request_path AS request_path',
                ]);

            if (dto.operation_type) {
                qb.andWhere('log.operation_type = :operationType', {
                    operationType: dto.operation_type,
                });
            }
            if (dto.operation_code) {
                qb.andWhere('log.operation_code = :operationCode', {
                    operationCode: dto.operation_code,
                });
            }
            if (dto.operator_name) {
                qb.andWhere('log.operator_name = :operatorName', {
                    operatorName: dto.operator_name,
                });
            }
            if (dto.target_name) {
                qb.andWhere('log.target_name = :targetName', { targetName: dto.target_name });
            }
            if (dto.operation_result !== undefined) {
                qb.andWhere('log.operation_result = :operationResult', {
                    operationResult: dto.operation_result,
                });
            }
            if (dto.keyword) {
                qb.andWhere('(log.operation_desc ILIKE :keyword OR log.target_name ILIKE :keyword)', {
                    keyword: `%${dto.keyword}%`,
                });
            }
            if (dto.time_start) {
                qb.andWhere('log.operation_time >= :timeStart', { timeStart: dto.time_start });
            }
            if (dto.time_end) {
                // 结束日期含当天:与「止日期次日零点」比较
                qb.andWhere("log.operation_time < to_date(:timeEnd, 'YYYY-MM-DD') + interval '1 day'", {
                    timeEnd: dto.time_end,
                });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await qb.getCount();
            const items = await qb
                .orderBy('log.operation_time', 'DESC')
                .offset(start)
                .limit(dto.pageSize)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            logger.error('查询操作日志列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询操作日志详情(GET /log/detail)
     * - 仅管理员可查询,含变更前后值与附加数据等全部字段
     *
     * @param dto 日志ID(user_id 为请求者用户ID,用于权限校验)
     */
    async detail(dto: QueryOperationLogDetailDto): Promise<OperationLogDetailResult> {
        try {
            const denyMsg = await checkAdmin(dto.user_id);
            if (denyMsg) {
                return { result: 1, msg: denyMsg };
            }

            const row = await this.logRepository
                .createQueryBuilder('log')
                .select([
                    'log.log_id AS log_id',
                    "to_char(log.operation_time, 'YYYY-MM-DD HH24:MI:SS') AS operation_time",
                    'log.operation_type AS operation_type',
                    'log.operation_code AS operation_code',
                    'log.operation_desc AS operation_desc',
                    'log.operator_id AS operator_id',
                    'log.operator_name AS operator_name',
                    'log.operator_role AS operator_role',
                    'log.target_type AS target_type',
                    'log.target_id AS target_id',
                    'log.target_name AS target_name',
                    'log.old_value AS old_value',
                    'log.new_value AS new_value',
                    'log.attach_data AS attach_data',
                    'log.operation_result AS operation_result',
                    'log.error_msg AS error_msg',
                    'log.ip_address AS ip_address',
                    'log.request_method AS request_method',
                    'log.request_path AS request_path',
                    'log.user_agent AS user_agent',
                ])
                .where('log.log_id = :logId', { logId: dto.log_id })
                .getRawOne();

            if (!row) {
                return { result: 1, msg: '操作日志不存在' };
            }
            return { result: 0, msg: 'success', datas: row };
        } catch (error) {
            logger.error('查询操作日志详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}

/** 操作日志列表响应 */
interface OperationLogListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: Record<string, unknown>[] };
}

/** 操作日志详情响应 */
interface OperationLogDetailResult {
    result: number;
    msg: string;
    datas?: Record<string, unknown>;
}
