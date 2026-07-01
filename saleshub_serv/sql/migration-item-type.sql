-- ============================================
-- 零件类型表迁移脚本
-- 版本: 1.4
-- 创建日期: 2026-07-01
-- 改动说明:
--   1. 新增 inventory.item_type 零件类型表(支持两级树形结构)
--   2. inventory.inventory_item 新增 type_id 列, 迁移 type 枚举数据后删除 type 列
--   3. 插入初始类型数据(设备件、常用件)
-- 依赖: 先执行 create-inventory-schema.sql 及后续 inventory 相关迁移脚本
-- ============================================

-- ============================================
-- 1. 创建 item_type 零件类型表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.item_type (
    type_id VARCHAR(32) NOT NULL,
    parent_id VARCHAR(32),
    type_name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    sort_order INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    remark TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_item_type PRIMARY KEY (type_id),
    CONSTRAINT uk_item_type_type_name UNIQUE (type_name),
    CONSTRAINT chk_item_type_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_item_type_parent FOREIGN KEY (parent_id)
        REFERENCES inventory.item_type(type_id) ON DELETE SET NULL
);

COMMENT ON TABLE inventory.item_type IS '零件类型表(支持一级、二级树形结构)';

COMMENT ON COLUMN inventory.item_type.type_id IS '类型ID';
COMMENT ON COLUMN inventory.item_type.parent_id IS '父类型ID，NULL表示一级类型';
COMMENT ON COLUMN inventory.item_type.type_name IS '类型名称';
COMMENT ON COLUMN inventory.item_type.code IS '类型编码';
COMMENT ON COLUMN inventory.item_type.sort_order IS '排序号，越小越靠前';
COMMENT ON COLUMN inventory.item_type.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.item_type.remark IS '备注';
COMMENT ON COLUMN inventory.item_type.create_time IS '创建时间';
COMMENT ON COLUMN inventory.item_type.update_time IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_item_type_parent_id ON inventory.item_type(parent_id);
COMMENT ON INDEX inventory.idx_item_type_parent_id IS '父类型ID索引';
CREATE INDEX IF NOT EXISTS idx_item_type_status ON inventory.item_type(status);
COMMENT ON INDEX inventory.idx_item_type_status IS '类型状态索引';

-- ============================================
-- 2. 插入初始类型数据(设备件、常用件)
-- ============================================
INSERT INTO inventory.item_type (type_id, parent_id, type_name, code, sort_order, status, create_time, update_time)
VALUES
    ('type_device', NULL, '设备件', 'device', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('type_common', NULL, '常用件', 'common', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (type_id) DO NOTHING;

-- ============================================
-- 3. inventory_item 表字段调整: type -> type_id
-- ============================================
ALTER TABLE inventory.inventory_item ADD COLUMN IF NOT EXISTS type_id VARCHAR(32);
COMMENT ON COLUMN inventory.inventory_item.type_id IS '类型ID';

UPDATE inventory.inventory_item
SET type_id = CASE
    WHEN type = 'device' THEN 'type_device'
    WHEN type = 'common' THEN 'type_common'
    ELSE 'type_device'
END
WHERE type_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'inventory'
        AND table_name = 'inventory_item'
        AND column_name = 'type'
  );

ALTER TABLE inventory.inventory_item DROP CONSTRAINT IF EXISTS chk_inventory_items_type;
ALTER TABLE inventory.inventory_item DROP CONSTRAINT IF EXISTS chk_inventory_item_type;
DROP INDEX IF EXISTS inventory.idx_inventory_items_type;
DROP INDEX IF EXISTS inventory.idx_inventory_item_type;
ALTER TABLE inventory.inventory_item DROP COLUMN IF EXISTS type;

UPDATE inventory.inventory_item
SET type_id = 'type_device'
WHERE type_id IS NULL;

ALTER TABLE inventory.inventory_item ALTER COLUMN type_id SET NOT NULL;

-- ============================================
-- 4. inventory_item 外键与索引
-- ============================================
ALTER TABLE inventory.inventory_item DROP CONSTRAINT IF EXISTS fk_inventory_item_type;
ALTER TABLE inventory.inventory_item ADD CONSTRAINT fk_inventory_item_type
    FOREIGN KEY (type_id) REFERENCES inventory.item_type(type_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_type_id ON inventory.inventory_item(type_id);
COMMENT ON INDEX inventory.idx_inventory_item_type_id IS '零件类型ID索引';
