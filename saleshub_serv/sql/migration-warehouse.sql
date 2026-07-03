-- ============================================
-- 仓库管理功能迁移脚本
-- 版本: 1.5
-- 创建日期: 2026-07-03
-- 改动说明:
--   1. 新增 inventory.warehouse 仓库表
--   2. 新增 inventory.item_spec_warehouse 库存明细表
--   3. inventory.stock_in_record 新增 warehouse_id 列
--   4. inventory.stock_out_record 新增 warehouse_id 列
--   5. inventory.inventory_check 新增 warehouse_id 列
-- 依赖: 先执行 create-inventory-schema.sql 及后续 inventory 相关迁移脚本
-- ============================================

-- ============================================
-- 1. 创建 warehouse 仓库表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.warehouse (
    warehouse_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_warehouse PRIMARY KEY (warehouse_id),
    CONSTRAINT chk_warehouse_status CHECK (status IN (1, 2))
);

COMMENT ON TABLE inventory.warehouse IS '仓库表';
COMMENT ON COLUMN inventory.warehouse.warehouse_id IS '仓库ID';
COMMENT ON COLUMN inventory.warehouse.name IS '仓库名称';
COMMENT ON COLUMN inventory.warehouse.location IS '位置';
COMMENT ON COLUMN inventory.warehouse.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.warehouse.create_time IS '创建时间';
COMMENT ON COLUMN inventory.warehouse.update_time IS '修改时间';

CREATE INDEX IF NOT EXISTS idx_warehouse_status ON inventory.warehouse(status);
COMMENT ON INDEX inventory.idx_warehouse_status IS '仓库状态索引';

-- ============================================
-- 2. 创建 item_spec_warehouse 库存明细表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.item_spec_warehouse (
    id VARCHAR(32) NOT NULL,
    spec_id VARCHAR(32) NOT NULL,
    warehouse_id VARCHAR(32) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_item_spec_warehouse PRIMARY KEY (id),
    CONSTRAINT uk_spec_warehouse UNIQUE (spec_id, warehouse_id),
    CONSTRAINT chk_item_spec_warehouse_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_item_spec_warehouse_spec FOREIGN KEY (spec_id)
        REFERENCES inventory.inventory_item_spec(spec_id) ON DELETE CASCADE,
    CONSTRAINT fk_item_spec_warehouse_warehouse FOREIGN KEY (warehouse_id)
        REFERENCES inventory.warehouse(warehouse_id) ON DELETE RESTRICT
);

COMMENT ON TABLE inventory.item_spec_warehouse IS '库存明细表-规格在各仓库的库存';
COMMENT ON COLUMN inventory.item_spec_warehouse.id IS '主键ID';
COMMENT ON COLUMN inventory.item_spec_warehouse.spec_id IS '规格ID';
COMMENT ON COLUMN inventory.item_spec_warehouse.warehouse_id IS '仓库ID';
COMMENT ON COLUMN inventory.item_spec_warehouse.current_stock IS '该规格在该仓库的库存数量';
COMMENT ON COLUMN inventory.item_spec_warehouse.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.item_spec_warehouse.create_time IS '创建时间';
COMMENT ON COLUMN inventory.item_spec_warehouse.update_time IS '修改时间';

CREATE INDEX IF NOT EXISTS idx_item_spec_warehouse_spec_id ON inventory.item_spec_warehouse(spec_id);
COMMENT ON INDEX inventory.idx_item_spec_warehouse_spec_id IS '规格ID索引';
CREATE INDEX IF NOT EXISTS idx_item_spec_warehouse_warehouse_id ON inventory.item_spec_warehouse(warehouse_id);
COMMENT ON INDEX inventory.idx_item_spec_warehouse_warehouse_id IS '仓库ID索引';
CREATE INDEX IF NOT EXISTS idx_item_spec_warehouse_status ON inventory.item_spec_warehouse(status);
COMMENT ON INDEX inventory.idx_item_spec_warehouse_status IS '库存明细状态索引';

-- ============================================
-- 3. stock_in_record 入库记录表新增 warehouse_id
-- ============================================
ALTER TABLE inventory.stock_in_record ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(32);
COMMENT ON COLUMN inventory.stock_in_record.warehouse_id IS '入库仓库ID';

-- ============================================
-- 4. stock_out_record 出库记录表新增 warehouse_id
-- ============================================
ALTER TABLE inventory.stock_out_record ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(32);
COMMENT ON COLUMN inventory.stock_out_record.warehouse_id IS '出库仓库ID';

-- ============================================
-- 5. inventory_check 盘点记录表新增 warehouse_id
-- ============================================
ALTER TABLE inventory.inventory_check ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(32);
COMMENT ON COLUMN inventory.inventory_check.warehouse_id IS '盘点仓库ID';

-- ============================================
-- 6. 为新增的 warehouse_id 列创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stock_in_record_warehouse_id ON inventory.stock_in_record(warehouse_id);
COMMENT ON INDEX inventory.idx_stock_in_record_warehouse_id IS '入库仓库ID索引';

CREATE INDEX IF NOT EXISTS idx_stock_out_record_warehouse_id ON inventory.stock_out_record(warehouse_id);
COMMENT ON INDEX inventory.idx_stock_out_record_warehouse_id IS '出库仓库ID索引';

CREATE INDEX IF NOT EXISTS idx_inventory_check_warehouse_id ON inventory.inventory_check(warehouse_id);
COMMENT ON INDEX inventory.idx_inventory_check_warehouse_id IS '盘点仓库ID索引';
