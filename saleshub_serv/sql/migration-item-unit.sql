-- ============================================
-- 零件单位字段迁移脚本
-- 版本: 1.6
-- 创建日期: 2026-11-17
-- 改动说明:
--   1. inventory.inventory_item 新增 unit 列(单位, 由用户手动填写)
-- 依赖: 先执行 create-inventory-schema.sql 及后续 inventory 相关迁移脚本
-- ============================================

-- ============================================
-- 1. inventory_item 新增 unit 列
-- ============================================
ALTER TABLE inventory.inventory_item ADD COLUMN IF NOT EXISTS unit VARCHAR(20);
COMMENT ON COLUMN inventory.inventory_item.unit IS '单位，用户手动填写';
