import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * 待办类型实体
 *
 * 类型由用户自行创建,创建成功后在待办事项中选择;
 * 类型名全局唯一(uk_todo_type_name)
 */
@Entity({ schema: 'inventory', name: 'todo_type' })
export class TodoType {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    type_id: string;

    @Column({ type: 'varchar', length: 50, comment: '类型名称,全局唯一' })
    type_name: string;

    @Column({ type: 'varchar', length: 32, comment: '创建人用户ID' })
    user_id: string;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

/**
 * 待办事项主表实体
 *
 * - 剩余天数不落库,由 截止日期-当前日期 查询时计算
 * - 延期时直接更新 deadline,历史延期见 TodoPostpone 记录
 * - 是否完成是整条待办的总体状态,不按执行人拆分
 * - 附件以 JSONB 数组存 minio_file.relation_id 列表
 */
@Entity({ schema: 'inventory', name: 'todo' })
export class Todo {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    todo_id: string;

    // ============ 基本信息 ============

    @Column({ type: 'varchar', length: 100, comment: '待办事项名称' })
    title: string;

    @Column({
        type: 'varchar',
        length: 32,
        nullable: true,
        comment: '待办类型ID(inventory.todo_type.type_id)',
    })
    type_id: string | null;

    @Column({
        type: 'int',
        default: 4,
        comment: '重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急',
    })
    priority: number;

    @Column({ type: 'date', comment: '截止日期(延期时直接更新,剩余天数=截止日期-当前日期)' })
    deadline: Date;

    // ============ 完成状态 ============

    @Column({
        type: 'int',
        default: 1,
        comment: '是否完成:1-否,2-是(整条待办的总体状态,任意执行人或管理员标记后完成)',
    })
    is_completed: number;

    @Column({
        type: 'timestamp',
        nullable: true,
        comment: '完成时间(标记完成时写入,取消完成时清空)',
    })
    completed_time: Date | null;

    // ============ 附件与备注 ============

    @Column({
        type: 'jsonb',
        nullable: true,
        comment: '附件relation_id列表(JSONB数组,每项为minio_file.relation_id)',
    })
    attachments: string[] | null;

    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    remark: string | null;

    @Column({ type: 'varchar', length: 32, comment: '创建人用户ID' })
    user_id: string;

    // ============ 惯例字段 ============

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-删除' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

/**
 * 待办执行人关联实体
 *
 * 执行人多选,一条待办对应多个执行人;
 * UNIQUE(todo_id, user_id) 防止重复关联
 */
@Entity({ schema: 'inventory', name: 'todo_executor' })
export class TodoExecutor {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    relation_id: string;

    // ============ 关联信息 ============

    @Column({ type: 'varchar', length: 32, comment: '待办事项ID(inventory.todo.todo_id)' })
    todo_id: string;

    @Column({ type: 'varchar', length: 32, comment: '执行人用户ID' })
    user_id: string;

    // ============ 惯例字段 ============

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

/**
 * 待办延期记录实体
 *
 * 处理人和管理员可延期,需填写延期日期和原因;
 * 延期时更新 todo.deadline 的同时插入一条记录,记录只增不改;
 * 累计延期天数可由记录 delay_days 求和推导
 */
@Entity({ schema: 'inventory', name: 'todo_postpone' })
export class TodoPostpone {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    postpone_id: string;

    // ============ 关联信息 ============

    @Column({ type: 'varchar', length: 32, comment: '待办事项ID(inventory.todo.todo_id)' })
    todo_id: string;

    // ============ 延期信息 ============

    @Column({ type: 'date', comment: '延期前截止日期' })
    old_deadline: Date;

    @Column({ type: 'date', comment: '延期后截止日期' })
    new_deadline: Date;

    @Column({ type: 'int', comment: '本次延期天数(new_deadline - old_deadline)' })
    delay_days: number;

    @Column({ type: 'varchar', length: 200, comment: '延期原因' })
    reason: string;

    @Column({ type: 'varchar', length: 32, comment: '延期操作人用户ID(处理人或管理员)' })
    operator_id: string;

    // ============ 惯例字段 ============

    @Column({ type: 'timestamp', comment: '延期操作时间' })
    create_time: Date;
}
