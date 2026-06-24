-- ============================================
-- product_item BOM 规格字段迁移: spec(名称) → spec_id(规格ID)
-- 版本: 1.0
-- 创建日期: 2026-06-22
-- 依赖: migration-spec-based-stock.sql
-- 说明: 开发环境若已有 product_item 数据,建议先 TRUNCATE product_item 再执行
-- ============================================

ALTER TABLE inventory.product_item DROP CONSTRAINT IF EXISTS uk_product_item_product_item_spec;
ALTER TABLE inventory.product_item DROP COLUMN IF EXISTS spec;

ALTER TABLE inventory.product_item ADD COLUMN IF NOT EXISTS spec_id VARCHAR(32) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.product_item.spec_id IS 'BOM 指定的零件规格 inventory_item_spec.spec_id';

ALTER TABLE inventory.product_item DROP CONSTRAINT IF EXISTS uk_product_item_product_item_spec_id;
ALTER TABLE inventory.product_item ADD CONSTRAINT uk_product_item_product_item_spec_id
    UNIQUE (product_id, item_id, spec_id);

ALTER TABLE inventory.product_item DROP CONSTRAINT IF EXISTS fk_product_item_spec;
ALTER TABLE inventory.product_item ADD CONSTRAINT fk_product_item_spec
    FOREIGN KEY (spec_id) REFERENCES inventory.inventory_item_spec(spec_id);
