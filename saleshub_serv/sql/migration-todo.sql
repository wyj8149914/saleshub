-- ============================================
-- 待办事项模块建表语句
-- 包含:待办主表(todo)、待办类型表(todo_type)、
--       执行人关联表(todo_executor)、延期记录表(todo_postpone)
-- 约定:
--   剩余天数不落库,由 截止日期 - 当前日期 查询时计算
--   延期天数由延期记录表推导(距原截止日期)
--   是否完成是整条待办的总体状态,不按执行人拆分
--   附件以 JSONB 数组存 minio_file.relation_id 列表
-- 创建日期: 2026-11-03
-- ============================================

-- ============================================
-- 1. 待办类型表(类型由用户自行创建,创建成功后在待办中选择)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.todo_type (
    type_id VARCHAR(32) NOT NULL,
    type_name VARCHAR(50) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_todo_type PRIMARY KEY (type_id),
    CONSTRAINT uk_todo_type_name UNIQUE (type_name),
    CONSTRAINT chk_todo_type_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.todo_type IS '待办类型表';

COMMENT ON COLUMN inventory.todo_type.type_id IS '待办类型主键ID';
COMMENT ON COLUMN inventory.todo_type.type_name IS '类型名称,全局唯一';
COMMENT ON COLUMN inventory.todo_type.user_id IS '创建人用户ID';
COMMENT ON COLUMN inventory.todo_type.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.todo_type.create_time IS '创建时间';
COMMENT ON COLUMN inventory.todo_type.update_time IS '更新时间';

-- ============================================
-- 2. 待办事项主表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.todo (
    todo_id VARCHAR(32) NOT NULL,
    title VARCHAR(100) NOT NULL,
    type_id VARCHAR(32),
    priority INT NOT NULL DEFAULT 4,
    deadline DATE NOT NULL,
    is_completed INT NOT NULL DEFAULT 1,
    completed_time TIMESTAMP,
    attachments JSONB,
    remark VARCHAR(500),
    user_id VARCHAR(32) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_todo PRIMARY KEY (todo_id),
    CONSTRAINT chk_todo_priority CHECK (priority IN (1, 2, 3, 4)),
    CONSTRAINT chk_todo_is_completed CHECK (is_completed IN (1, 2)),
    CONSTRAINT chk_todo_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.todo IS '待办事项主表';

COMMENT ON COLUMN inventory.todo.todo_id IS '待办事项主键ID';
COMMENT ON COLUMN inventory.todo.title IS '待办事项名称';
COMMENT ON COLUMN inventory.todo.type_id IS '待办类型ID(inventory.todo_type.type_id)';
COMMENT ON COLUMN inventory.todo.priority IS '重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急';
COMMENT ON COLUMN inventory.todo.deadline IS '截止日期(延期时直接更新,剩余天数=截止日期-当前日期)';
COMMENT ON COLUMN inventory.todo.is_completed IS '是否完成:1-否,2-是(整条待办的总体状态,任意执行人或管理员标记后完成)';
COMMENT ON COLUMN inventory.todo.completed_time IS '完成时间(标记完成时写入,取消完成时清空)';
COMMENT ON COLUMN inventory.todo.attachments IS '附件relation_id列表(JSONB数组,每项为minio_file.relation_id)';
COMMENT ON COLUMN inventory.todo.remark IS '备注';
COMMENT ON COLUMN inventory.todo.user_id IS '创建人用户ID';
COMMENT ON COLUMN inventory.todo.status IS '状态:1-正常,2-删除';
COMMENT ON COLUMN inventory.todo.create_time IS '创建时间';
COMMENT ON COLUMN inventory.todo.update_time IS '更新时间';

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_todo_user_id ON inventory.todo (user_id);
CREATE INDEX IF NOT EXISTS idx_todo_type_id ON inventory.todo (type_id);
CREATE INDEX IF NOT EXISTS idx_todo_priority ON inventory.todo (priority);
CREATE INDEX IF NOT EXISTS idx_todo_is_completed ON inventory.todo (is_completed);
CREATE INDEX IF NOT EXISTS idx_todo_deadline ON inventory.todo (deadline);

-- ============================================
-- 3. 执行人关联表(执行人多选,一条待办对应多个执行人)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.todo_executor (
    relation_id VARCHAR(32) NOT NULL,
    todo_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_todo_executor PRIMARY KEY (relation_id),
    CONSTRAINT uk_todo_executor UNIQUE (todo_id, user_id)
);

COMMENT ON TABLE inventory.todo_executor IS '待办执行人关联表';

COMMENT ON COLUMN inventory.todo_executor.relation_id IS '关联记录主键ID';
COMMENT ON COLUMN inventory.todo_executor.todo_id IS '待办事项ID(inventory.todo.todo_id)';
COMMENT ON COLUMN inventory.todo_executor.user_id IS '执行人用户ID';
COMMENT ON COLUMN inventory.todo_executor.create_time IS '创建时间';
COMMENT ON COLUMN inventory.todo_executor.update_time IS '更新时间';

-- 常用查询索引:按待办查执行人 / 按执行人查"我的待办"
CREATE INDEX IF NOT EXISTS idx_todo_executor_todo_id ON inventory.todo_executor (todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_executor_user_id ON inventory.todo_executor (user_id);

-- ============================================
-- 4. 延期记录表(处理人和管理员可延期,需填写延期日期和原因)
--    延期时更新 todo.deadline,同时插入一条记录,记录只增不改
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.todo_postpone (
    postpone_id VARCHAR(32) NOT NULL,
    todo_id VARCHAR(32) NOT NULL,
    old_deadline DATE NOT NULL,
    new_deadline DATE NOT NULL,
    delay_days INT NOT NULL,
    reason VARCHAR(200) NOT NULL,
    operator_id VARCHAR(32) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_todo_postpone PRIMARY KEY (postpone_id),
    CONSTRAINT chk_todo_postpone_delay CHECK (delay_days > 0)
);

COMMENT ON TABLE inventory.todo_postpone IS '待办延期记录表';

COMMENT ON COLUMN inventory.todo_postpone.postpone_id IS '延期记录主键ID';
COMMENT ON COLUMN inventory.todo_postpone.todo_id IS '待办事项ID(inventory.todo.todo_id)';
COMMENT ON COLUMN inventory.todo_postpone.old_deadline IS '延期前截止日期';
COMMENT ON COLUMN inventory.todo_postpone.new_deadline IS '延期后截止日期';
COMMENT ON COLUMN inventory.todo_postpone.delay_days IS '本次延期天数(new_deadline - old_deadline)';
COMMENT ON COLUMN inventory.todo_postpone.reason IS '延期原因';
COMMENT ON COLUMN inventory.todo_postpone.operator_id IS '延期操作人用户ID(处理人或管理员)';
COMMENT ON COLUMN inventory.todo_postpone.create_time IS '延期操作时间';
