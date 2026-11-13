import dayjs from 'dayjs';
import { v7 } from 'uuid';
import { AppDataSource } from '../../config/database.config';
import { LoginLog } from '../../entity/log.entity';
import { ListLoginLogDto } from '../../dto/log.dto';
import { getLogger } from '../../utils/logger.util';

/** 登录日志列表条目 */
interface LoginLogListItem {
    log_id: string;
    username: string;
    user_id: string | null;
    result: number;
    fail_msg: string | null;
    ip: string;
    user_agent: string | null;
    create_time: string;
}

/** 登录日志列表响应 */
interface LoginLogListResult {
    result: number;
    msg: string;
    datas?: { total: number; items: LoginLogListItem[] };
}

/** 登录日志列表查询列 */
const LOGIN_LOG_LIST_SELECT = [
    'log.log_id AS log_id',
    'log.username AS username',
    'log.user_id AS user_id',
    'log.result AS result',
    'log.fail_msg AS fail_msg',
    'log.ip AS ip',
    'log.user_agent AS user_agent',
    "to_char(log.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
];

/** 登录日志写入参数 */
export interface RecordLoginLogParams {
    /** 尝试登录的用户名 */
    username: string;
    /** 登录用户ID(用户名不存在时为空) */
    user_id: string | null;
    /** 登录结果:1-成功,2-失败 */
    result: number;
    /** 失败原因(成功时为空) */
    fail_msg: string | null;
    /** 登录IP */
    ip: string;
    /** 浏览器User-Agent */
    user_agent: string | null;
}

export class LogService {
    private loginLogRepository = AppDataSource.getRepository(LoginLog);
    private logger = getLogger('LOG_SERV');

    /**
     * 写入登录日志(登录成功与失败均记录)
     * - 日志写入失败只打印错误,不向调用方抛异常,避免影响登录主流程
     *
     * @param params 登录日志内容
     */
    async recordLogin(params: RecordLoginLogParams): Promise<void> {
        try {
            const log = new LoginLog();
            log.log_id = v7().replace(/-/g, '');
            log.username = params.username;
            log.user_id = params.user_id;
            log.result = params.result;
            log.fail_msg = params.fail_msg;
            log.ip = params.ip;
            log.user_agent = params.user_agent;
            log.create_time = new Date();
            await this.loginLogRepository.save(log);
        } catch (error) {
            this.logger.error('写入登录日志失败:', error);
        }
    }

    /**
     * 分页查询登录日志(GET /log/listLogin)
     * - 按登录时间降序
     * - 支持筛选:用户名/IP模糊匹配、登录结果、登录时间区间(含起止当天)
     *
     * @param dto 分页与筛选参数
     */
    async listLogin(dto: ListLoginLogDto): Promise<LoginLogListResult> {
        try {
            const queryBuilder = this.loginLogRepository
                .createQueryBuilder('log')
                .select(LOGIN_LOG_LIST_SELECT);

            if (dto.username) {
                queryBuilder.andWhere('log.username LIKE :username', {
                    username: `%${dto.username}%`,
                });
            }
            if (dto.result) {
                queryBuilder.andWhere('log.result = :result', { result: dto.result });
            }
            if (dto.ip) {
                queryBuilder.andWhere('log.ip LIKE :ip', { ip: `%${dto.ip}%` });
            }
            if (dto.start_time) {
                queryBuilder.andWhere('log.create_time >= :startTime', {
                    startTime: dto.start_time,
                });
            }
            if (dto.end_time) {
                // 结束日期含当天:与「止日期次日零点」比较
                queryBuilder.andWhere('log.create_time < :endTime', {
                    endTime: dayjs(dto.end_time).add(1, 'day').format('YYYY-MM-DD'),
                });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('log.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<LoginLogListItem>();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询登录日志列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}
