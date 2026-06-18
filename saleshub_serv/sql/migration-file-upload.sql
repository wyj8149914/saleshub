-- ============================================
-- 文件上传功能迁移脚本
-- 版本: 1.1
-- 创建日期: 2026-06-18
-- 改动说明:
--   1. 新增 public.file 文件元数据表(SHA-256 hash 全局唯一去重)
--   2. 重命名 inventory.stock_in_record.photo_url → photo_id,类型由 varchar(500) 收窄为 varchar(32)
-- 依赖: 项目当前 schema(stock_in_record 表已存在 photo_url 列)
-- ============================================

-- ============================================
-- 1. 创建 file 表(public schema)
-- ============================================
CREATE TABLE IF NOT EXISTS public.file (
    relation_id VARCHAR(32) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    bucket VARCHAR(50) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_file PRIMARY KEY (relation_id),
    CONSTRAINT uk_file_hash UNIQUE (hash),
    CONSTRAINT chk_file_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE public.file IS '文件元数据表(MinIO 对象索引)';

COMMENT ON COLUMN public.file.relation_id IS '关系主键ID,业务表通过此列引用文件';
COMMENT ON COLUMN public.file.hash IS 'SHA-256 hex,全局唯一去重键';
COMMENT ON COLUMN public.file.object_name IS 'MinIO 对象键';
COMMENT ON COLUMN public.file.original_name IS '客户端上传时的原始文件名';
COMMENT ON COLUMN public.file.mime_type IS '文件 MIME 类型';
COMMENT ON COLUMN public.file.size IS '文件字节数';
COMMENT ON COLUMN public.file.bucket IS 'MinIO bucket 名';
COMMENT ON COLUMN public.file.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN public.file.create_time IS '创建时间';
COMMENT ON COLUMN public.file.update_time IS '更新时间';

-- ============================================
-- 2. file 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_file_status ON public.file(status);
COMMENT ON INDEX public.idx_file_status IS '文件状态索引';

-- ============================================
-- 3. stock_in_record 字段更名 + 类型收窄
-- ============================================
ALTER TABLE inventory.stock_in_record RENAME COLUMN photo_url TO photo_id;
ALTER TABLE inventory.stock_in_record ALTER COLUMN photo_id TYPE VARCHAR(32) USING photo_id::VARCHAR(32);
ALTER TABLE inventory.stock_in_record ALTER COLUMN photo_id DROP NOT NULL;
COMMENT ON COLUMN inventory.stock_in_record.photo_id IS '入库照片 file.relation_id';
