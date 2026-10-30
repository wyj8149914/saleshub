-- ============================================
-- 发票表新增报税字段
-- is_tax_filed: 1-未报税, 2-已报税(识别导入默认未报税)
-- 取消报税时清空报税时间与操作人
-- 创建日期: 2026-10-30
-- ============================================

ALTER TABLE inventory.invoice
    ADD COLUMN is_tax_filed INT NOT NULL DEFAULT 1,
    ADD COLUMN tax_filed_time TIMESTAMP,
    ADD COLUMN tax_filed_by VARCHAR(32);

-- 字段注释
COMMENT ON COLUMN inventory.invoice.is_tax_filed IS '是否报税:1-未报税,2-已报税';
COMMENT ON COLUMN inventory.invoice.tax_filed_time IS '报税时间(取消报税时清空)';
COMMENT ON COLUMN inventory.invoice.tax_filed_by IS '报税操作人用户ID(取消报税时清空)';

-- 报税状态约束
ALTER TABLE inventory.invoice
    ADD CONSTRAINT chk_invoice_tax_filed CHECK (is_tax_filed IN (1, 2));

-- 报税状态查询索引
CREATE INDEX IF NOT EXISTS idx_invoice_tax_filed ON inventory.invoice (is_tax_filed);
