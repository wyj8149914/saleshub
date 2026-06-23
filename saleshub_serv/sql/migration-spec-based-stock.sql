-- ============================================
-- 按规格区分库存 + 图片字段迁移脚本
-- 版本: 1.2
-- 创建日期: 2026-06-22
-- 改动说明:
--   1. 新增 inventory.inventory_item_spec 规格库存表
--   2. inventory.inventory_item 新增 image_id 列, 移除 current_stock/specs 列
--   3. inventory.product 新增 image_id 列
--   4. inventory.product_item 新增 spec 列, 唯一约束改为 (product_id, item_id, spec)
--   5. inventory.stock_in_record / stock_out_record / inventory_check 新增 spec 列
-- 开发环境清理: 需先清空 stock_in_record / stock_out_record / inventory_check / product_item / inventory_item 数据
-- 依赖: 先执行 create-inventory-schema.sql v1.0、migration-product-items.sql v1.1、migration-file-upload.sql v1.1
-- ============================================

-- ============================================
-- 1. 创建 inventory_item_spec 规格库存表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.inventory_item_spec (
    spec_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    spec VARCHAR(100) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory_item_spec PRIMARY KEY (spec_id),
    CONSTRAINT uk_inventory_item_spec_item_spec UNIQUE (item_id, spec),
    CONSTRAINT chk_inventory_item_spec_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_inventory_item_spec_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_item(item_id)
);

COMMENT ON TABLE inventory.inventory_item_spec IS '零件规格库存表(每个规格一条 SKU 记录,spec 空串为默认 SKU)';

COMMENT ON COLUMN inventory.inventory_item_spec.spec_id IS '规格库存主键ID';
COMMENT ON COLUMN inventory.inventory_item_spec.item_id IS '零件ID';
COMMENT ON COLUMN inventory.inventory_item_spec.spec IS '规格值,空串代表零件无规格时的默认 SKU';
COMMENT ON COLUMN inventory.inventory_item_spec.current_stock IS '当前规格库存数量';
COMMENT ON COLUMN inventory.inventory_item_spec.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.inventory_item_spec.create_time IS '创建时间';
COMMENT ON COLUMN inventory.inventory_item_spec.update_time IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_inventory_item_spec_item_id ON inventory.inventory_item_spec(item_id);
COMMENT ON INDEX inventory.idx_inventory_item_spec_item_id IS '零件ID索引';
CREATE INDEX IF NOT EXISTS idx_inventory_item_spec_status ON inventory.inventory_item_spec(status);
COMMENT ON INDEX inventory.idx_inventory_item_spec_status IS '规格库存状态索引';

-- ============================================
-- 2. 开发环境清空(避免外键/字段依赖冲突)
-- ============================================
TRUNCATE inventory.stock_in_record CASCADE;
TRUNCATE inventory.stock_out_record CASCADE;
TRUNCATE inventory.inventory_check CASCADE;
TRUNCATE inventory.product_item CASCADE;
TRUNCATE inventory.inventory_item CASCADE;
TRUNCATE inventory.product CASCADE;

-- ============================================
-- 3. inventory_item 表字段调整
-- ============================================
ALTER TABLE inventory.inventory_item ADD COLUMN IF NOT EXISTS image_id VARCHAR(32);
COMMENT ON COLUMN inventory.inventory_item.image_id IS '零件图片 file.relation_id';

ALTER TABLE inventory.inventory_item DROP COLUMN IF EXISTS current_stock;
ALTER TABLE inventory.inventory_item DROP COLUMN IF EXISTS specs;

-- ============================================
-- 4. product 表字段调整
-- ============================================
ALTER TABLE inventory.product ADD COLUMN IF NOT EXISTS image_id VARCHAR(32);
COMMENT ON COLUMN inventory.product.image_id IS '产品图片 file.relation_id';

-- ============================================
-- 5. product_item 表字段调整
-- ============================================
ALTER TABLE inventory.product_item ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.product_item.spec IS 'BOM 指定的零件规格,无规格零件传空串';

-- 替换唯一约束:(product_id, item_id) → (product_id, item_id, spec)
ALTER TABLE inventory.product_item DROP CONSTRAINT IF EXISTS uk_product_items_product_item;
ALTER TABLE inventory.product_item ADD CONSTRAINT uk_product_item_product_item_spec
    UNIQUE (product_id, item_id, spec);

-- ============================================
-- 6. stock_in_record / stock_out_record / inventory_check 新增 spec
-- ============================================
ALTER TABLE inventory.stock_in_record ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.stock_in_record.spec IS '入库规格,空串为默认 SKU';

ALTER TABLE inventory.stock_out_record ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.stock_out_record.spec IS '出库规格,空串为默认 SKU';

ALTER TABLE inventory.inventory_check ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.inventory_check.spec IS '盘点规格,空串为默认 SKU';

CREATE INDEX IF NOT EXISTS idx_stock_in_record_spec ON inventory.stock_in_record(spec);
CREATE INDEX IF NOT EXISTS idx_stock_out_record_spec ON inventory.stock_out_record(spec);
CREATE INDEX IF NOT EXISTS idx_inventory_check_spec ON inventory.inventory_check(spec);
