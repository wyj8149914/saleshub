-- =====================================================================
-- 支出费用单入库状态迁移
-- 1. expense 表新增 stock_in_status 字段:1-未入库,2-已入库
--    费用单通过 /expense/stockIn 按采购明细整单入库,入库成功后回写为 2,
--    入库记录(stock_in_record.expense_id)关联本表
-- 2. stock_in_record.expense_id 列已在 migration-expense.sql 中添加,此处确认补齐
-- =====================================================================

ALTER TABLE inventory.expense ADD COLUMN IF NOT EXISTS stock_in_status INT NOT NULL DEFAULT 1;

-- 兼容早期按 0-未入库执行的版本:历史 0 值归一为 1-未入库
UPDATE inventory.expense SET stock_in_status = 1 WHERE stock_in_status = 0;

COMMENT ON COLUMN inventory.expense.stock_in_status IS '入库状态:1-未入库,2-已入库';

ALTER TABLE inventory.expense DROP CONSTRAINT IF EXISTS ck_expense_stock_in_status;
ALTER TABLE inventory.expense
    ADD CONSTRAINT ck_expense_stock_in_status CHECK (stock_in_status IN (1, 2));

-- 入库记录关联费用单列(migration-expense.sql 已添加,幂等补齐)
ALTER TABLE inventory.stock_in_record ADD COLUMN IF NOT EXISTS expense_id VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_stock_in_record_expense_id ON inventory.stock_in_record (expense_id);
