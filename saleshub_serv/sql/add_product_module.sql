-- ============================================================
-- Migration: 产品模块表创建
-- Date: 2026-07-06
-- Description: 创建 product_module 表支持产品模块化零件管理
-- ============================================================

-- 创建 product_module 表
CREATE TABLE IF NOT EXISTS inventory.product_module (
    module_id VARCHAR(32) PRIMARY KEY,
    product_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    sort_order INT DEFAULT 0,
    remark TEXT,
    status INT DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 添加外键约束 (幂等处理)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_module_product'
    ) THEN
        ALTER TABLE inventory.product_module
        ADD CONSTRAINT fk_product_module_product
        FOREIGN KEY (product_id) REFERENCES inventory.product(product_id);
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_product_module_product ON inventory.product_module(product_id);

-- 为 product_item 表新增 module_id 字段
ALTER TABLE inventory.product_item
ADD COLUMN IF NOT EXISTS module_id VARCHAR(32) NULL;

-- 添加外键约束 (幂等处理)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_item_module'
    ) THEN
        ALTER TABLE inventory.product_item
        ADD CONSTRAINT fk_product_item_module
        FOREIGN KEY (module_id) REFERENCES inventory.product_module(module_id);
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_product_item_module ON inventory.product_item(module_id);

-- 添加注释
COMMENT ON TABLE inventory.product_module IS '产品模块表';
COMMENT ON COLUMN inventory.product_module.module_id IS '模块ID';
COMMENT ON COLUMN inventory.product_module.product_id IS '产品ID';
COMMENT ON COLUMN inventory.product_module.name IS '模块名称';
COMMENT ON COLUMN inventory.product_module.code IS '模块编码';
COMMENT ON COLUMN inventory.product_module.sort_order IS '排序号';
COMMENT ON COLUMN inventory.product_module.remark IS '备注';
COMMENT ON COLUMN inventory.product_module.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.product_item.module_id IS '所属模块ID，NULL表示产品直接关联';
