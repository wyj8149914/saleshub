-- ============================================
-- 销售订单表
-- 仅记整单信息(客户/联系方式/金额/交货日期),不拆产品明细行
-- 交货状态:1-待交货,2-已交货,3-已完成,4-已取消(取消即终态,不另设软删除字段)
-- 收款状态:由已收金额推导(0-未收,部分-部分收款,足额-已收款)
-- 创建日期: 2026-10-29
-- ============================================

CREATE TABLE IF NOT EXISTS inventory.sales_order (
    order_id VARCHAR(32) NOT NULL,
    order_no VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    received_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pay_status INT NOT NULL DEFAULT 1,
    delivery_date DATE NOT NULL,
    order_status INT NOT NULL DEFAULT 1,
    address VARCHAR(255),
    remark VARCHAR(500),
    user_id VARCHAR(32) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_sales_order PRIMARY KEY (order_id),
    CONSTRAINT uk_sales_order_no UNIQUE (order_no),
    CONSTRAINT chk_sales_order_amount CHECK (amount >= 0),
    CONSTRAINT chk_sales_order_received CHECK (received_amount >= 0),
    CONSTRAINT chk_sales_order_pay_status CHECK (pay_status IN (1, 2, 3)),
    CONSTRAINT chk_sales_order_order_status CHECK (order_status IN (1, 2, 3, 4))
);

COMMENT ON TABLE inventory.sales_order IS '销售订单表';

-- 字段注释
COMMENT ON COLUMN inventory.sales_order.order_id IS '销售订单主键ID';
COMMENT ON COLUMN inventory.sales_order.order_no IS '订单编号,格式XS+6位递增数字(如XS000001)';
COMMENT ON COLUMN inventory.sales_order.customer_name IS '客户名称';
COMMENT ON COLUMN inventory.sales_order.customer_phone IS '客户联系方式';
COMMENT ON COLUMN inventory.sales_order.amount IS '订单金额';
COMMENT ON COLUMN inventory.sales_order.received_amount IS '已收金额,默认0';
COMMENT ON COLUMN inventory.sales_order.pay_status IS '收款状态:1-未收款,2-部分收款,3-已收款(由已收金额推导落库)';
COMMENT ON COLUMN inventory.sales_order.delivery_date IS '交货日期';
COMMENT ON COLUMN inventory.sales_order.order_status IS '订单状态:1-待交货,2-已交货,3-已完成,4-已取消';
COMMENT ON COLUMN inventory.sales_order.address IS '收货地址(选填)';
COMMENT ON COLUMN inventory.sales_order.remark IS '备注';
COMMENT ON COLUMN inventory.sales_order.user_id IS '创建人用户ID';
COMMENT ON COLUMN inventory.sales_order.create_time IS '创建时间';
COMMENT ON COLUMN inventory.sales_order.update_time IS '更新时间';

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_sales_order_user_id ON inventory.sales_order (user_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_order_status ON inventory.sales_order (order_status);
CREATE INDEX IF NOT EXISTS idx_sales_order_pay_status ON inventory.sales_order (pay_status);
CREATE INDEX IF NOT EXISTS idx_sales_order_delivery_date ON inventory.sales_order (delivery_date);
