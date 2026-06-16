-- ============================================
-- 用户认证模块数据库初始化脚本
-- 版本: 1.0
-- 创建日期: 2026-06-16
-- 说明: 用户管理与登录功能基础表结构
-- ============================================

-- 创建 auth schema
CREATE SCHEMA IF NOT EXISTS auth;

COMMENT ON SCHEMA auth IS '用户认证与权限管理';

-- ============================================
-- 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.users (
    user_id VARCHAR(32) NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    status INT NOT NULL DEFAULT 1,
    last_login_time TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT chk_users_role CHECK (role IN ('admin', 'user')),
    CONSTRAINT chk_users_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE auth.users IS '系统用户表';

-- 用户表字段注释
COMMENT ON COLUMN auth.users.user_id IS '用户主键ID';
COMMENT ON COLUMN auth.users.username IS '登录用户名，唯一';
COMMENT ON COLUMN auth.users.password_hash IS '密码哈希(bcrypt)';
COMMENT ON COLUMN auth.users.name IS '姓名/昵称';
COMMENT ON COLUMN auth.users.phone IS '手机号';
COMMENT ON COLUMN auth.users.role IS '角色：admin-管理员，user-普通用户';
COMMENT ON COLUMN auth.users.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN auth.users.last_login_time IS '最后登录时间';
COMMENT ON COLUMN auth.users.create_time IS '创建时间';
COMMENT ON COLUMN auth.users.update_time IS '更新时间';

-- ============================================
-- 创建索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_status ON auth.users(status);
COMMENT ON INDEX auth.idx_users_status IS '用户状态索引，用于按状态筛选';

CREATE INDEX IF NOT EXISTS idx_users_role ON auth.users(role);
COMMENT ON INDEX auth.idx_users_role IS '用户角色索引，用于按角色筛选';

CREATE INDEX IF NOT EXISTS idx_users_phone ON auth.users(phone);
COMMENT ON INDEX auth.idx_users_phone IS '手机号索引，用于手机号查询';

-- ============================================
-- 初始化数据（可选）
-- ============================================

-- 示例：插入管理员账号（密码需通过应用 bcrypt 哈希后写入，仅用于开发环境）
-- INSERT INTO auth.users (user_id, username, password_hash, name, role, status)
-- VALUES
--     ('00000000000000000000000000000001', 'admin', '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '系统管理员', 'admin', 1);
