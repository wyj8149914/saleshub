-- ============================================
-- 发票识别结果表
-- 存储腾讯云 OCR 混合发票识别(MixedInvoiceOCR)结果
-- 公共票面字段结构化存储,类型特有字段与原始结果以 JSONB 保存
-- 创建日期: 2026-10-25
-- ============================================

CREATE TABLE IF NOT EXISTS inventory.invoice (
    invoice_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    file_id VARCHAR(32) NOT NULL,
    biz_type VARCHAR(20),
    biz_id VARCHAR(32),
    ocr_request_id VARCHAR(64) NOT NULL,
    ocr_code VARCHAR(64) NOT NULL,
    invoice_type INT NOT NULL,
    sub_type VARCHAR(64) NOT NULL,
    sub_type_desc VARCHAR(100),
    page INT,
    title VARCHAR(100),
    invoice_code VARCHAR(20),
    invoice_number VARCHAR(32) NOT NULL,
    invoice_date VARCHAR(20),
    pretax_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    total_amount NUMERIC(12, 2),
    total_amount_cn VARCHAR(100),
    seller_name VARCHAR(200),
    seller_tax_id VARCHAR(32),
    buyer_name VARCHAR(200),
    buyer_tax_id VARCHAR(32),
    remark VARCHAR(500),
    issuer VARCHAR(50),
    invoice_nature INT,
    invoice_purpose INT,
    items JSONB,
    detail JSONB,
    raw_response JSONB,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_invoice PRIMARY KEY (invoice_id),
    CONSTRAINT uk_invoice_number UNIQUE (invoice_number),
    CONSTRAINT chk_invoice_nature CHECK (invoice_nature IN (1, 2)),
    CONSTRAINT chk_invoice_purpose CHECK (invoice_purpose IN (1, 2, 3, 4, 5)),
    CONSTRAINT chk_invoice_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.invoice IS '发票识别结果表';

-- 字段注释
COMMENT ON COLUMN inventory.invoice.invoice_id IS '发票记录主键ID';
COMMENT ON COLUMN inventory.invoice.user_id IS '识别用户ID';
COMMENT ON COLUMN inventory.invoice.file_id IS '原始文件ID(minio_file.relation_id)';
COMMENT ON COLUMN inventory.invoice.biz_type IS '业务单据类型(预留)';
COMMENT ON COLUMN inventory.invoice.biz_id IS '业务单据ID(预留)';
COMMENT ON COLUMN inventory.invoice.ocr_request_id IS '腾讯云OCR请求ID(RequestId)';
COMMENT ON COLUMN inventory.invoice.ocr_code IS '识别状态码:OK-成功,其它见腾讯云错误码';
COMMENT ON COLUMN inventory.invoice.invoice_type IS '发票类型:16-全电发票等,见腾讯云MixedInvoiceOCR文档';
COMMENT ON COLUMN inventory.invoice.sub_type IS '发票详细类型SubType,如VatElectronicInvoiceFull';
COMMENT ON COLUMN inventory.invoice.sub_type_desc IS '发票详细类型描述';
COMMENT ON COLUMN inventory.invoice.page IS '发票所在图片/PDF页码,从1开始';
COMMENT ON COLUMN inventory.invoice.title IS '发票名称';
COMMENT ON COLUMN inventory.invoice.invoice_code IS '发票代码(全电发票为空)';
COMMENT ON COLUMN inventory.invoice.invoice_number IS '发票号码';
COMMENT ON COLUMN inventory.invoice.invoice_date IS '开票日期(原始格式,如2026年09月09日)';
COMMENT ON COLUMN inventory.invoice.pretax_amount IS '税前金额';
COMMENT ON COLUMN inventory.invoice.tax_amount IS '合计税额';
COMMENT ON COLUMN inventory.invoice.total_amount IS '价税合计';
COMMENT ON COLUMN inventory.invoice.total_amount_cn IS '价税合计大写';
COMMENT ON COLUMN inventory.invoice.seller_name IS '销售方名称';
COMMENT ON COLUMN inventory.invoice.seller_tax_id IS '销售方纳税人识别号';
COMMENT ON COLUMN inventory.invoice.buyer_name IS '购买方名称';
COMMENT ON COLUMN inventory.invoice.buyer_tax_id IS '购买方纳税人识别号';
COMMENT ON COLUMN inventory.invoice.remark IS '备注';
COMMENT ON COLUMN inventory.invoice.issuer IS '开票人';
COMMENT ON COLUMN inventory.invoice.invoice_nature IS '发票性质:1-实开,2-进项抵扣';
COMMENT ON COLUMN inventory.invoice.invoice_purpose IS '发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费';
COMMENT ON COLUMN inventory.invoice.items IS '明细条目数组(VatElectronicItems/VatInvoiceItemInfos)';
COMMENT ON COLUMN inventory.invoice.detail IS '类型特有字段完整对象(SingleInvoiceInfos中对应类型的值,含铁路车次/机票航段等)';
COMMENT ON COLUMN inventory.invoice.raw_response IS '完整识别结果(MixedInvoiceItem,含坐标/印章信息)';
COMMENT ON COLUMN inventory.invoice.status IS '状态:1-正常,2-停用/作废';
COMMENT ON COLUMN inventory.invoice.create_time IS '创建时间';
COMMENT ON COLUMN inventory.invoice.update_time IS '更新时间';

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_invoice_user_id ON inventory.invoice (user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_file_id ON inventory.invoice (file_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sub_type ON inventory.invoice (sub_type);
CREATE INDEX IF NOT EXISTS idx_invoice_biz ON inventory.invoice (biz_type, biz_id);
