-- ============================================
-- 支出费用单表 + 采购明细行表
-- 支出费用分为两类:
--   1-有发票采购:关联发票(1:1),记录采购来源渠道与零件/规格/价格明细,
--                入库时通过 stock_in_record.expense_id 关联本表(支持分批入库)
--   2-无发票支出:一般为线下付款,仅记金额/分类/收款方/付款方式
-- 创建日期: 2026-10-29
-- ============================================

CREATE TABLE IF NOT EXISTS inventory.expense (
    expense_id VARCHAR(32) NOT NULL,
    expense_no VARCHAR(50) NOT NULL,
    expense_type INT NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    invoice_id VARCHAR(32),
    channel INT,
    amount NUMERIC(12, 2) NOT NULL,
    expense_date TIMESTAMP NOT NULL,
    category INT,
    payee VARCHAR(100),
    payment_method INT,
    remark VARCHAR(500),
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_expense PRIMARY KEY (expense_id),
    CONSTRAINT uk_expense_no UNIQUE (expense_no),
    -- 一张发票只能被一个费用单关联(1:1);invoice_id 为 NULL 时唯一约束不生效,无发票支出不受影响
    CONSTRAINT uk_expense_invoice UNIQUE (invoice_id),
    CONSTRAINT chk_expense_type CHECK (expense_type IN (1, 2)),
    CONSTRAINT chk_expense_channel CHECK (channel IN (1, 2, 3, 4, 5, 99)),
    CONSTRAINT chk_expense_category CHECK (category IN (1, 2, 3, 4, 5)),
    CONSTRAINT chk_expense_payment_method CHECK (payment_method IN (1, 2, 3, 4, 5)),
    CONSTRAINT chk_expense_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.expense IS '支出费用单表';

-- 字段注释
COMMENT ON COLUMN inventory.expense.expense_id IS '支出费用单主键ID';
COMMENT ON COLUMN inventory.expense.expense_no IS '费用单编号,格式ZC+6位递增数字(如ZC000001)';
COMMENT ON COLUMN inventory.expense.expense_type IS '费用类型:1-有发票采购,2-无发票支出';
COMMENT ON COLUMN inventory.expense.user_id IS '创建人用户ID';
COMMENT ON COLUMN inventory.expense.invoice_id IS '关联发票ID(invoice.invoice_id,类型1必填,1:1)';
COMMENT ON COLUMN inventory.expense.channel IS '采购来源渠道:1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他(类型1必填)';
COMMENT ON COLUMN inventory.expense.amount IS '支出金额';
COMMENT ON COLUMN inventory.expense.expense_date IS '支出日期';
COMMENT ON COLUMN inventory.expense.category IS '支出分类:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费';
COMMENT ON COLUMN inventory.expense.payee IS '收款方/对方名称(无发票线下付款场景常用)';
COMMENT ON COLUMN inventory.expense.payment_method IS '付款方式:1-现金,2-微信,3-支付宝,4-银行转账,5-其他';
COMMENT ON COLUMN inventory.expense.remark IS '备注';
COMMENT ON COLUMN inventory.expense.status IS '状态:1-正常,2-作废';
COMMENT ON COLUMN inventory.expense.create_time IS '创建时间';
COMMENT ON COLUMN inventory.expense.update_time IS '更新时间';

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_expense_user_id ON inventory.expense (user_id);
CREATE INDEX IF NOT EXISTS idx_expense_type ON inventory.expense (expense_type);
CREATE INDEX IF NOT EXISTS idx_expense_expense_date ON inventory.expense (expense_date);

-- ============================================
-- 采购明细行表(仅费用类型1-有发票采购使用)
-- 记录采购的零件/规格/数量/单价,行金额=quantity*price 由查询计算,不落库
-- ============================================

CREATE TABLE IF NOT EXISTS inventory.expense_item (
    relation_id VARCHAR(32) NOT NULL,
    expense_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    spec_id VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    remark VARCHAR(500),
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_expense_item PRIMARY KEY (relation_id),
    CONSTRAINT chk_expense_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_expense_item_price CHECK (price >= 0),
    CONSTRAINT chk_expense_item_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.expense_item IS '采购明细行表';

-- 字段注释
COMMENT ON COLUMN inventory.expense_item.relation_id IS '明细行主键ID';
COMMENT ON COLUMN inventory.expense_item.expense_id IS '所属支出费用单ID(expense.expense_id)';
COMMENT ON COLUMN inventory.expense_item.item_id IS '库存零件ID(inventory_item.item_id)';
COMMENT ON COLUMN inventory.expense_item.spec_id IS '库存规格ID(inventory_item_spec.spec_id)';
COMMENT ON COLUMN inventory.expense_item.quantity IS '采购数量';
COMMENT ON COLUMN inventory.expense_item.price IS '采购单价';
COMMENT ON COLUMN inventory.expense_item.remark IS '备注';
COMMENT ON COLUMN inventory.expense_item.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.expense_item.create_time IS '创建时间';
COMMENT ON COLUMN inventory.expense_item.update_time IS '更新时间';

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_expense_item_expense_id ON inventory.expense_item (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_item_spec ON inventory.expense_item (item_id, spec_id);

-- ============================================
-- 入库记录表增量:增加采购费用单关联
-- 入库仍走现有手动入库流程,入库时可选关联采购费用单;
-- 一次采购可分批到货,多条入库记录可关联同一费用单(N:1)
-- ============================================

ALTER TABLE inventory.stock_in_record ADD COLUMN IF NOT EXISTS expense_id VARCHAR(32);

COMMENT ON COLUMN inventory.stock_in_record.expense_id IS '关联采购支出费用单ID(expense.expense_id,可空)';

CREATE INDEX IF NOT EXISTS idx_stock_in_record_expense_id ON inventory.stock_in_record (expense_id);
