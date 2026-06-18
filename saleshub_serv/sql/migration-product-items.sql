-- ============================================
-- 产品-零件关联表迁移脚本
-- 版本: 1.1
-- 创建日期: 2026-06-16
-- 改动说明:
--   1. 新增 inventory.product_items 关联表(M:N)
--   2. 删除 inventory.inventory_items.product_id 列及相关外键/索引
-- 依赖: 先执行 create-inventory-schema.sql v1.0
-- ============================================

-- ============================================
-- 1. 创建关联表 product_items
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.product_items (
    product_item_id VARCHAR(32) NOT NULL,
    product_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    quantity_per_product INT NOT NULL DEFAULT 1,
    remark TEXT,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_product_items PRIMARY KEY (product_item_id),
    CONSTRAINT uk_product_items_product_item UNIQUE (product_id, item_id),
    CONSTRAINT chk_product_items_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_product_items_product FOREIGN KEY (product_id)
        REFERENCES inventory.products(product_id),
    CONSTRAINT fk_product_items_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_items(item_id)
);

COMMENT ON TABLE inventory.product_items IS '产品-零件关联表(BOM)';

-- product_items 表字段注释
COMMENT ON COLUMN inventory.product_items.product_item_id IS '关联主键ID';
COMMENT ON COLUMN inventory.product_items.product_id IS '产品ID';
COMMENT ON COLUMN inventory.product_items.item_id IS '零件ID';
COMMENT ON COLUMN inventory.product_items.quantity_per_product IS '单台产品所需数量';
COMMENT ON COLUMN inventory.product_items.remark IS '备注';
COMMENT ON COLUMN inventory.product_items.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.product_items.create_time IS '创建时间';
COMMENT ON COLUMN inventory.product_items.update_time IS '更新时间';

-- ============================================
-- 2. 删除 inventory_items.product_id 及相关对象
-- ============================================
ALTER TABLE inventory.inventory_items DROP CONSTRAINT IF EXISTS fk_inventory_items_product;
DROP INDEX IF EXISTS inventory.idx_inventory_items_product_id;
ALTER TABLE inventory.inventory_items DROP COLUMN IF EXISTS product_id;

-- ============================================
-- 3. 关联表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON inventory.product_items(product_id);
COMMENT ON INDEX inventory.idx_product_items_product_id IS '产品ID索引';
CREATE INDEX IF NOT EXISTS idx_product_items_item_id ON inventory.product_items(item_id);
COMMENT ON INDEX inventory.idx_product_items_item_id IS '零件ID索引';
CREATE INDEX IF NOT EXISTS idx_product_items_status ON inventory.product_items(status);
COMMENT ON INDEX inventory.idx_product_items_status IS '关联状态索引';
