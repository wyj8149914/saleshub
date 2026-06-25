-- ============================================
-- 出入库记录表增加变更前后库存字段
-- 版本: 1.3
-- 创建日期: 2026-06-25
-- 说明: 入库/出库操作时记录规格库存变更前后的数量，便于库存历史追溯
-- ============================================

ALTER TABLE inventory.stock_in_record
    ADD COLUMN IF NOT EXISTS before_stock INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN inventory.stock_in_record.before_stock IS '入库前该规格库存数量';

ALTER TABLE inventory.stock_in_record
    ADD COLUMN IF NOT EXISTS after_stock INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN inventory.stock_in_record.after_stock IS '入库后该规格库存数量';

ALTER TABLE inventory.stock_out_record
    ADD COLUMN IF NOT EXISTS before_stock INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN inventory.stock_out_record.before_stock IS '出库前该规格库存数量';

ALTER TABLE inventory.stock_out_record
    ADD COLUMN IF NOT EXISTS after_stock INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN inventory.stock_out_record.after_stock IS '出库后该规格库存数量';
