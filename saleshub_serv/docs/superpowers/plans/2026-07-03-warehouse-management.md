# 仓库管理功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现仓库管理功能，支持入库/出库/盘点时选择仓库，管理零件在不同仓库的库存分布。

**Architecture:** 新增仓库表和库存明细表，保留现有总库存字段实现向后兼容。入库/出库/盘点操作关联仓库，支持同一规格在不同仓库有独立库存。

**Tech Stack:** TypeScript, Express, TypeORM, PostgreSQL, class-validator

---

## 文件结构

### 新增文件
- `sql/migration-warehouse.sql` - 数据库迁移脚本
- `src/entity/warehouse.entity.ts` - 仓库实体和库存明细实体
- `src/dto/warehouse.dto.ts` - 仓库相关DTO
- `src/service/inventory/warehouse.service.ts` - 仓库服务

### 修改文件
- `src/entity/stock.entity.ts` - 添加warehouse_id字段
- `src/dto/stock.dto.ts` - 添加warehouse_id字段
- `src/service/inventory/stock.service.ts` - 修改入库/出库/盘点逻辑
- `src/routes/inventory.route.ts` - 添加仓库管理路由
- `src/service/inventory/index.ts` - 导出warehouseService

---

## Task 1: 创建数据库迁移脚本

**Files:**
- Create: `sql/migration-warehouse.sql`

- [ ] **Step 1: 创建迁移脚本文件**

```sql
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
    update_time TIMESTAMP,
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
    update_time TIMESTAMP,
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
```

---

## Task 2: 创建仓库实体文件

**Files:**
- Create: `src/entity/warehouse.entity.ts`

- [ ] **Step 1: 创建仓库实体和库存明细实体**

```typescript
import { Entity, Column, PrimaryColumn, Unique } from 'typeorm';

/**
 * 仓库实体
 */
@Entity({ schema: 'inventory', name: 'warehouse' })
export class Warehouse {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    warehouse_id: string;

    @Column({ type: 'varchar', length: 100, comment: '仓库名称' })
    name: string;

    @Column({ type: 'varchar', length: 200, nullable: true, comment: '位置' })
    location: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', nullable: true, comment: '修改时间' })
    update_time: Date;
}

/**
 * 库存明细实体-规格在各仓库的库存
 */
@Entity({ schema: 'inventory', name: 'item_spec_warehouse' })
@Unique('uk_spec_warehouse', ['spec_id', 'warehouse_id'])
export class InventoryItemSpecWarehouse {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    id: string;

    @Column({ type: 'varchar', length: 32, comment: '规格ID' })
    spec_id: string;

    @Column({ type: 'varchar', length: 32, comment: '仓库ID' })
    warehouse_id: string;

    @Column({ type: 'int', default: 0, comment: '该规格在该仓库的库存数量' })
    current_stock: number;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', nullable: true, comment: '修改时间' })
    update_time: Date;
}
```

---

## Task 3: 创建仓库DTO文件

**Files:**
- Create: `src/dto/warehouse.dto.ts`

- [ ] **Step 1: 创建仓库相关DTO**

```typescript
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsInt, Min, IsIn } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateWarehouseDto {
    @IsNotEmpty({ message: '仓库名称不能为空' })
    @MaxLength(100, { message: '仓库名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(200, { message: '位置长度不能超过200' })
    location?: string;
}

export class UpdateWarehouseDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '仓库名称不能为空' })
    @MaxLength(100, { message: '仓库名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(200, { message: '位置长度不能超过200' })
    location?: string;
}

export class DeleteWarehouseDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
}

export class ListWarehouseDto extends PageDto {
    @IsOptional()
    @IsIn([1, 2], { message: '状态必须是1-正常,2-停用' })
    @Type(() => Number)
    status?: number;
}

export class WarehouseIdDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
}

export class AssignSpecWarehouseDto {
    @IsNotEmpty({ message: '规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '分配数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '分配数量必须是整数' })
    @Min(1, { message: '分配数量不能小于1' })
    quantity: number;
}

export class ListSpecWarehouseStockDto {
    @IsNotEmpty({ message: '规格ID不能为空' })
    spec_id: string;
}
```

---

## Task 4: 创建仓库服务文件

**Files:**
- Create: `src/service/inventory/warehouse.service.ts`

- [ ] **Step 1: 创建仓库服务类**

```typescript
import { Warehouse, InventoryItemSpecWarehouse } from '../../entity/warehouse.entity';
import { InventoryItemSpec } from '../../entity/product.entity';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import {
    CreateWarehouseDto, UpdateWarehouseDto, DeleteWarehouseDto,
    ListWarehouseDto, AssignSpecWarehouseDto, ListSpecWarehouseStockDto,
} from '../../dto/warehouse.dto';

export class WarehouseService {
    private warehouseRepository = AppDataSource.getRepository(Warehouse);
    private specWarehouseRepository = AppDataSource.getRepository(InventoryItemSpecWarehouse);
    private specRepository = AppDataSource.getRepository(InventoryItemSpec);
    private logger = getLogger('WAREHOUSE_SERV');

    /**
     * 创建仓库
     */
    async create(dto: CreateWarehouseDto) {
        try {
            const warehouse = new Warehouse();
            warehouse.warehouse_id = v7().replace(/-/g, '');
            warehouse.name = dto.name;
            if (dto.location) {
                warehouse.location = dto.location;
            }
            warehouse.status = 1;
            warehouse.create_time = new Date();

            await this.warehouseRepository.save(warehouse);
            return { result: 0, msg: '创建成功' };
        } catch (error) {
            this.logger.error('创建仓库失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 更新仓库
     */
    async update(dto: UpdateWarehouseDto) {
        try {
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            warehouse.name = dto.name;
            if (dto.location !== undefined) {
                warehouse.location = dto.location;
            }
            warehouse.update_time = new Date();

            await this.warehouseRepository.save(warehouse);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新仓库失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 删除仓库(软删除)
     */
    async delete(dto: DeleteWarehouseDto) {
        try {
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 检查是否存在库存明细
            const stockCount = await this.specWarehouseRepository.count({
                where: { warehouse_id: dto.warehouse_id, current_stock: 0 },
            });
            const hasStock = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .where('sw.warehouse_id = :warehouseId AND sw.current_stock > 0', {
                    warehouseId: dto.warehouse_id,
                })
                .getCount();

            if (hasStock > 0) {
                return { result: 1, msg: '该仓库存在库存，无法删除' };
            }

            warehouse.status = 2;
            warehouse.update_time = new Date();
            await this.warehouseRepository.save(warehouse);

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除仓库失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 查询仓库列表
     */
    async list(dto: ListWarehouseDto) {
        try {
            const queryBuilder = this.warehouseRepository.createQueryBuilder('w')
                .select([
                    'w.warehouse_id AS warehouse_id',
                    'w.name AS name',
                    'w.location AS location',
                    'w.status AS status',
                    'to_char(w.create_time, \'YYYY-MM-DD HH24:MI:SS\') AS create_time',
                    'to_char(w.update_time, \'YYYY-MM-DD HH24:MI:SS\') AS update_time',
                ])
                .where('1=1');

            if (dto.status) {
                queryBuilder.andWhere('w.status = :status', { status: dto.status });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('w.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询仓库列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 分配零件规格到仓库(用于历史数据初始化)
     */
    async assignSpecWarehouse(dto: AssignSpecWarehouseDto) {
        try {
            // 校验规格存在
            const spec = await this.specRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            // 校验仓库存在
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 校验分配数量不超过总库存
            if (dto.quantity > spec.current_stock) {
                return {
                    result: 1,
                    msg: `分配数量(${dto.quantity})超过该规格总库存(${spec.current_stock})`,
                };
            }

            // 查询该规格已分配的总数量
            const assignedTotal = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                .where('sw.spec_id = :specId AND sw.status = 1', { specId: dto.spec_id })
                .getRawOne();

            const assigned = Number(assignedTotal?.total || 0);
            const available = spec.current_stock - assigned;

            if (dto.quantity > available) {
                return {
                    result: 1,
                    msg: `可分配数量不足(总库存:${spec.current_stock}, 已分配:${assigned}, 可分配:${available})`,
                };
            }

            // 查询是否已存在该规格在该仓库的记录
            let specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });

            const now = new Date();

            if (specWarehouse) {
                // 累加库存
                specWarehouse.current_stock += dto.quantity;
                specWarehouse.update_time = now;
                await this.specWarehouseRepository.save(specWarehouse);
            } else {
                // 新建记录
                specWarehouse = new InventoryItemSpecWarehouse();
                specWarehouse.id = v7().replace(/-/g, '');
                specWarehouse.spec_id = dto.spec_id;
                specWarehouse.warehouse_id = dto.warehouse_id;
                specWarehouse.current_stock = dto.quantity;
                specWarehouse.status = 1;
                specWarehouse.create_time = now;
                await this.specWarehouseRepository.save(specWarehouse);
            }

            return { result: 0, msg: '分配成功' };
        } catch (error) {
            this.logger.error('分配零件仓库失败:', error);
            return { result: 1, msg: '分配失败' };
        }
    }

    /**
     * 查询规格在各仓库的库存分布
     */
    async listSpecWarehouseStock(dto: ListSpecWarehouseStockDto) {
        try {
            const spec = await this.specRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            const items = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .leftJoin(Warehouse, 'w', 'w.warehouse_id = sw.warehouse_id')
                .select([
                    'sw.id AS id',
                    'sw.warehouse_id AS warehouse_id',
                    'w.name AS warehouse_name',
                    'w.location AS warehouse_location',
                    'sw.current_stock AS current_stock',
                ])
                .where('sw.spec_id = :specId AND sw.status = 1', { specId: dto.spec_id })
                .orderBy('sw.create_time', 'ASC')
                .getRawMany();

            return { result: 0, msg: 'success', datas: items };
        } catch (error) {
            this.logger.error('查询规格库存分布失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}
```

---

## Task 5: 修改stock实体添加warehouse_id

**Files:**
- Modify: `src/entity/stock.entity.ts`

- [ ] **Step 1: 在StockInRecord实体添加warehouse_id字段**

在 `StockInRecord` 类的 `record_no` 字段后添加：

```typescript
    @Column({ type: 'varchar', length: 32, nullable: true, comment: '入库仓库ID' })
    warehouse_id: string;
```

- [ ] **Step 2: 在StockOutRecord实体添加warehouse_id字段**

在 `StockOutRecord` 类的 `record_no` 字段后添加：

```typescript
    @Column({ type: 'varchar', length: 32, nullable: true, comment: '出库仓库ID' })
    warehouse_id: string;
```

- [ ] **Step 3: 在InventoryCheck实体添加warehouse_id字段**

在 `InventoryCheck` 类的 `record_no` 字段后添加：

```typescript
    @Column({ type: 'varchar', length: 32, nullable: true, comment: '盘点仓库ID' })
    warehouse_id: string;
```

---

## Task 6: 修改stock DTO添加warehouse_id

**Files:**
- Modify: `src/dto/stock.dto.ts`

- [ ] **Step 1: 在StockInDto添加warehouse_id字段**

在 `StockInDto` 类的 `item_id` 字段前添加：

```typescript
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
```

- [ ] **Step 2: 在StockInItemEntryDto添加warehouse_id字段**

在 `StockInItemEntryDto` 类的 `item_id` 字段前添加：

```typescript
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
```

注意：删除 `StockInBatchDto` 中原有的结构，改为：

```typescript
export class StockInItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;
}

export class StockInBatchDto {
    @IsArray({ message: '入库零件列表必须是数组' })
    @IsNotEmpty({ message: '入库零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockInItemEntryDto)
    items: StockInItemEntryDto[];

    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '入库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '入库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}
```

- [ ] **Step 3: 在StockOutDto添加warehouse_id字段**

在 `StockOutDto` 类的 `item_id` 字段前添加：

```typescript
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
```

- [ ] **Step 4: 在StockOutBatchDto添加warehouse_id字段**

在 `StockOutBatchDto` 类中添加 `warehouse_id` 字段：

```typescript
export class StockOutItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '出库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '出库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库数量必须是整数' })
    @Min(1, { message: '出库数量不能小于1' })
    quantity: number;
}

export class StockOutBatchDto {
    @IsArray({ message: '出库零件列表必须是数组' })
    @IsNotEmpty({ message: '出库零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockOutItemEntryDto)
    items: StockOutItemEntryDto[];

    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '出库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}
```

- [ ] **Step 5: 在StockOutByProductDto添加warehouse_id字段**

在 `StockOutByProductDto` 类的 `product_id` 字段前添加：

```typescript
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
```

- [ ] **Step 6: 在StockCheckDto添加warehouse_id字段**

在 `StockCheckDto` 类的 `item_id` 字段前添加：

```typescript
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
```

- [ ] **Step 7: 在StockCheckBatchDto添加warehouse_id字段**

修改 `StockCheckBatchDto` 类：

```typescript
export class StockCheckItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '盘点规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '盘点后库存不能为空' })
    @Type(() => Number)
    @IsInt({ message: '盘点后库存必须是整数' })
    @Min(0, { message: '盘点后库存不能小于0' })
    after_stock: number;
}

export class StockCheckBatchDto {
    @IsArray({ message: '盘点零件列表必须是数组' })
    @IsNotEmpty({ message: '盘点零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockCheckItemEntryDto)
    items: StockCheckItemEntryDto[];

    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '盘点日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '盘点日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}
```

---

## Task 7: 修改stock服务添加仓库逻辑

**Files:**
- Modify: `src/service/inventory/stock.service.ts`

- [ ] **Step 1: 添加仓库相关导入和Repository**

在文件顶部导入后添加：

```typescript
import { Warehouse, InventoryItemSpecWarehouse } from '../../entity/warehouse.entity';
```

在 `StockService` 类中添加 Repository：

```typescript
    private warehouseRepository = AppDataSource.getRepository(Warehouse);
    private specWarehouseRepository = AppDataSource.getRepository(InventoryItemSpecWarehouse);
```

- [ ] **Step 2: 修改stockIn方法**

将 `stockIn` 方法修改为：

```typescript
    /**
     * 入库操作(按零件单个入库)
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
                where: { item_id: dto.item_id, spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                this.logger.error(`零件 ${dto.item_id} 不存在规格 ${dto.spec_id}`);
                return { result: 1, msg: '零件不存在规格' };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const recordNo = await this.generateStockInRecordNo();
            const now = new Date();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            record.warehouse_id = dto.warehouse_id;
            record.quantity = dto.quantity;
            record.before_stock = spec.current_stock;
            record.after_stock = spec.current_stock + dto.quantity;
            record.date = new Date(dto.date);
            if (dto.photo_id) {
                record.photo_id = dto.photo_id;
            }
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.create_time = now;

            const newStock = spec.current_stock + dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockInRecord, record);

                // 更新或创建库存明细
                let specWarehouse = await manager.findOne(InventoryItemSpecWarehouse, {
                    where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
                });
                if (specWarehouse) {
                    specWarehouse.current_stock += dto.quantity;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = dto.spec_id;
                    specWarehouse.warehouse_id = dto.warehouse_id;
                    specWarehouse.current_stock = dto.quantity;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: spec.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            return { result: 0, msg: '入库成功' };
        } catch (error) {
            this.logger.error('入库失败:', error);
            return { result: 1, msg: '入库失败' };
        }
    }
```

- [ ] **Step 3: 修改stockInBatch方法**

修改 `stockInBatch` 方法签名和调用：

```typescript
    /**
     * 批量入库
     */
    async stockInBatch(dto: StockInBatchDto) {
        try {
            const itemSpecs: StockItem[] = dto.items.map((it) => ({
                item_id: it.item_id,
                spec_id: it.spec_id,
                quantity: it.quantity,
            }));
            const validated = await this.validateStockInItems(itemSpecs);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            await this.executeStockIn(itemSpecs, dto.date, dto.warehouse_id, dto.photo_id, dto.remark);
            return { result: 0, msg: '入库成功' };
        } catch (error) {
            this.logger.error('批量入库失败:', error);
            return { result: 1, msg: '入库失败' };
        }
    }
```

- [ ] **Step 4: 修改stockOut方法**

将 `stockOut` 方法修改为：

```typescript
    /**
     * 出库操作(按零件单个出库)
     */
    async stockOut(dto: StockOutDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                this.logger.error(`零件 ${dto.item_id} 不存在规格 ${dto.spec_id}`);
                return { result: 1, msg: `零件不存在规格` };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 校验该仓库中该规格库存
            const specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!specWarehouse || specWarehouse.current_stock < dto.quantity) {
                const currentStock = specWarehouse?.current_stock || 0;
                return {
                    result: 1,
                    msg: `该仓库规格库存不足(当前 ${currentStock}, 需要 ${dto.quantity})`,
                };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const now = new Date();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            record.warehouse_id = dto.warehouse_id;
            record.quantity = dto.quantity;
            record.before_stock = spec.current_stock;
            record.after_stock = spec.current_stock - dto.quantity;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
            record.create_time = now;

            const newStock = spec.current_stock - dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockOutRecord, record);

                // 更新库存明细
                specWarehouse.current_stock -= dto.quantity;
                specWarehouse.update_time = now;
                await manager.save(InventoryItemSpecWarehouse, specWarehouse);

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: dto.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }
```

- [ ] **Step 5: 修改stockOutBatch方法**

修改 `stockOutBatch` 方法：

```typescript
    /**
     * 按零件批量出库(同一 record_no)
     */
    async stockOutBatch(dto: StockOutBatchDto) {
        try {
            const itemSpecs: StockItem[] = dto.items.map((it) => ({
                item_id: it.item_id,
                spec_id: it.spec_id,
                quantity: it.quantity,
            }));

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const validated = await this.validateStockOutItems(itemSpecs, dto.warehouse_id);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockOut(itemSpecs, dto.date, dto.warehouse_id, dto.remark);
            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('批量出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }
```

- [ ] **Step 6: 修改stockOutByProduct方法**

修改 `stockOutByProduct` 方法：

```typescript
    /**
     * 按产品出库(按 BOM 扣减,同一 record_no)
     * 出库数量 = 产品台数 quantity × BOM quantity_per_product
     */
    async stockOutByProduct(dto: StockOutByProductDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const bomRows = await this.productItemRepository
                .createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id AND i.status = 1')
                .select([
                    'pi.item_id AS item_id',
                    'pi.spec_id AS spec_id',
                    'pi.quantity_per_product AS quantity_per_product'
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .getRawMany();

            if (bomRows.length === 0) {
                return { result: 1, msg: '产品未配置零件' };
            }

            const itemSpecs: StockItem[] = bomRows.map((row: {
                item_id: string;
                spec_id: string;
                quantity_per_product: number;
            }) => ({
                item_id: row.item_id,
                spec_id: row.spec_id,
                quantity: Number(row.quantity_per_product) * dto.quantity,
            }));

            const validated = await this.validateStockOutItems(itemSpecs, dto.warehouse_id);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockOut(itemSpecs, dto.date, dto.warehouse_id, dto.remark);
            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('按产品出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }
```

- [ ] **Step 7: 修改stockCheck方法**

将 `stockCheck` 方法修改为：

```typescript
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
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 获取该仓库该规格的库存
            let specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });
            const beforeStock = specWarehouse?.current_stock || 0;

            const recordNo = await this.generateStockCheckRecordNo();
            const now = new Date();
            const checkRecord = new InventoryCheck();
            checkRecord.check_id = v7().replace(/-/g, '');
            checkRecord.record_no = recordNo;
            checkRecord.item_id = dto.item_id;
            checkRecord.spec_id = spec.spec_id;
            checkRecord.warehouse_id = dto.warehouse_id;
            checkRecord.before_stock = beforeStock;
            checkRecord.after_stock = dto.after_stock;
            checkRecord.date = new Date(dto.date);
            if (dto.remark) {
                checkRecord.remark = dto.remark;
            }

            // 计算其他仓库的库存总和
            const otherWarehousesStock = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                .where('sw.spec_id = :specId AND sw.warehouse_id != :warehouseId AND sw.status = 1', {
                    specId: dto.spec_id,
                    warehouseId: dto.warehouse_id,
                })
                .getRawOne();

            const otherStock = Number(otherWarehousesStock?.total || 0);
            const newTotalStock = otherStock + dto.after_stock;

            await this.inventoryCheckRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryCheck, checkRecord);

                // 更新或创建库存明细
                if (specWarehouse) {
                    specWarehouse.current_stock = dto.after_stock;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = dto.spec_id;
                    specWarehouse.warehouse_id = dto.warehouse_id;
                    specWarehouse.current_stock = dto.after_stock;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(InventoryItemSpec,
                    { spec_id: spec.spec_id }, {
                    current_stock: newTotalStock, update_time: now
                });
            });

            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('盘点失败:', error);
            return { result: 1, msg: '盘点失败' };
        }
    }
```

- [ ] **Step 8: 修改stockCheckBatch方法**

修改 `stockCheckBatch` 方法：

```typescript
    /**
     * 批量盘点
     */
    async stockCheckBatch(dto: StockCheckBatchDto) {
        try {
            const checkItems: CheckItem[] = [];
            for (const itemEntry of dto.items) {
                checkItems.push({
                    item_id: itemEntry.item_id,
                    spec_id: itemEntry.spec_id,
                    after_stock: itemEntry.after_stock,
                });
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const validated = await this.validateStockCheckItems(checkItems, dto.warehouse_id);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockCheck(checkItems, dto.date, dto.warehouse_id, dto.remark);
            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('批量盘点失败:', error);
            return { result: 1, msg: '盘点失败' };
        }
    }
```

- [ ] **Step 9: 修改validateStockOutItems方法**

修改 `validateStockOutItems` 方法，添加仓库参数：

```typescript
    /**
     * 校验出库明细(设备件、BOM 关联、库存充足)
     */
    private async validateStockOutItems(itemSpecs: StockItem[], warehouseId: string) {
        const keys = itemSpecs.map((l) => `${l.item_id}||${l.spec_id}`);
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '出库列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(itemSpecs.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
            .getMany();
        const itemMap = new Map(items.map((i) => [i.item_id, i]));
        if (items.length !== itemIds.length) {
            const missing = itemIds.filter((id) => !itemMap.has(id));
            this.logger.error(`零件不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `零件不存在或已停用: ${missing.join(',')}` };
        }

        const specIds = itemSpecs.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specMap = new Map(specs.map((s) => [`${s.item_id}||${s.spec_id}`, s]));

        // 获取该仓库的库存明细
        const specWarehouses = await this.specWarehouseRepository
            .createQueryBuilder('sw')
            .where('sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1', {
                specIds,
                warehouseId,
            })
            .getMany();
        const specWarehouseMap = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));

        for (const itemSpec of itemSpecs) {
            const spec = specMap.get(`${itemSpec.item_id}||${itemSpec.spec_id}`);
            if (!spec) {
                this.logger.error(`零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}`);
                return { ok: false, msg: `零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}` };
            }

            const specWarehouse = specWarehouseMap.get(itemSpec.spec_id);
            if (!specWarehouse || specWarehouse.current_stock < itemSpec.quantity) {
                const currentStock = specWarehouse?.current_stock || 0;
                this.logger.error(`该仓库规格 ${spec.spec} 库存不足(当前 ${currentStock},需要 ${itemSpec.quantity})`);
                return {
                    ok: false,
                    msg: `该仓库规格 ${spec.spec} 库存不足(当前 ${currentStock},需要 ${itemSpec.quantity})`,
                };
            }
        }

        return { ok: true, specMap, specWarehouseMap };
    }
```

- [ ] **Step 10: 修改executeStockIn方法**

修改 `executeStockIn` 方法，添加仓库参数：

```typescript
    /**
     * 执行入库(同一批次共用 record_no,事务原子)
     */
    private async executeStockIn(itemSpecs: StockItem[], date: string, warehouseId: string, photoId: string, remark?: string) {
        const recordNo = await this.generateStockInRecordNo();
        const now = new Date();
        const inDate = new Date(date);
        const stockDelta = new Map<string, number>();

        for (const itemSpec of itemSpecs) {
            const prev = stockDelta.get(itemSpec.spec_id) ?? 0;
            stockDelta.set(itemSpec.spec_id, prev + itemSpec.quantity);
        }

        const specIds = [...stockDelta.keys()];
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specById = new Map(specs.map((s) => [s.spec_id, s]));

        // 获取该仓库的库存明细
        const specWarehouses = await this.specWarehouseRepository
            .createQueryBuilder('sw')
            .where('sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1', {
                specIds,
                warehouseId,
            })
            .getMany();
        const specWarehouseBySpec = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));

        await this.stockInRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const spec = specById.get(itemSpec.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${itemSpec.spec_id} 未找到`);
                }
                const record = new StockInRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                record.warehouse_id = warehouseId;
                record.quantity = itemSpec.quantity;
                record.before_stock = spec.current_stock;
                record.after_stock = spec.current_stock + itemSpec.quantity;
                record.date = inDate;
                if (photoId) {
                    record.photo_id = photoId;
                }
                if (remark) {
                    record.remark = remark;
                }
                record.create_time = now;
                await manager.save(StockInRecord, record);
            }

            // 更新库存明细
            for (const [specId, add] of stockDelta) {
                const spec = specById.get(specId);
                if (!spec) {
                    throw new Error(`规格 ${specId} 未找到`);
                }

                let specWarehouse = specWarehouseBySpec.get(specId);
                if (specWarehouse) {
                    specWarehouse.current_stock += add;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = specId;
                    specWarehouse.warehouse_id = warehouseId;
                    specWarehouse.current_stock = add;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: specId },
                    { current_stock: spec.current_stock + add, update_time: now }
                );
            }
        });
    }
```

- [ ] **Step 11: 修改executeStockOut方法**

修改 `executeStockOut` 方法，添加仓库参数：

```typescript
    /**
     * 执行出库(同一批次共用 record_no,事务原子)
     */
    private async executeStockOut(itemSpecs: StockItem[], date: string, warehouseId: string, remark?: string) {
        const recordNo = await this.generateStockOutRecordNo();
        const now = new Date();
        const outDate = new Date(date);
        const stockDelta = new Map<string, number>();

        for (const itemSpec of itemSpecs) {
            const prev = stockDelta.get(itemSpec.spec_id) ?? 0;
            stockDelta.set(itemSpec.spec_id, prev + itemSpec.quantity);
        }

        const specIds = [...stockDelta.keys()];
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specById = new Map(specs.map((s) => [s.spec_id, s]));

        // 获取该仓库的库存明细
        const specWarehouses = await this.specWarehouseRepository
            .createQueryBuilder('sw')
            .where('sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1', {
                specIds,
                warehouseId,
            })
            .getMany();
        const specWarehouseBySpec = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));

        await this.stockOutRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const spec = specById.get(itemSpec.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${itemSpec.spec_id} 未找到`);
                }

                const specWarehouse = specWarehouseBySpec.get(itemSpec.spec_id);
                if (!specWarehouse) {
                    throw new Error(`规格 ${itemSpec.spec_id} 在该仓库无库存`);
                }

                const record = new StockOutRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                record.warehouse_id = warehouseId;
                record.quantity = itemSpec.quantity;
                record.before_stock = spec.current_stock;
                record.after_stock = spec.current_stock - itemSpec.quantity;
                record.date = outDate;
                if (remark) {
                    record.remark = remark;
                }
                record.status = 1;
                record.create_time = now;
                await manager.save(StockOutRecord, record);
            }

            // 更新库存明细和总库存
            for (const [specId, deduct] of stockDelta) {
                const spec = specById.get(specId);
                if (!spec) {
                    throw new Error(`规格 ${specId} 未找到`);
                }

                const specWarehouse = specWarehouseBySpec.get(specId);
                if (!specWarehouse) {
                    throw new Error(`规格 ${specId} 在该仓库无库存`);
                }

                specWarehouse.current_stock -= deduct;
                specWarehouse.update_time = now;
                await manager.save(InventoryItemSpecWarehouse, specWarehouse);

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: specId },
                    { current_stock: spec.current_stock - deduct, update_time: now }
                );
            }
        });
    }
```

- [ ] **Step 12: 修改validateStockCheckItems方法**

修改 `validateStockCheckItems` 方法，添加仓库参数：

```typescript
    /**
     * 校验盘点明细(零件、规格)
     */
    private async validateStockCheckItems(checkItems: CheckItem[], warehouseId: string) {
        const keys = checkItems.map((l) => `${l.item_id}||${l.spec_id}`);
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '盘点列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(checkItems.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
            .getMany();
        const itemMap = new Map(items.map((i) => [i.item_id, i]));
        if (items.length !== itemIds.length) {
            const missing = itemIds.filter((id) => !itemMap.has(id));
            this.logger.error(`零件不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `零件不存在或已停用: ${missing.join(',')}` };
        }

        const specIds = checkItems.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specMap = new Map(specs.map((s) => [`${s.item_id}||${s.spec_id}`, s]));

        for (const checkItem of checkItems) {
            const spec = specMap.get(`${checkItem.item_id}||${checkItem.spec_id}`);
            if (!spec) {
                this.logger.error(`零件 ${checkItem.item_id} 不存在规格 ${checkItem.spec_id}`);
                return { ok: false, msg: `零件 ${checkItem.item_id} 不存在规格 ${checkItem.spec_id}` };
            }
        }

        return { ok: true, specMap };
    }
```

- [ ] **Step 13: 修改executeStockCheck方法**

修改 `executeStockCheck` 方法，添加仓库参数：

```typescript
    /**
     * 执行盘点(事务原子)
     */
    private async executeStockCheck(checkItems: CheckItem[], date: string, warehouseId: string, remark?: string) {
        const specIds = checkItems.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specById = new Map(specs.map((s) => [s.spec_id, s]));

        // 获取该仓库的库存明细
        const specWarehouses = await this.specWarehouseRepository
            .createQueryBuilder('sw')
            .where('sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1', {
                specIds,
                warehouseId,
            })
            .getMany();
        const specWarehouseBySpec = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));

        const now = new Date();
        const checkDate = new Date(date);
        const recordNo = await this.generateStockCheckRecordNo();

        await this.inventoryCheckRepository.manager.transaction(async (manager) => {
            for (const checkItem of checkItems) {
                const spec = specById.get(checkItem.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${checkItem.spec_id} 未找到`);
                }

                let specWarehouse = specWarehouseBySpec.get(checkItem.spec_id);
                const beforeStock = specWarehouse?.current_stock || 0;

                // 计算其他仓库的库存总和
                const otherWarehousesStock = await this.specWarehouseRepository
                    .createQueryBuilder('sw')
                    .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                    .where('sw.spec_id = :specId AND sw.warehouse_id != :warehouseId AND sw.status = 1', {
                        specId: checkItem.spec_id,
                        warehouseId,
                    })
                    .getRawOne();

                const otherStock = Number(otherWarehousesStock?.total || 0);
                const newTotalStock = otherStock + checkItem.after_stock;

                const checkRecord = new InventoryCheck();
                checkRecord.check_id = v7().replace(/-/g, '');
                checkRecord.record_no = recordNo;
                checkRecord.item_id = checkItem.item_id;
                checkRecord.spec_id = spec.spec_id;
                checkRecord.warehouse_id = warehouseId;
                checkRecord.before_stock = beforeStock;
                checkRecord.after_stock = checkItem.after_stock;
                checkRecord.date = checkDate;
                if (remark) {
                    checkRecord.remark = remark;
                }

                await manager.save(InventoryCheck, checkRecord);

                // 更新或创建库存明细
                if (specWarehouse) {
                    specWarehouse.current_stock = checkItem.after_stock;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = checkItem.spec_id;
                    specWarehouse.warehouse_id = warehouseId;
                    specWarehouse.current_stock = checkItem.after_stock;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: spec.spec_id },
                    { current_stock: newTotalStock, update_time: now }
                );
            }
        });
    }
```

---

## Task 8: 添加仓库管理路由

**Files:**
- Modify: `src/routes/inventory.route.ts`

- [ ] **Step 1: 添加仓库相关导入**

在文件顶部导入中添加：

```typescript
import {
    CreateWarehouseDto, UpdateWarehouseDto, DeleteWarehouseDto, ListWarehouseDto,
    AssignSpecWarehouseDto, ListSpecWarehouseStockDto, WarehouseIdDto,
} from '../dto/warehouse.dto';
import { warehouseService } from '../service/inventory';
```

- [ ] **Step 2: 在文件末尾添加仓库管理路由**

在 `export default router;` 前添加：

```typescript
// ============ 仓库管理 ============

// 查询仓库列表
router.get('/listWarehouses',
    validationMiddleware(ListWarehouseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListWarehouseDto, req.query);
        const result = await warehouseService.list(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 创建仓库
router.post('/createWarehouse',
    validationMiddleware(CreateWarehouseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(CreateWarehouseDto, req.body);
        const result = await warehouseService.create(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 更新仓库
router.post('/updateWarehouse',
    validationMiddleware(UpdateWarehouseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateWarehouseDto, req.body);
        const result = await warehouseService.update(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 删除仓库
router.post('/deleteWarehouse',
    validationMiddleware(DeleteWarehouseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(DeleteWarehouseDto, req.body);
        const result = await warehouseService.delete(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 分配零件仓库
router.post('/assignSpecWarehouse',
    validationMiddleware(AssignSpecWarehouseDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(AssignSpecWarehouseDto, req.body);
        const result = await warehouseService.assignSpecWarehouse(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询规格库存明细
router.get('/listSpecWarehouseStock',
    validationMiddleware(ListSpecWarehouseStockDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListSpecWarehouseStockDto, req.query);
        const result = await warehouseService.listSpecWarehouseStock(dtoObj);
        res.locals.datas = result;
        next();
    })
);
```

---

## Task 9: 导出仓库服务

**Files:**
- Modify: `src/service/inventory/index.ts`

- [ ] **Step 1: 添加WarehouseService导入和导出**

修改文件为：

```typescript
import { ProductService } from './product.service';
import { InventoryItemService } from './item.service';
import { StockService } from './stock.service';
import { ItemTypeService } from './itemType.service';
import { WarehouseService } from './warehouse.service';

// 创建服务单例
const productService = new ProductService();
const inventoryItemService = new InventoryItemService();
const stockService = new StockService();
const itemTypeService = new ItemTypeService();
const warehouseService = new WarehouseService();

export { productService, inventoryItemService, stockService, itemTypeService, warehouseService };
```

---

## Task 10: 运行数据库迁移

**Files:**
- None

- [ ] **Step 1: 执行迁移脚本**

运行以下命令连接数据库并执行迁移脚本：

```bash
# 连接PostgreSQL执行迁移脚本
psql -U <用户名> -d <数据库名> -f sql/migration-warehouse.sql
```

或者手动在数据库管理工具中执行 `sql/migration-warehouse.sql` 的内容。

---

## 成功标准

- [ ] 数据库迁移脚本执行成功，仓库表和库存明细表创建完成
- [ ] 仓库的增删改查功能正常
- [ ] 入库/出库/盘点接口必须指定仓库
- [ ] 同一规格在不同仓库有独立库存
- [ ] 删除有库存的仓库时正确提示错误
- [ ] 分配零件仓库接口正常工作
- [ ] 查询规格库存明细接口正常工作
