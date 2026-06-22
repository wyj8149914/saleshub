# 按规格区分库存 + 零件/产品图片字段 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将零件库存从单一字段改为按规格独立管理,并为零件/产品添加 image_id 关联 MinIO 文件表。

**Architecture:** 新增 `inventory.inventory_item_spec` 表承载每个规格的独立库存,移除 `inventory_item.current_stock` 与 `specs` 字段;出入库/盘点记录新增 `spec` 列;零件、产品表新增 `image_id` 列关联 `public.file.relation_id`。Service 层调整业务逻辑与聚合查询。

**Tech Stack:** TypeScript + Express + TypeORM + PostgreSQL + class-validator。Schema 由 SQL 脚本管理(`synchronize: false`),不使用 TypeORM 自动同步。

**Spec:** `docs/superpowers/specs/2026-06-22-spec-based-stock-and-image-design.md`

**重要约定:**
- **Schema**:`inventory`(库存相关表),`public`(file 表)
- **表名**:单数(`inventory_item`、`stock_in_record`、`inventory_item_spec` 等)
- **字段命名**:snake_case,与 entity 字段名一致(无命名转换)
- **主键**:`v7().replace(/-/g, '')` 生成的 32 字符无连字符 UUIDv7
- **测试策略**:项目当前无业务测试,本次不引入 TDD。验证手段为 `pnpm run typecheck` + `pnpm run lint` + 手工 API 调用
- **提交策略**:本计划不含 `git commit` 步骤。实现完成后由用户决定提交时机与粒度

---

## 文件结构

**SQL 脚本**(新建)
- Create: `sql/migration-spec-based-stock.sql` — 新建 spec 表,修改现有 6 张表

**实体层**(修改 `src/entity/`)
- Modify: `src/entity/product.entity.ts` — 新增 `InventoryItemSpec`;`InventoryItem`/`Product`/`ProductItem` 字段调整
- Modify: `src/entity/stock.entity.ts` — 三个记录表新增 `spec`

**DTO 层**(修改 `src/dto/`)
- Modify: `src/dto/item.dto.ts` — `Create/UpdateInventoryItemDto` 新增 `image_id`
- Modify: `src/dto/product.dto.ts` — `Create/UpdateProductDto` 新增 `image_id`;`ProductItemEntryDto` 新增 `spec`
- Modify: `src/dto/stock.dto.ts` — `StockInDto`/`StockOutDto` 新增 `spec`;`StockCheckDto` 重构为批量结构

**Service 层**(修改 `src/service/inventory/`)
- Modify: `src/service/inventory/item.service.ts` — create/update/delete/list 改造
- Modify: `src/service/inventory/product.service.ts` — create/update/setProductItems/getProductItems 改造
- Modify: `src/service/inventory/stock.service.ts` — stockIn/stockOut/stockCheck/listHistory 改造

**设计文档**(已存在,仅微调)
- Modify: `docs/superpowers/specs/2026-06-22-spec-based-stock-and-image-design.md` — schema/表名修正(本计划开始前已完成)

---

## Task 1: 创建 SQL 迁移脚本

**Files:**
- Create: `sql/migration-spec-based-stock.sql`

- [ ] **Step 1: 创建迁移脚本头部**

新建 `sql/migration-spec-based-stock.sql`,写入头部说明:

```sql
-- ============================================
-- 按规格区分库存 + 图片字段迁移脚本
-- 版本: 1.2
-- 创建日期: 2026-06-22
-- 改动说明:
--   1. 新增 inventory.inventory_item_spec 规格库存表
--   2. inventory.inventory_item 新增 image_id 列, 移除 current_stock/specs 列
--   3. inventory.product 新增 image_id 列
--   4. inventory.product_item 新增 spec 列, 唯一约束改为 (product_id, item_id, spec)
--   5. inventory.stock_in_record / stock_out_record / inventory_check 新增 spec 列
-- 开发环境清理: 需先清空 stock_in_record / stock_out_record / inventory_check / product_item / inventory_item 数据
-- 依赖: 先执行 create-inventory-schema.sql v1.0、migration-product-items.sql v1.1、migration-file-upload.sql v1.1
-- ============================================
```

- [ ] **Step 2: 新建 inventory_item_spec 表**

继续写入:

```sql
-- ============================================
-- 1. 创建 inventory_item_spec 规格库存表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.inventory_item_spec (
    spec_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    spec VARCHAR(100) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory_item_spec PRIMARY KEY (spec_id),
    CONSTRAINT uk_inventory_item_spec_item_spec UNIQUE (item_id, spec),
    CONSTRAINT chk_inventory_item_spec_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_inventory_item_spec_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_item(item_id)
);

COMMENT ON TABLE inventory.inventory_item_spec IS '零件规格库存表(每个规格一条 SKU 记录,spec 空串为默认 SKU)';

COMMENT ON COLUMN inventory.inventory_item_spec.spec_id IS '规格库存主键ID';
COMMENT ON COLUMN inventory.inventory_item_spec.item_id IS '零件ID';
COMMENT ON COLUMN inventory.inventory_item_spec.spec IS '规格值,空串代表零件无规格时的默认 SKU';
COMMENT ON COLUMN inventory.inventory_item_spec.current_stock IS '当前规格库存数量';
COMMENT ON COLUMN inventory.inventory_item_spec.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.inventory_item_spec.create_time IS '创建时间';
COMMENT ON COLUMN inventory.inventory_item_spec.update_time IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_inventory_item_spec_item_id ON inventory.inventory_item_spec(item_id);
COMMENT ON INDEX inventory.idx_inventory_item_spec_item_id IS '零件ID索引';
CREATE INDEX IF NOT EXISTS idx_inventory_item_spec_status ON inventory.inventory_item_spec(status);
COMMENT ON INDEX inventory.idx_inventory_item_spec_status IS '规格库存状态索引';
```

- [ ] **Step 3: 清空现有库存相关数据(开发环境)**

继续写入:

```sql
-- ============================================
-- 2. 开发环境清空(避免外键/字段依赖冲突)
-- ============================================
TRUNCATE inventory.stock_in_record CASCADE;
TRUNCATE inventory.stock_out_record CASCADE;
TRUNCATE inventory.inventory_check CASCADE;
TRUNCATE inventory.product_item CASCADE;
TRUNCATE inventory.inventory_item CASCADE;
TRUNCATE inventory.product CASCADE;
```

- [ ] **Step 4: 修改 inventory_item 表(加 image_id,删 current_stock/specs)**

继续写入:

```sql
-- ============================================
-- 3. inventory_item 表字段调整
-- ============================================
ALTER TABLE inventory.inventory_item ADD COLUMN IF NOT EXISTS image_id VARCHAR(32);
COMMENT ON COLUMN inventory.inventory_item.image_id IS '零件图片 file.relation_id';

ALTER TABLE inventory.inventory_item DROP COLUMN IF EXISTS current_stock;
ALTER TABLE inventory.inventory_item DROP COLUMN IF EXISTS specs;
```

- [ ] **Step 5: 修改 product 表(加 image_id)**

继续写入:

```sql
-- ============================================
-- 4. product 表字段调整
-- ============================================
ALTER TABLE inventory.product ADD COLUMN IF NOT EXISTS image_id VARCHAR(32);
COMMENT ON COLUMN inventory.product.image_id IS '产品图片 file.relation_id';
```

- [ ] **Step 6: 修改 product_item 表(加 spec,改唯一约束)**

继续写入:

```sql
-- ============================================
-- 5. product_item 表字段调整
-- ============================================
ALTER TABLE inventory.product_item ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.product_item.spec IS 'BOM 指定的零件规格,无规格零件传空串';

-- 替换唯一约束:(product_id, item_id) → (product_id, item_id, spec)
ALTER TABLE inventory.product_item DROP CONSTRAINT IF EXISTS uk_product_items_product_item;
ALTER TABLE inventory.product_item ADD CONSTRAINT uk_product_item_product_item_spec
    UNIQUE (product_id, item_id, spec);
```

- [ ] **Step 7: 修改 stock_in_record/stock_out_record/inventory_check 表(加 spec)**

继续写入:

```sql
-- ============================================
-- 6. stock_in_record / stock_out_record / inventory_check 新增 spec
-- ============================================
ALTER TABLE inventory.stock_in_record ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.stock_in_record.spec IS '入库规格,空串为默认 SKU';

ALTER TABLE inventory.stock_out_record ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.stock_out_record.spec IS '出库规格,空串为默认 SKU';

ALTER TABLE inventory.inventory_check ADD COLUMN IF NOT EXISTS spec VARCHAR(100) NOT NULL DEFAULT '';
COMMENT ON COLUMN inventory.inventory_check.spec IS '盘点规格,空串为默认 SKU';

CREATE INDEX IF NOT EXISTS idx_stock_in_record_spec ON inventory.stock_in_record(spec);
CREATE INDEX IF NOT EXISTS idx_stock_out_record_spec ON inventory.stock_out_record(spec);
CREATE INDEX IF NOT EXISTS idx_inventory_check_spec ON inventory.inventory_check(spec);
```

- [ ] **Step 8: 验证 SQL 脚本可执行**

手动用 psql 或数据库客户端执行整个脚本,确认无报错。
(开发环境数据库连接信息见 `.env.development`)

---

## Task 2: 修改实体层 — product.entity.ts

**Files:**
- Modify: `src/entity/product.entity.ts`

- [ ] **Step 1: 新增 InventoryItemSpec 实体**

在 `src/entity/product.entity.ts` 文件末尾追加(在 `ProductItem` 类之后):

```typescript
import { Entity, Column, PrimaryColumn, Unique } from 'typeorm';

@Entity({ schema: 'inventory', name: 'inventory_item_spec' })
@Unique('uq_item_spec', ['item_id', 'spec'])
export class InventoryItemSpec {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    spec_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, comment: '规格值,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', default: 0, comment: '当前规格库存' })
    current_stock: number;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

注意:同时修改文件顶部的 import,把 `Unique` 加入导入。

- [ ] **Step 2: 修改 InventoryItem 实体**

把 `src/entity/product.entity.ts` 中的 `InventoryItem` 类替换为:

```typescript
@Entity({ schema: 'inventory', name: 'inventory_item' })
export class InventoryItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    item_id: string;

    @Column({ type: 'varchar', length: 10, comment: '类型:device-设备件,common-常用件' })
    type: string;

    @Column({ type: 'varchar', length: 100, comment: '名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, comment: '编码' })
    code: string;

    @Column({ type: 'int', default: 10, comment: '预警阈值' })
    warn_stock: number;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '零件图片 file.relation_id' })
    image_id: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

移除了 `specs` 与 `current_stock` 字段,新增了 `image_id` 字段。

- [ ] **Step 3: 修改 Product 实体(加 image_id)**

把 `Product` 类替换为:

```typescript
@Entity({ schema: 'inventory', name: 'product' })
export class Product {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    product_id: string;

    @Column({ type: 'varchar', length: 100, comment: '产品名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, unique: true, comment: '产品编码,唯一标识' })
    code: string;

    @Column({ type: 'text', nullable: true, comment: '产品描述' })
    description: string;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '产品图片 file.relation_id' })
    image_id: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- [ ] **Step 4: 修改 ProductItem 实体(加 spec)**

把 `ProductItem` 类替换为:

```typescript
@Entity({ schema: 'inventory', name: 'product_item' })
export class ProductItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    relation_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'int', default: 1, comment: '单台产品所需数量' })
    quantity_per_product: number;

    @Column({ type: 'varchar', length: 100, default: '', comment: 'BOM 指定的零件规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string | null;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- [ ] **Step 5: 类型检查**

运行: `pnpm run typecheck`
预期: 此时会报错(item.service / product.service / stock.service 引用了已删除的 `current_stock` / `specs` 字段)。后续 Task 会修复。先确认实体层自身无语法错误(实体层文件单独无错)。

---

## Task 3: 修改实体层 — stock.entity.ts

**Files:**
- Modify: `src/entity/stock.entity.ts`

- [ ] **Step 1: StockInRecord 新增 spec**

修改 `src/entity/stock.entity.ts` 的 `StockInRecord` 类,在 `item_id` 后追加 `spec` 列定义。完整类:

```typescript
@Entity({ schema: 'inventory', name: 'stock_in_record' })
export class StockInRecord {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    record_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '入库规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '入库数量' })
    quantity: number;

    @Column({ type: 'date', comment: '入库日期' })
    date: Date;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '入库照片 file.relation_id' })
    photo_id: string;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'varchar', length: 50, comment: '记录编号' })
    record_no: string;
}
```

- [ ] **Step 2: StockOutRecord 新增 spec**

修改 `StockOutRecord` 类。完整类:

```typescript
@Entity({ schema: 'inventory', name: 'stock_out_record' })
export class StockOutRecord {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    record_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '出库规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '出库数量' })
    quantity: number;

    @Column({ type: 'date', comment: '出库日期' })
    date: Date;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'varchar', length: 50, comment: '记录编号' })
    record_no: string;
}
```

- [ ] **Step 3: InventoryCheck 新增 spec**

修改 `InventoryCheck` 类。完整类:

```typescript
@Entity({ schema: 'inventory', name: 'inventory_check' })
export class InventoryCheck {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    check_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '盘点规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '盘点前库存' })
    before_stock: number;

    @Column({ type: 'int', comment: '盘点后库存' })
    after_stock: number;

    @Column({ type: 'date', comment: '盘点日期' })
    date: Date;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;
}
```

---

## Task 4: 修改 DTO — item.dto.ts

**Files:**
- Modify: `src/dto/item.dto.ts`

- [ ] **Step 1: 替换 item.dto.ts 全文**

将 `src/dto/item.dto.ts` 替换为:

```typescript
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsArray, MaxLength, IsIn, IsInt, Min, IsString } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateInventoryItemDto {
    @IsNotEmpty({ message: '类型不能为空' })
    @IsIn(['device', 'common'], { message: '类型必须是device或common' })
    type: string;

    @IsNotEmpty({ message: '名称不能为空' })
    @MaxLength(100, { message: '名称长度不能超过100' })
    name: string;

    @IsOptional()
    @IsArray({ message: '规格必须是字符串数组' })
    specs: string[];

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: '预警库存不能小于1' })
    warnStock: number;

    @IsOptional()
    @IsString()
    @MaxLength(32, { message: '图片ID长度不能超过32' })
    image_id?: string;
}

export class UpdateInventoryItemDto extends CreateInventoryItemDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}

export class ListInventoryItemDto extends PageDto {
    @IsOptional()
    @IsIn(['device', 'common'], { message: '类型必须是device或common' })
    type: string;

    @IsOptional()
    name: string;

    @IsOptional()
    code: string;

    @IsOptional()
    @Type(() => Number)
    @IsIn([1, 2], { message: '是否预警必须是1-正常,2-库存预警' })
    isWarning: number;
}

export class ItemIdDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}
```

变更:`CreateInventoryItemDto` 新增 `image_id`(可选);移除了已不需要的 `IsNumber` 导入,新增 `IsString`。

---

## Task 5: 修改 DTO — product.dto.ts

**Files:**
- Modify: `src/dto/product.dto.ts`

- [ ] **Step 1: 替换 product.dto.ts 全文**

将 `src/dto/product.dto.ts` 替换为:

```typescript
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsArray, IsInt, Min, ValidateNested, IsString } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateProductDto {
    @IsNotEmpty({ message: '名称不能为空' })
    @MaxLength(100, { message: '名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(500, { message: '描述长度不能超过500' })
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(32, { message: '图片ID长度不能超过32' })
    image_id?: string;
}

export class UpdateProductDto extends CreateProductDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

export class ListProductDto extends PageDto {
    @IsOptional()
    name: string;

    @IsOptional()
    code: string;
}

export class ProductIdDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

export class ProductItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: '单台数量不能小于1' })
    quantity_per_product?: number;

    @IsNotEmpty({ message: '规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class SetProductItemsDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsArray({ message: '零件列表必须是数组' })
    @IsNotEmpty({ message: '零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => ProductItemEntryDto)
    items: ProductItemEntryDto[];
}

export class ProductItemIdDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}
```

变更:`CreateProductDto` 新增 `image_id`;`ProductItemEntryDto` 新增 `spec`(必填,允许空串)。

---

## Task 6: 修改 DTO — stock.dto.ts

**Files:**
- Modify: `src/dto/stock.dto.ts`

- [ ] **Step 1: 替换 stock.dto.ts 全文**

将 `src/dto/stock.dto.ts` 替换为:

```typescript
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsInt, Min, IsDateString, MaxLength, IsArray, ValidateNested, IsString } from 'class-validator';
import { PageDto } from './base.dto';

export class StockInDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '入库日期不能为空' })
    @IsDateString({}, { message: '入库日期格式不正确' })
    date: string;

    @IsNotEmpty({ message: '照片ID不能为空' })
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '出库规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsNotEmpty({ message: '出库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库数量必须是整数' })
    @Min(1, { message: '出库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '出库日期不能为空' })
    @IsDateString({}, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockCheckSpecDto {
    @IsNotEmpty({ message: '盘点规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsNotEmpty({ message: '盘点后库存不能为空' })
    @Type(() => Number)
    @IsInt({ message: '盘点后库存必须是整数' })
    @Min(0, { message: '盘点后库存不能小于0' })
    after_stock: number;
}

export class StockCheckDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsArray({ message: '盘点规格列表必须是数组' })
    @IsNotEmpty({ message: '盘点规格列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockCheckSpecDto)
    specs: StockCheckSpecDto[];

    @IsNotEmpty({ message: '盘点日期不能为空' })
    @IsDateString({}, { message: '盘点日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class ListStockHistoryDto extends PageDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsOptional()
    @IsDateString({}, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @IsDateString({}, { message: '结束日期格式不正确' })
    end_date?: string;
}
```

变更:`StockInDto`/`StockOutDto` 新增 `spec`;`StockCheckDto` 改为批量结构(specs 数组),新增 `StockCheckSpecDto` 子 DTO。

---

## Task 7: 修改 item.service.ts

**Files:**
- Modify: `src/service/inventory/item.service.ts`

- [ ] **Step 1: 替换 item.service.ts 全文**

将 `src/service/inventory/item.service.ts` 替换为:

```typescript
import { InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { CreateInventoryItemDto, ItemIdDto, ListInventoryItemDto, UpdateInventoryItemDto } from '../../dto/item.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class InventoryItemService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建零件
     */
    async create(dto: CreateInventoryItemDto) {
        try {
            const code = await this.generateItemCode();
            const itemId = v7().replace(/-/g, '');
            const now = new Date();

            const item = new InventoryItem();
            item.item_id = itemId;
            item.code = code;
            item.type = dto.type;
            item.name = dto.name;
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }
            if (dto.image_id) {
                item.image_id = dto.image_id;
            }
            item.status = 1;
            item.create_time = now;
            item.update_time = now;

            const specs = this.normalizeSpecs(dto.specs);
            const specRows: InventoryItemSpec[] = specs.map((spec) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = itemId;
                row.spec = spec;
                row.current_stock = 0;
                row.status = 1;
                row.create_time = now;
                row.update_time = now;
                return row;
            });

            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryItem, item);
                await manager.save(InventoryItemSpec, specRows);
            });

            return { result: 0, msg: '创建成功', datas: { item_id: itemId } };
        } catch (error) {
            this.logger.error('创建零件失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询所有正常状态的零件
     */
    async list(dto: ListInventoryItemDto) {
        try {
            const queryBuilder = this.inventoryItemRepository.createQueryBuilder('item')
                .leftJoin(
                    (qb) => qb
                        .select('s.item_id', 'item_id')
                        .addSelect('COALESCE(SUM(s.current_stock), 0)', 'total_stock')
                        .from(InventoryItemSpec, 's')
                        .where('s.status = 1')
                        .groupBy('s.item_id'),
                    'stock_sum',
                    'stock_sum.item_id = item.item_id'
                )
                .select([
                    'item.item_id AS item_id',
                    'item.type AS type',
                    'item.name AS name',
                    'item.code AS code',
                    'item.warn_stock AS warn_stock',
                    'item.image_id AS image_id',
                    'COALESCE(stock_sum.total_stock, 0) AS total_stock',
                ])
                .where('item.status = :status', { status: 1 });

            if (dto.type) {
                queryBuilder.andWhere('item.type = :type', { type: dto.type });
            }
            if (dto.name) {
                queryBuilder.andWhere('item.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.code) {
                queryBuilder.andWhere('item.code = :code', { code: dto.code });
            }
            if (dto.isWarning === 1) {
                queryBuilder.andWhere('(COALESCE(stock_sum.total_stock, 0) > item.warn_stock OR item.warn_stock = 0)');
            } else if (dto.isWarning === 2) {
                queryBuilder.andWhere('(COALESCE(stock_sum.total_stock, 0) <= item.warn_stock AND item.warn_stock <> 0)');
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder.orderBy('item.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            const itemIds = items.map((it: any) => it.item_id);
            const specRows = itemIds.length > 0
                ? await this.inventoryItemSpecRepository
                    .createQueryBuilder('s')
                    .select(['s.spec_id AS spec_id', 's.item_id AS item_id', 's.spec AS spec', 's.current_stock AS current_stock'])
                    .where('s.item_id IN (:...ids) AND s.status = :status', { ids: itemIds, status: 1 })
                    .getRawMany()
                : [];

            const specMap = new Map<string, any[]>();
            for (const row of specRows) {
                if (!specMap.has(row.item_id)) specMap.set(row.item_id, []);
                specMap.get(row.item_id).push({ spec: row.spec, current_stock: Number(row.current_stock) });
            }

            const datas = items.map((it: any) => ({
                item_id: it.item_id,
                type: it.type,
                name: it.name,
                code: it.code,
                warn_stock: it.warn_stock,
                image_id: it.image_id,
                total_stock: Number(it.total_stock),
                specs: specMap.get(it.item_id) || [],
                isWarning: Number(it.total_stock) <= it.warn_stock ? 2 : 1,
            }));
            return { result: 0, msg: 'success', datas: { total, items: datas } };
        } catch (error) {
            this.logger.error('查询零件列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新零件信息
     * - dto.specs 为 undefined: 规格不变(仅更新其他字段)
     * - dto.specs 为 [](空数组): 清空所有规格,改为默认 SKU(需所有现存规格库存为 0)
     * - dto.specs 为非空数组: 同步为该列表(新增/保留/删除)
     */
    async update(dto: UpdateInventoryItemDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            item.type = dto.type;
            item.name = dto.name;
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }
            item.image_id = dto.image_id ?? null;
            item.update_time = new Date();

            // 规格未传则保持不变,只更新零件主表
            if (dto.specs === undefined) {
                await this.inventoryItemRepository.save(item);
                return { result: 0, msg: '更新成功' };
            }

            const existingSpecs = await this.inventoryItemSpecRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            const newSpecs = this.normalizeSpecs(dto.specs);
            const existingSpecValues = new Set(existingSpecs.map((s) => s.spec));
            const newSpecSet = new Set(newSpecs);

            const toRemove = existingSpecs.filter((s) => !newSpecSet.has(s.spec));
            const toAdd = newSpecs.filter((spec) => !existingSpecValues.has(spec));

            for (const s of toRemove) {
                if (s.current_stock !== 0) {
                    return { result: 1, msg: `规格 "${s.spec}" 库存非零,不能删除` };
                }
            }

            const now = new Date();
            const addRows: InventoryItemSpec[] = toAdd.map((spec) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = dto.item_id;
                row.spec = spec;
                row.current_stock = 0;
                row.status = 1;
                row.create_time = now;
                row.update_time = now;
                return row;
            });

            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryItem, item);
                if (toRemove.length > 0) {
                    await manager.update(
                        InventoryItemSpec,
                        toRemove.map((s) => s.spec_id),
                        { status: 2, update_time: now }
                    );
                }
                if (addRows.length > 0) {
                    await manager.save(InventoryItemSpec, addRows);
                }
            });

            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新零件失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 软删除零件(设置状态为2)
     */
    async delete(dto: ItemIdDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const productItems = await this.productItemRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (productItems.length > 0) {
                return { result: 1, msg: '零件有产品使用,不能删除' };
            }

            const specs = await this.inventoryItemSpecRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            const nonZero = specs.find((s) => s.current_stock !== 0);
            if (nonZero) {
                return { result: 1, msg: `规格 "${nonZero.spec}" 库存非零,不能删除` };
            }

            const now = new Date();
            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.update(InventoryItem, { item_id: dto.item_id }, { status: 2, update_time: now });
                await manager.update(InventoryItemSpec, { item_id: dto.item_id, status: 1 }, { status: 2, update_time: now });
            });

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除零件失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 规格标准化:undefined/空数组 → [''](默认 SKU);去重
     */
    private normalizeSpecs(specs: string[] | undefined): string[] {
        if (!specs || specs.length === 0) {
            return [''];
        }
        const seen = new Set<string>();
        const out: string[] = [];
        for (const s of specs) {
            if (!seen.has(s)) {
                seen.add(s);
                out.push(s);
            }
        }
        return out;
    }

    /**
     * 生成零件编码:IT + 6位递增数字(如 IT000001)
     */
    private async generateItemCode() {
        const result = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .select("MAX(SUBSTRING(item.code, 3)::INTEGER)", 'maxNum')
            .where("item.code ~ :pattern", { pattern: '^IT[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('零件编码已达上限');
        }
        return `IT${String(nextNum).padStart(6, '0')}`;
    }
}
```

---

## Task 8: 修改 product.service.ts

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 替换 product.service.ts 全文**

将 `src/service/inventory/product.service.ts` 替换为:

```typescript
import { EntityManager } from 'typeorm';
import { Product, ProductItem, InventoryItem, InventoryItemSpec } from '../../entity/product.entity';
import {
    CreateProductDto,
    ProductIdDto,
    ListProductDto,
    UpdateProductDto,
    SetProductItemsDto,
} from '../../dto/product.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class ProductService {
    private productRepository = AppDataSource.getRepository(Product);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建产品
     */
    async create(dto: CreateProductDto) {
        try {
            const code = await this.generateProductCode();
            const productId = v7().replace(/-/g, '');
            const now = new Date();

            const product = new Product();
            product.product_id = productId;
            product.code = code;
            product.name = dto.name;
            if (dto.description) {
                product.description = dto.description;
            }
            if (dto.image_id) {
                product.image_id = dto.image_id;
            }
            product.status = 1;
            product.create_time = now;
            product.update_time = now;

            const saved = await this.productRepository.save(product);
            return { result: 0, msg: '创建成功', datas: { product_id: saved.product_id } };
        } catch (error) {
            this.logger.error('创建产品失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询所有正常状态的产品
     */
    async list(dto: ListProductDto) {
        try {
            const queryBuilder = this.productRepository.createQueryBuilder('product')
                .select([
                    'product.product_id AS product_id',
                    'product.name AS name',
                    'product.code AS code',
                    'product.description AS description',
                    'product.image_id AS image_id',
                ])
                .where('product.status = :status', { status: 1 });

            if (dto.name) {
                queryBuilder.andWhere('product.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.code) {
                queryBuilder.andWhere('product.code = :code', { code: dto.code });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const products = await queryBuilder.orderBy('product.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items: products } };
        } catch (error) {
            this.logger.error('查询产品列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新产品信息
     */
    async update(dto: UpdateProductDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            product.name = dto.name;
            if (dto.description !== undefined) {
                product.description = dto.description;
            }
            product.image_id = dto.image_id ?? null;
            product.update_time = new Date();

            await this.productRepository.save(product);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新产品失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 软删除产品(设置状态为2)
     */
    async delete(dto: ProductIdDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            const now = new Date();
            await this.productRepository.manager.transaction(async (manager) => {
                await manager.update(Product, { product_id: dto.product_id }, { status: 2, update_time: now });
                await manager.update(ProductItem, { product_id: dto.product_id, status: 1 }, { status: 2, update_time: now });
            });

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除产品失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 设置产品零件(全量覆盖语义)
     * 传入 product_id 与完整 item 列表(含 spec),使产品的有效关联(status=1)等于列表
     */
    async setProductItems(dto: SetProductItemsDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            // 去重校验:(item_id, spec) 必须唯一
            const keys = dto.items.map((it) => `${it.item_id}||${it.spec}`);
            const dedup = new Set(keys);
            if (dedup.size !== keys.length) {
                return { result: 1, msg: '零件列表存在重复的(零件+规格)' };
            }

            const itemIds = dto.items.map((it) => it.item_id);
            const items = await this.inventoryItemRepository
                .createQueryBuilder('item')
                .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
                .getMany();
            if (items.length !== itemIds.length) {
                const found = new Set(items.map((i: InventoryItem) => i.item_id));
                const missing = itemIds.filter((id) => !found.has(id));
                return { result: 1, msg: `零件不存在或已停用: ${missing.join(',')}` };
            }

            // 校验每个 spec 在对应零件的 spec 列表中
            const itemSpecs = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.item_id IN (:...ids) AND s.status = :status', { ids: itemIds, status: 1 })
                .getMany();
            const itemSpecMap = new Map<string, Set<string>>();
            for (const s of itemSpecs) {
                if (!itemSpecMap.has(s.item_id)) itemSpecMap.set(s.item_id, new Set());
                itemSpecMap.get(s.item_id).add(s.spec);
            }
            for (const it of dto.items) {
                const allowed = itemSpecMap.get(it.item_id);
                if (!allowed || !allowed.has(it.spec)) {
                    return { result: 1, msg: `零件 ${it.item_id} 不存在规格 "${it.spec}"` };
                }
            }

            const now = new Date();
            let productItems: ProductItem[] = dto.items.map((it) => {
                const pi = new ProductItem();
                pi.relation_id = v7().replace(/-/g, '');
                pi.product_id = dto.product_id;
                pi.item_id = it.item_id;
                pi.quantity_per_product = it.quantity_per_product ?? 1;
                pi.spec = it.spec;
                pi.remark = it.remark ?? null;
                pi.status = 1;
                pi.create_time = now;
                pi.update_time = now;
                return pi;
            });

            await this.productItemRepository.manager.transaction(async (manager: EntityManager) => {
                await manager.update(ProductItem, { product_id: dto.product_id }, { status: 2, update_time: now });
                await manager.save(ProductItem, productItems);
            });

            return { result: 0, msg: '设置成功' };
        } catch (error) {
            this.logger.error('设置产品零件失败:', error);
            return { result: 1, msg: '设置失败' };
        }
    }

    /**
     * 查询产品的零件列表(含零件详情与规格库存)
     */
    async getProductItems(dto: ProductIdDto) {
        try {
            const rows = await this.productItemRepository.createQueryBuilder('pi')
                .innerJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .leftJoin(
                    InventoryItemSpec,
                    's',
                    's.item_id = pi.item_id AND s.spec = pi.spec AND s.status = 1'
                )
                .select([
                    'pi.relation_id AS relation_id',
                    'pi.product_id AS product_id',
                    'pi.item_id AS item_id',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.spec AS spec',
                    'pi.remark AS remark',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'i.type AS item_type',
                    'i.warn_stock AS warn_stock',
                    'COALESCE(s.current_stock, 0) AS current_stock',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            return { result: 0, msg: 'success', datas: { items: rows } };
        } catch (error) {
            this.logger.error('查询产品零件失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 生成产品编码:PR + 6位递增数字(如 PR000001)
     */
    private async generateProductCode() {
        const result = await this.productRepository
            .createQueryBuilder('product')
            .select("MAX(SUBSTRING(product.code, 3)::INTEGER)", 'maxNum')
            .where("product.code ~ :pattern", { pattern: '^PR[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('产品编码已达上限');
        }
        return `PR${String(nextNum).padStart(6, '0')}`;
    }
}
```

---

## Task 9: 修改 stock.service.ts

**Files:**
- Modify: `src/service/inventory/stock.service.ts`

- [ ] **Step 1: 替换 stock.service.ts 全文**

将 `src/service/inventory/stock.service.ts` 替换为:

```typescript
import { InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/stock.entity';
import { StockInDto, StockOutDto, StockCheckDto, ListStockHistoryDto } from '../../dto/stock.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class StockService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private stockInRepository = AppDataSource.getRepository(StockInRecord);
    private stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    private inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 入库操作
     */
    async stockIn(dto: StockInDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec: dto.spec, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: `零件不存在规格 "${dto.spec}"` };
            }

            const recordNo = await this.generateStockInRecordNo();
            const now = new Date();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec = dto.spec;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            record.photo_id = dto.photo_id;
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
            record.create_time = now;

            const newStock = spec.current_stock + dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockInRecord, record);
                await manager.update(InventoryItemSpec, { spec_id: spec.spec_id }, { current_stock: newStock, update_time: now });
            });

            return { result: 0, msg: '入库成功' };
        } catch (error) {
            this.logger.error('入库失败:', error);
            return { result: 1, msg: '入库失败' };
        }
    }

    /**
     * 出库操作
     */
    async stockOut(dto: StockOutDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            if (item.type !== 'device') {
                return { result: 1, msg: '只有设备件可以出库' };
            }

            const rel = await this.productItemRepository.findOne({
                where: { product_id: dto.product_id, item_id: dto.item_id, spec: dto.spec, status: 1 },
            });
            if (!rel) {
                return { result: 1, msg: '该零件+规格未关联到此产品' };
            }

            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec: dto.spec, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: `零件不存在规格 "${dto.spec}"` };
            }
            if (spec.current_stock < dto.quantity) {
                return { result: 1, msg: `规格 "${dto.spec}" 库存不足(当前 ${spec.current_stock},需要 ${dto.quantity})` };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const now = new Date();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.product_id = dto.product_id;
            record.item_id = dto.item_id;
            record.spec = dto.spec;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
            record.create_time = now;

            const newStock = spec.current_stock - dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockOutRecord, record);
                await manager.update(InventoryItemSpec, { spec_id: spec.spec_id }, { current_stock: newStock, update_time: now });
            });

            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }

    /**
     * 查询零件历史记录(入库、出库、盘点)
     */
    async listHistory(dto: ListStockHistoryDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            let dateCondition = '';
            const params: Record<string, unknown> = { itemId: dto.item_id, status: 1 };

            if (dto.start_date) {
                dateCondition += ' AND date >= :startDate';
                params.startDate = new Date(dto.start_date);
            }
            if (dto.end_date) {
                dateCondition += ' AND date <= :endDate';
                params.endDate = new Date(dto.end_date);
            }

            const inRecords = await this.stockInRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const outRecords = await this.stockOutRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const checkRecords = await this.inventoryCheckRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const mergedRecords = [
                ...inRecords.map((r: StockInRecord) => ({ ...r, id: r.record_id, type: 'in' as const })),
                ...outRecords.map((r: StockOutRecord) => ({ ...r, id: r.record_id, type: 'out' as const })),
                ...checkRecords.map((r: InventoryCheck) => ({ ...r, id: r.check_id, type: 'check' as const })),
            ];
            mergedRecords.sort((a, b) => b.create_time.getTime() - a.create_time.getTime());

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = mergedRecords.length;
            const items = mergedRecords.slice(start, start + dto.pageSize);

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询历史记录失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 库存盘点(批量,事务内执行)
     */
    async stockCheck(dto: StockCheckDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const specValues = dto.specs.map((s) => s.spec);
            const dedup = new Set(specValues);
            if (dedup.size !== specValues.length) {
                return { result: 1, msg: '盘点规格列表存在重复' };
            }

            const specs = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.item_id = :itemId AND s.status = :status AND s.spec IN (:...specValues)', {
                    itemId: dto.item_id,
                    status: 1,
                    specValues,
                })
                .getMany();
            if (specs.length !== specValues.length) {
                const found = new Set(specs.map((s) => s.spec));
                const missing = specValues.filter((v) => !found.has(v));
                return { result: 1, msg: `零件不存在规格: ${missing.join(',')}` };
            }
            const specMap = new Map(specs.map((s) => [s.spec, s]));

            const now = new Date();
            const checkDate = new Date(dto.date);

            await this.inventoryCheckRepository.manager.transaction(async (manager) => {
                for (const input of dto.specs) {
                    const target = specMap.get(input.spec);
                    const before = target.current_stock;
                    const checkRecord = new InventoryCheck();
                    checkRecord.check_id = v7().replace(/-/g, '');
                    checkRecord.item_id = dto.item_id;
                    checkRecord.spec = input.spec;
                    checkRecord.before_stock = before;
                    checkRecord.after_stock = input.after_stock;
                    checkRecord.date = checkDate;
                    if (dto.remark) {
                        checkRecord.remark = dto.remark;
                    }
                    checkRecord.status = 1;
                    checkRecord.create_time = now;
                    await manager.save(InventoryCheck, checkRecord);
                    await manager.update(InventoryItemSpec, { spec_id: target.spec_id }, { current_stock: input.after_stock, update_time: now });
                }
            });

            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('盘点失败:', error);
            return { result: 1, msg: '盘点失败' };
        }
    }

    /**
     * 生成入库记录编号:SI + 6位递增数字(如 SI000001)
     */
    private async generateStockInRecordNo() {
        const result = await this.stockInRepository
            .createQueryBuilder('record')
            .select("MAX(SUBSTRING(record.record_no, 3)::INTEGER)", 'maxNum')
            .where("record.record_no ~ :pattern", { pattern: '^SI[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('入库记录编号已达上限');
        }
        return `SI${String(nextNum).padStart(6, '0')}`;
    }

    /**
     * 生成出库记录编号:SO + 6位递增数字(如 SO000001)
     */
    private async generateStockOutRecordNo() {
        const result = await this.stockOutRepository
            .createQueryBuilder('record')
            .select("MAX(SUBSTRING(record.record_no, 3)::INTEGER)", 'maxNum')
            .where("record.record_no ~ :pattern", { pattern: '^SO[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('出库记录编号已达上限');
        }
        return `SO${String(nextNum).padStart(6, '0')}`;
    }
}
```

---

## Task 10: 验证

- [ ] **Step 1: 类型检查**

运行: `pnpm run typecheck`
预期: 通过,无报错。

- [ ] **Step 2: 代码风格检查**

运行: `pnpm run lint`
预期: 通过。若有报错,运行 `pnpm run lint:fix` 自动修复,然后再次确认。

- [ ] **Step 3: 启动服务并冒烟测试**

运行: `pnpm run dev`(后台启动)
然后用 Postman/curl 测试以下路径:

1. **创建零件(有规格)**:`POST /inventory/createItem` body: `{ "type": "common", "name": "螺丝", "specs": ["红色", "蓝色"] }` → 返回 `item_id`
2. **创建零件(无规格)**:`POST /inventory/createItem` body: `{ "type": "device", "name": "主板" }` → 返回 `item_id`
3. **查询零件列表**:`GET /inventory/listItems` → 返回包含 `total_stock`、`specs: [{spec, current_stock}]`、`image_id`
4. **入库**:`POST /inventory/stockIn` body: `{ "item_id": "...", "spec": "红色", "quantity": 10, "date": "2026-06-22", "photo_id": "..." }` → 成功
5. **盘点批量**:`POST /inventory/stockCheck` body: `{ "item_id": "...", "date": "2026-06-22", "specs": [{"spec": "红色", "after_stock": 8}, {"spec": "蓝色", "after_stock": 5}] }` → 成功
6. **出库**:`POST /inventory/stockOut`(需先 setProductItems 关联规格)
7. **删除零件(库存非零)**:尝试删除有库存的零件 → 返回错误
8. **删除规格(库存非零)**:更新零件去掉某规格 → 返回错误

- [ ] **Step 4: 完成确认**

所有步骤通过后,告知用户实现已完成。**不要自动 git commit**,等用户决定提交时机。

---

## 备注

- 计划中所有 service 方法均保留了项目原有的「catch + 返回 `{result, msg}`」错误处理风格,与现有代码一致
- 所有写操作均使用 `manager.transaction(...)` 显式事务,符合项目 `setProductItems` 已有的做法
- ID 生成统一使用 `v7().replace(/-/g, '')`,与现有代码一致
- 没有引入新的依赖,没有改动路由层、中间件、file 服务
