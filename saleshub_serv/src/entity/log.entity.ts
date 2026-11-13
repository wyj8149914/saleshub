import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * 登录日志实体
 *
 * 记录每次登录尝试(成功与失败),用于安全审计与异常登录排查
 * - 日志表只插入不更新,惯例字段仅保留 create_time(登录时间)
 */
@Entity({ schema: 'inventory', name: 'login_log' })
export class LoginLog {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    log_id: string;

    // ============ 登录信息 ============

    @Column({ type: 'varchar', length: 50, comment: '尝试登录的用户名' })
    username: string;

    @Column({
        type: 'varchar',
        length: 32,
        nullable: true,
        comment: '登录用户ID(用户名不存在时为空)',
    })
    user_id: string | null;

    @Column({ type: 'int', comment: '登录结果:1-成功,2-失败' })
    result: number;

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '失败原因(成功时为空)' })
    fail_msg: string | null;

    // ============ 客户端信息 ============

    @Column({ type: 'varchar', length: 50, comment: '登录IP' })
    ip: string;

    @Column({ type: 'varchar', length: 255, nullable: true, comment: '浏览器User-Agent' })
    user_agent: string | null;

    // ============ 惯例字段 ============

    @Column({ type: 'timestamp', comment: '登录时间' })
    create_time: Date;
}

/** 系统操作审计日志，业务侧仅追加写入 */
@Entity({ schema: 'inventory', name: 'operation_log' })
export class OperationLog {
    @PrimaryColumn({ type: 'varchar', length: 40, comment: '日志ID' })
    log_id: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '操作时间' })
    operation_time: Date;

    @Column({ type: 'varchar', length: 32, comment: '操作大类,PRODUCT/USER/ITEM/INVOICE/SYSTEM等' })
    operation_type: string;

    @Column({
        type: 'varchar',
        length: 64,
        comment: '操作代码，与业务枚举一致,如create_product,update_product,delete_product等',
    })
    operation_code: string;

    @Column({ type: 'varchar', length: 500, comment: '操作说明' })
    operation_desc: string;

    @Column({ type: 'varchar', length: 40, comment: '操作人user_id' })
    operator_id: string;

    @Column({ type: 'varchar', length: 100, nullable: true, comment: '操作人姓名快照' })
    operator_name: string | null;

    @Column({ type: 'varchar', array: true, nullable: true, comment: '操作时角色' })
    operator_role: string[] | null;

    @Column({ type: 'varchar', length: 64, nullable: true, comment: '操作对象类型' })
    target_type: string | null;

    @Column({ type: 'varchar', length: 40, nullable: true, comment: '操作对象ID' })
    target_id: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true, comment: '操作对象名称' })
    target_name: string | null;

    @Column({ type: 'text', nullable: true, comment: '变更前值' })
    old_value: string | null;

    @Column({ type: 'text', nullable: true, comment: '变更后值' })
    new_value: string | null;

    @Column({ type: 'jsonb', nullable: true, comment: '附加数据' })
    attach_data: Record<string, unknown> | null;

    @Column({ type: 'smallint', default: 0, comment: '1=成功，2=失败' })
    operation_result: number;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '失败信息' })
    error_msg: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true, comment: 'IP' })
    ip_address: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true, comment: 'HTTP方法' })
    request_method: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '请求路径' })
    request_path: string | null;

    @Column({ type: 'text', nullable: true, comment: 'User-Agent' })
    user_agent: string | null;
}
