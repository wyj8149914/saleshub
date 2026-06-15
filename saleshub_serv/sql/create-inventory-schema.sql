-- ============================================
-- 库存管理系统数据库初始化脚本
-- 版本: 1.0
-- 创建日期: 2025-06-15
-- ============================================

-- 创建 inventory schema
CREATE SCHEMA IF NOT EXISTS inventory;

COMMENT ON SCHEMA inventory IS '库存管理系统数据库';

-- ============================================
-- 产品表 (products)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.products (
    product_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_products PRIMARY KEY (product_id),
    CONSTRAINT uk_products_code UNIQUE (code)
);

COMMENT ON TABLE inventory.products IS '产品信息表';

-- 产品表字段注释
COMMENT ON COLUMN inventory.products.product_id IS '产品主键ID';
COMMENT ON COLUMN inventory.products.name IS '产品名称';
COMMENT ON COLUMN inventory.products.code IS '产品编码，唯一标识';
COMMENT ON COLUMN inventory.products.description IS '产品描述';
COMMENT ON COLUMN inventory.products.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.products.created_at IS '创建时间';

-- ============================================
-- 库存件表 (inventory_items)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.inventory_items (
    item_id VARCHAR(32) NOT NULL,
    type VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    product_id VARCHAR(32),
    specs TEXT[],
    current_stock INT NOT NULL DEFAULT 0,
    warn_stock INT NOT NULL DEFAULT 10,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory_items PRIMARY KEY (item_id),
    CONSTRAINT chk_inventory_items_type CHECK (type IN ('device', 'common')),
    CONSTRAINT chk_inventory_items_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_inventory_items_product FOREIGN KEY (product_id)
        REFERENCES inventory.products(product_id) ON DELETE SET NULL
);

COMMENT ON TABLE inventory.inventory_items IS '库存件信息表';

-- 库存件表字段注释
COMMENT ON COLUMN inventory.inventory_items.item_id IS '库存件主键ID';
COMMENT ON COLUMN inventory.inventory_items.type IS '类型：device-设备件，common-常用件';
COMMENT ON COLUMN inventory.inventory_items.name IS '名称';
COMMENT ON COLUMN inventory.inventory_items.code IS '编码';
COMMENT ON COLUMN inventory.inventory_items.product_id IS '关联产品ID（仅设备件使用）';
COMMENT ON COLUMN inventory.inventory_items.specs IS '规格选项数组（仅常用件使用）';
COMMENT ON COLUMN inventory.inventory_items.current_stock IS '当前库存数量';
COMMENT ON COLUMN inventory.inventory_items.warn_stock IS '预警库存阈值';
COMMENT ON COLUMN inventory.inventory_items.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.inventory_items.created_at IS '创建时间';

-- ============================================
-- 入库记录表 (stock_in_records)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.stock_in_records (
    in_record_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    date DATE NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    remark TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_stock_in_records PRIMARY KEY (in_record_id),
    CONSTRAINT chk_stock_in_records_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_stock_in_records_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_items(item_id)
);

COMMENT ON TABLE inventory.stock_in_records IS '入库记录表';

-- 入库记录表字段注释
COMMENT ON COLUMN inventory.stock_in_records.in_record_id IS '入库记录主键ID';
COMMENT ON COLUMN inventory.stock_in_records.item_id IS '库存件ID';
COMMENT ON COLUMN inventory.stock_in_records.quantity IS '入库数量';
COMMENT ON COLUMN inventory.stock_in_records.date IS '入库日期';
COMMENT ON COLUMN inventory.stock_in_records.photo_url IS '照片文件URL';
COMMENT ON COLUMN inventory.stock_in_records.remark IS '备注';
COMMENT ON COLUMN inventory.stock_in_records.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.stock_in_records.created_at IS '创建时间';

-- ============================================
-- 出库记录表 (stock_out_records)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.stock_out_records (
    out_record_id VARCHAR(32) NOT NULL,
    product_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    date DATE NOT NULL,
    remark TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_stock_out_records PRIMARY KEY (out_record_id),
    CONSTRAINT chk_stock_out_records_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_stock_out_records_product FOREIGN KEY (product_id)
        REFERENCES inventory.products(product_id),
    CONSTRAINT fk_stock_out_records_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_items(item_id)
);

COMMENT ON TABLE inventory.stock_out_records IS '出库记录表';

-- 出库记录表字段注释
COMMENT ON COLUMN inventory.stock_out_records.out_record_id IS '出库记录主键ID';
COMMENT ON COLUMN inventory.stock_out_records.product_id IS '产品ID';
COMMENT ON COLUMN inventory.stock_out_records.item_id IS '库存件ID';
COMMENT ON COLUMN inventory.stock_out_records.quantity IS '出库数量';
COMMENT ON COLUMN inventory.stock_out_records.date IS '出库日期';
COMMENT ON COLUMN inventory.stock_out_records.remark IS '备注';
COMMENT ON COLUMN inventory.stock_out_records.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.stock_out_records.created_at IS '创建时间';

-- ============================================
-- 盘点记录表 (inventory_checks)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.inventory_checks (
    check_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    before_stock INT NOT NULL,
    after_stock INT NOT NULL,
    date DATE NOT NULL,
    remark TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory_checks PRIMARY KEY (check_id),
    CONSTRAINT chk_inventory_checks_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_inventory_checks_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_items(item_id)
);

COMMENT ON TABLE inventory.inventory_checks IS '库存盘点记录表';

-- 盘点记录表字段注释
COMMENT ON COLUMN inventory.inventory_checks.check_id IS '盘点记录主键ID';
COMMENT ON COLUMN inventory.inventory_checks.item_id IS '库存件ID';
COMMENT ON COLUMN inventory.inventory_checks.before_stock IS '盘点前库存数量';
COMMENT ON COLUMN inventory.inventory_checks.after_stock IS '盘点后库存数量';
COMMENT ON COLUMN inventory.inventory_checks.date IS '盘点日期';
COMMENT ON COLUMN inventory.inventory_checks.remark IS '备注';
COMMENT ON COLUMN inventory.inventory_checks.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.inventory_checks.created_at IS '创建时间';

-- ============================================
-- 创建索引
-- ============================================

-- 产品表索引
CREATE INDEX IF NOT EXISTS idx_products_status ON inventory.products(status);
COMMENT ON INDEX inventory.idx_products_status IS '产品状态索引，用于按状态筛选';

-- 库存件表索引
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory.inventory_items(type);
COMMENT ON INDEX inventory.idx_inventory_items_type IS '库存件类型索引';
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory.inventory_items(product_id);
COMMENT ON INDEX inventory.idx_inventory_items_product_id IS '关联产品ID索引';
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory.inventory_items(status);
COMMENT ON INDEX inventory.idx_inventory_items_status IS '库存件状态索引';

-- 入库记录表索引
CREATE INDEX IF NOT EXISTS idx_stock_in_records_item_id ON inventory.stock_in_records(item_id);
COMMENT ON INDEX inventory.idx_stock_in_records_item_id IS '库存件ID索引';
CREATE INDEX IF NOT EXISTS idx_stock_in_records_status ON inventory.stock_in_records(status);
COMMENT ON INDEX inventory.idx_stock_in_records_status IS '入库记录状态索引';
CREATE INDEX IF NOT EXISTS idx_stock_in_records_date ON inventory.stock_in_records(date);
COMMENT ON INDEX inventory.idx_stock_in_records_date IS '入库日期索引';

-- 出库记录表索引
CREATE INDEX IF NOT EXISTS idx_stock_out_records_item_id ON inventory.stock_out_records(item_id);
COMMENT ON INDEX inventory.idx_stock_out_records_item_id IS '库存件ID索引';
CREATE INDEX IF NOT EXISTS idx_stock_out_records_product_id ON inventory.stock_out_records(product_id);
COMMENT ON INDEX inventory.idx_stock_out_records_product_id IS '产品ID索引';
CREATE INDEX IF NOT EXISTS idx_stock_out_records_status ON inventory.stock_out_records(status);
COMMENT ON INDEX inventory.idx_stock_out_records_status IS '出库记录状态索引';
CREATE INDEX IF NOT EXISTS idx_stock_out_records_date ON inventory.stock_out_records(date);
COMMENT ON INDEX inventory.idx_stock_out_records_date IS '出库日期索引';

-- 盘点记录表索引
CREATE INDEX IF NOT EXISTS idx_inventory_checks_item_id ON inventory.inventory_checks(item_id);
COMMENT ON INDEX inventory.idx_inventory_checks_item_id IS '库存件ID索引';
CREATE INDEX IF NOT EXISTS idx_inventory_checks_status ON inventory.inventory_checks(status);
COMMENT ON INDEX inventory.idx_inventory_checks_status IS '盘点记录状态索引';
CREATE INDEX IF NOT EXISTS idx_inventory_checks_date ON inventory.inventory_checks(date);
COMMENT ON INDEX inventory.idx_inventory_checks_date IS '盘点日期索引';

-- ============================================
-- 初始化数据（可选）
-- ============================================

-- 示例：插入测试产品（仅用于开发环境）
-- INSERT INTO inventory.products (product_id, name, code, description, status)
-- VALUES
--     ('PROD001', '测试产品A', 'PROD-A', '这是测试产品A的描述', 1),
--     ('PROD002', '测试产品B', 'PROD-B', '这是测试产品B的描述', 1);
