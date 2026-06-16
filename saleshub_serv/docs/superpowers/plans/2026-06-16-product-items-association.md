# 产品-库存件关联表改造 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `inventory_items.product_id` 直接外键改造为独立的 `inventory.product_items` 关联表（M:N），并在 `ProductService` 新增 `setProductItems` 与 `getProductItems` 接口。

**Architecture:** 新增 TypeORM 实体 `ProductItem` 描述关联表；`ProductService` 内置 `productItemRepository`，提供事务化的全量覆盖语义；`StockService.stockOut` 改为通过关联表校验产品归属；SQL 走增量迁移脚本。

**Tech Stack:** TypeScript + Express + TypeORM + PostgreSQL + class-validator/class-transformer。

**Spec:** `docs/superpowers/specs/2026-06-16-product-items-association-design.md`

**测试说明：** 本项目目前未给 service 层写单元测试，本计划沿用此约定，以 `pnpm run typecheck` 与 `pnpm run lint` 作为质量门，最后做手工 API 冒烟。

---

## 文件总览

| 文件 | 操作 | 责任 |
|---|---|---|
| `src/entity/product.entity.ts` | 修改 | 删除 `InventoryItem.product_id`；新增 `ProductItem` 实体 |
| `sql/migration-product-items.sql` | 新建 | 创建关联表 + 删除旧列的增量迁移 |
| `src/dto/product.dto.ts` | 修改 | 新增 `ProductItemEntryDto`、`SetProductItemsDto`、`ProductItemIdDto` |
| `src/dto/item.dto.ts` | 修改 | 移除 `ListInventoryItemDto.product_id` 字段 |
| `src/service/inventory/product.service.ts` | 修改 | 新增 `productItemRepository`、`setProductItems`、`getProductItems` |
| `src/service/inventory/stock.service.ts` | 修改 | `stockOut` 改用关联表校验 |
| `src/service/inventory/item.service.ts` | 修改 | `list` 移除 `product_id` 字段处理 |
| `src/routes/inventory.route.ts` | 修改 | 新增 `POST /setProductItems`、`GET /listProductItems` |

---

### Task 1: 实体层改造

**Files:**
- Modify: `src/entity/product.entity.ts`

- [ ] **Step 1.1: 删除 InventoryItem 的 product_id 字段**

打开 `src/entity/product.entity.ts`，定位到 `InventoryItem` 类（约 27-61 行），删除其中的 `product_id` 列定义：

```typescript
// 删除以下整段（注释行也要删）
@Column({ type: 'varchar', length: 32, nullable: true, comment: '关联产品ID（仅设备件）' })
product_id: string;
```

- [ ] **Step 1.2: 新增 ProductItem 实体**

在 `src/entity/product.entity.ts` 文件末尾追加：

```typescript
@Entity({ schema: 'inventory', name: 'product_items' })
export class ProductItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    product_item_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '库存件ID' })
    item_id: string;

    @Column({ type: 'int', default: 1, comment: '单台产品所需数量' })
    quantity_per_product: number;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- [ ] **Step 1.3: TypeCheck**

Run: `pnpm run typecheck`
Expected: PASS（无错误；如果有报错说明 `product_id` 还被其他文件引用，记下报错位置以便后续任务修复）

- [ ] **Step 1.4: Commit**

```bash
git add src/entity/product.entity.ts
git commit -m "$(cat <<'EOF'
重构: 产品-库存件关联改为独立关联表(实体层)

## 主要变更

### 1. 实体结构调整
- InventoryItem 实体移除 product_id 字段,产品归属关系迁移到独立关联表
- 新增 ProductItem 实体,描述 product_items 关联表(product_id, item_id, quantity_per_product, remark, status, 时间戳)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: SQL 迁移脚本

**Files:**
- Create: `sql/migration-product-items.sql`

- [ ] **Step 2.1: 创建迁移脚本**

新建 `sql/migration-product-items.sql`，内容：

```sql
-- ============================================
-- 产品-库存件关联表迁移脚本
-- 版本: 1.1
-- 创建日期: 2026-06-16
-- 改动说明:
--   1. 新增 inventory.product_items 关联表(M:N)
--   2. 删除 inventory.inventory_items.product_id 列及相关外键/索引
-- 依赖: 先执行 create-inventory-schema.sql v1.0
-- ============================================

-- ============================================
-- 1. 创建关联表 product_items
-- ============================================
CREATE TABLE IF NOT EXISTS inventory.product_items (
    product_item_id VARCHAR(32) NOT NULL,
    product_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    quantity_per_product INT NOT NULL DEFAULT 1,
    remark TEXT,
    status INT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_product_items PRIMARY KEY (product_item_id),
    CONSTRAINT uk_product_items_product_item UNIQUE (product_id, item_id),
    CONSTRAINT chk_product_items_status CHECK (status IN (1, 2)),
    CONSTRAINT fk_product_items_product FOREIGN KEY (product_id)
        REFERENCES inventory.products(product_id),
    CONSTRAINT fk_product_items_item FOREIGN KEY (item_id)
        REFERENCES inventory.inventory_items(item_id)
);

COMMENT ON TABLE inventory.product_items IS '产品-库存件关联表(BOM)';
COMMENT ON COLUMN inventory.product_items.product_item_id IS '关联主键ID';
COMMENT ON COLUMN inventory.product_items.product_id IS '产品ID';
COMMENT ON COLUMN inventory.product_items.item_id IS '库存件ID';
COMMENT ON COLUMN inventory.product_items.quantity_per_product IS '单台产品所需数量';
COMMENT ON COLUMN inventory.product_items.remark IS '备注';
COMMENT ON COLUMN inventory.product_items.status IS '状态：1-正常，2-停用';
COMMENT ON COLUMN inventory.product_items.create_time IS '创建时间';
COMMENT ON COLUMN inventory.product_items.update_time IS '更新时间';

-- ============================================
-- 2. 删除 inventory_items.product_id 及相关对象
-- ============================================
ALTER TABLE inventory.inventory_items DROP CONSTRAINT IF EXISTS fk_inventory_items_product;
DROP INDEX IF EXISTS inventory.idx_inventory_items_product_id;
ALTER TABLE inventory.inventory_items DROP COLUMN IF EXISTS product_id;

-- ============================================
-- 3. 关联表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON inventory.product_items(product_id);
COMMENT ON INDEX inventory.idx_product_items_product_id IS '产品ID索引';
CREATE INDEX IF NOT EXISTS idx_product_items_item_id ON inventory.product_items(item_id);
COMMENT ON INDEX inventory.idx_product_items_item_id IS '库存件ID索引';
CREATE INDEX IF NOT EXISTS idx_product_items_status ON inventory.product_items(status);
COMMENT ON INDEX inventory.idx_product_items_status IS '关联状态索引';
```

- [ ] **Step 2.2: Commit**

```bash
git add sql/migration-product-items.sql
git commit -m "$(cat <<'EOF'
新增: 产品-库存件关联表迁移脚本

## 主要变更

### 1. SQL 增量迁移
- 新增 sql/migration-product-items.sql,创建 inventory.product_items 关联表
- 脚本同时清理 inventory_items.product_id 列、外键、索引
- 增加 product_items 表的索引与字段注释

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: DTO 改造

**Files:**
- Modify: `src/dto/product.dto.ts`
- Modify: `src/dto/item.dto.ts`

- [ ] **Step 3.1: 在 product.dto.ts 新增关联相关 DTO**

打开 `src/dto/product.dto.ts`，在顶部 import 行替换为：

```typescript
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { PageDto } from './base.dto';
```

在文件末尾追加：

```typescript
export class ProductItemEntryDto {
    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: '单台数量不能小于1' })
    quantity_per_product?: number;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class SetProductItemsDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsArray({ message: '库存件列表必须是数组' })
    @IsNotEmpty({ message: '库存件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => ProductItemEntryDto)
    items: ProductItemEntryDto[];
}

export class ProductItemIdDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}
```

注意：`PageDto` 在原文件已导入；`ValidateNested`、`IsArray`、`IsInt`、`Min` 是 class-validator 新增的导入；`Type` 是 class-transformer 新增的导入。

- [ ] **Step 3.2: 在 item.dto.ts 移除 product_id 字段**

打开 `src/dto/item.dto.ts`，删除 `ListInventoryItemDto` 中的 `product_id` 字段：

```typescript
// 删除以下两行
@IsOptional()
product_id: string;
```

- [ ] **Step 3.3: TypeCheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3.4: Commit**

```bash
git add src/dto/product.dto.ts src/dto/item.dto.ts
git commit -m "$(cat <<'EOF'
新增: 产品库存件关联 DTO

## 主要变更

### 1. product.dto.ts
- 新增 ProductItemEntryDto(单条关联: item_id/quantity_per_product/remark)
- 新增 SetProductItemsDto(全量覆盖语义: product_id + items[])
- 新增 ProductItemIdDto(查询产品库存件用)

### 2. item.dto.ts
- ListInventoryItemDto 移除 product_id 字段(关系已迁移到关联表)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ProductService 实现关联接口

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 4.1: 更新 import**

打开 `src/service/inventory/product.service.ts`，将顶部 import 替换为：

```typescript
import { Product, ProductItem, InventoryItem } from '../../entity/product.entity';
import {
    CreateProductDto,
    ProductIdDto,
    ListProductDto,
    UpdateProductDto,
    SetProductItemsDto,
    ProductItemIdDto,
} from '../../dto/product.dto';
import { AppDataSource } from '../data.source';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
```

- [ ] **Step 4.2: 新增 Repository**

在 `ProductService` 类内，紧接现有 `private logger = getLogger('INVENTORY_SERV');` 之后新增：

```typescript
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
```

- [ ] **Step 4.3: 实现 setProductItems 方法**

在 `generateProductCode` 私有方法之前（即 `delete` 方法之后），插入：

```typescript
    /**
     * 设置产品库存件(全量覆盖语义)
     * 传入 product_id 与完整 item 列表,使产品的有效关联(status=1)等于列表
     */
    async setProductItems(dto: SetProductItemsDto) {
        try {
            // 1. 校验产品存在
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在', alg: '', datas: null };
            }

            // 2. 校验 item_id 唯一性
            const itemIds = dto.items.map((it) => it.item_id);
            const dedup = new Set(itemIds);
            if (dedup.size !== itemIds.length) {
                return { result: 1, msg: '库存件列表存在重复项', alg: '', datas: null };
            }

            // 3. 校验库存件存在且正常
            const items = await this.inventoryItemRepository
                .createQueryBuilder('item')
                .where('item.item_id IN (:...ids) AND item.status = :status', {
                    ids: itemIds,
                    status: 1,
                })
                .getMany();
            if (items.length !== itemIds.length) {
                const found = new Set(items.map((i) => i.item_id));
                const missing = itemIds.filter((id) => !found.has(id));
                return {
                    result: 1,
                    msg: `库存件不存在或已停用: ${missing.join(',')}`,
                    alg: '',
                    datas: null,
                };
            }

            // 4. 查询当前产品所有关联(含软删除),按 item_id 索引
            const existing = await this.productItemRepository
                .createQueryBuilder('pi')
                .where('pi.product_id = :productId', { productId: dto.product_id })
                .getMany();
            const existingMap = new Map(existing.map((row) => [row.item_id, row]));

            // 5. 差分计算
            const now = new Date();
            const toUpdate: ProductItem[] = [];
            const toInsert: ProductItem[] = [];
            const toDeactivate: ProductItem[] = [];
            const incomingIds = new Set(itemIds);

            for (const entry of dto.items) {
                const row = existingMap.get(entry.item_id);
                if (row) {
                    row.quantity_per_product = entry.quantity_per_product ?? 1;
                    row.remark = entry.remark ?? null;
                    row.status = 1;
                    row.update_time = now;
                    toUpdate.push(row);
                } else {
                    const fresh = new ProductItem();
                    fresh.product_item_id = v7().replace(/-/g, '');
                    fresh.product_id = dto.product_id;
                    fresh.item_id = entry.item_id;
                    fresh.quantity_per_product = entry.quantity_per_product ?? 1;
                    fresh.remark = entry.remark ?? null;
                    fresh.status = 1;
                    fresh.create_time = now;
                    fresh.update_time = now;
                    toInsert.push(fresh);
                }
            }

            for (const row of existing) {
                if (!incomingIds.has(row.item_id) && row.status === 1) {
                    row.status = 2;
                    row.update_time = now;
                    toDeactivate.push(row);
                }
            }

            // 6. 事务执行
            await AppDataSource.transaction(async (manager) => {
                if (toInsert.length > 0) {
                    await manager.save(ProductItem, toInsert);
                }
                if (toUpdate.length > 0) {
                    await manager.save(ProductItem, toUpdate);
                }
                if (toDeactivate.length > 0) {
                    await manager.save(ProductItem, toDeactivate);
                }
            });

            this.logger.info('设置产品库存件成功:', {
                productId: dto.product_id,
                insert: toInsert.length,
                update: toUpdate.length,
                deactivate: toDeactivate.length,
            });

            return {
                result: 0,
                msg: '设置成功',
                alg: '',
                datas: { product_id: dto.product_id, count: dto.items.length },
            };
        } catch (error) {
            this.logger.error('设置产品库存件失败:', error);
            return { result: 1, msg: '设置失败', alg: '', datas: null };
        }
    }

    /**
     * 查询产品的库存件列表(含库存件详情)
     */
    async getProductItems(product_id: string) {
        try {
            const rows = await this.productItemRepository
                .createQueryBuilder('pi')
                .innerJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .select([
                    'pi.product_item_id AS product_item_id',
                    'pi.product_id AS product_id',
                    'pi.item_id AS item_id',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.remark AS remark',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'i.type AS item_type',
                    'i.current_stock AS current_stock',
                    'i.warn_stock AS warn_stock',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: product_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            return { result: 0, msg: 'success', alg: '', datas: { items: rows } };
        } catch (error) {
            this.logger.error('查询产品库存件失败:', error);
            return { result: 1, msg: '查询失败', alg: '', datas: null };
        }
    }
```

**注意**：`AppDataSource.transaction` 是 TypeORM 标准 API。但当前 `src/service/data.source.ts` 是占位实现（`getRepository` 返回 null）。如果当前项目运行环境尚未接入真实 DataSource，编译期不会报错（TypeScript 类型用 `any`），但运行时会抛错。这属于项目已有的占位行为，本任务不修复。如果你需要让该接口真实可运行，请在 data.source.ts 接入 TypeORM `DataSource` —— 这超出本计划范围。

- [ ] **Step 4.4: TypeCheck**

Run: `pnpm run typecheck`
Expected: PASS（若报 `AppDataSource.transaction` 不存在，说明占位实现没有该静态方法；将 `AppDataSource.transaction` 改为 `this.productItemRepository.manager.transaction` 并把内部 `manager.save` 改为对应形式即可。如果还是报错，记下错误信息暂停咨询。）

- [ ] **Step 4.5: Commit**

```bash
git add src/service/inventory/product.service.ts
git commit -m "$(cat <<'EOF'
新增: 产品库存件关联接口(setProductItems/getProductItems)

## 主要变更

### 1. setProductItems 接口
- 接收 product_id 与 items 列表,执行全量覆盖
- 校验产品存在、item 列表无重复、item 全部存在且未停用
- 在事务中按差分执行:交集 UPDATE、新项 INSERT、移除项 status=2(软删除)
- 复活场景:原本 status=2 的关联再次出现会被 UPDATE 回 status=1

### 2. getProductItems 接口
- 返回产品当前有效关联(status=1),JOIN inventory_items 取详情
- 字段含 product_item_id、quantity_per_product、item_name/code/type/stock 等

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: StockService.stockOut 校验调整

**Files:**
- Modify: `src/service/inventory/stock.service.ts`

- [ ] **Step 5.1: 更新 import**

打开 `src/service/inventory/stock.service.ts`，将顶部 entity import 替换为：

```typescript
import { InventoryItem, ProductItem } from '../../entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/stock.entity';
```

- [ ] **Step 5.2: 新增 productItemRepository**

在 `StockService` 类内，紧跟现有 `private inventoryCheckRepository: Repository<InventoryCheck>;` 之后追加：

```typescript
    private productItemRepository: Repository<ProductItem>;
```

在 constructor 内，紧跟 `this.inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);` 之后追加：

```typescript
        this.productItemRepository = AppDataSource.getRepository(ProductItem);
```

- [ ] **Step 5.3: 替换 stockOut 中的 product_id 校验**

定位到 `stockOut` 方法内的这段（约 113-120 行）：

```typescript
            if (item.product_id !== dto.productId) {
                return {
                    result: 1,
                    msg: '产品ID不匹配',
                    alg: '',
                    datas: null,
                };
            }
```

替换为：

```typescript
            const rel = await this.productItemRepository.findOne({
                where: { product_id: dto.productId, item_id: dto.itemId, status: 1 },
            });
            if (!rel) {
                return {
                    result: 1,
                    msg: '该库存件未关联到此产品',
                    alg: '',
                    datas: null,
                };
            }
```

- [ ] **Step 5.4: TypeCheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5.5: Commit**

```bash
git add src/service/inventory/stock.service.ts
git commit -m "$(cat <<'EOF'
修改: stockOut 改用关联表校验产品归属

## 主要变更

### 1. StockService
- 新增 productItemRepository 依赖
- stockOut 中的 item.product_id 内存比较改为查询 product_items 表
- 未关联到 dto.productId 的库存件不允许出库

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: InventoryItemService.list 字段清理

**Files:**
- Modify: `src/service/inventory/item.service.ts`

- [ ] **Step 6.1: 删除 SELECT 中的 product_id**

定位到 `list` 方法的 `.select([...])` 调用（约 44-53 行），从数组中删除这一行：

```typescript
                    'item.product_id as product_id',
```

- [ ] **Step 6.2: 删除 WHERE 中的 product_id 过滤**

定位到 `list` 方法中的这段（约 65-67 行），整段删除：

```typescript
            if (dto.product_id) {
                queryBuilder.andWhere('item.product_id = :product_id', { product_id: dto.product_id });
            }
```

- [ ] **Step 6.3: TypeCheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 6.4: Commit**

```bash
git add src/service/inventory/item.service.ts
git commit -m "$(cat <<'EOF'
修改: listItems 移除 product_id 字段处理

## 主要变更

### 1. InventoryItemService.list
- SELECT 与 WHERE 子句删除 product_id 相关代码
- 按产品筛选库存件的能力改由 getProductItems 接口提供

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 路由层接入

**Files:**
- Modify: `src/routes/inventory.route.ts`

- [ ] **Step 7.1: 更新 import**

打开 `src/routes/inventory.route.ts`，将 `product.dto` 的 import 替换为：

```typescript
import {
    CreateProductDto,
    ProductIdDto,
    ListProductDto,
    UpdateProductDto,
    SetProductItemsDto,
    ProductItemIdDto,
} from '../dto/product.dto';
```

- [ ] **Step 7.2: 新增 setProductItems 路由**

在 `// 删除产品（软删除）` 块之后（即 `deleteProduct` 路由之后），插入：

```typescript
// 设置产品库存件(全量覆盖)
router.post('/setProductItems',
    validationMiddleware(SetProductItemsDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(SetProductItemsDto, req.body);
        const result = await productService.setProductItems(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询产品的库存件列表
router.get('/listProductItems',
    validationMiddleware(ProductItemIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ProductItemIdDto, req.query);
        const result = await productService.getProductItems(dtoObj.product_id);
        res.locals.datas = result;
        next();
    })
);
```

- [ ] **Step 7.3: TypeCheck + Lint**

Run: `pnpm run typecheck`
Expected: PASS

Run: `pnpm run lint`
Expected: PASS（若 lint 报错，根据提示修复；通常是 import 顺序或多余空行）

- [ ] **Step 7.4: Commit**

```bash
git add src/routes/inventory.route.ts
git commit -m "$(cat <<'EOF'
新增: 设置/查询产品库存件路由

## 主要变更

### 1. inventory.route.ts
- 新增 POST /setProductItems,调用 productService.setProductItems
- 新增 GET /listProductItems,调用 productService.getProductItems
- 复用现有 validationMiddleware + asyncHandler 模式

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 手工冒烟验证

**Files:** (无代码改动)

- [ ] **Step 8.1: 启动开发服务器**

Run: `pnpm run dev`
Expected: 服务正常启动，日志显示路由初始化完成

- [ ] **Step 8.2: 执行 SQL 迁移**

在 PostgreSQL 上执行 `sql/migration-product-items.sql`：
- 验证 `inventory.product_items` 表已创建
- 验证 `inventory.inventory_items.product_id` 列已删除

```sql
-- 验证查询
SELECT column_name FROM information_schema.columns
WHERE table_schema='inventory' AND table_name='inventory_items';
-- 期望结果不含 product_id

SELECT count(*) FROM information_schema.tables
WHERE table_schema='inventory' AND table_name='product_items';
-- 期望结果: 1
```

- [ ] **Step 8.3: 调用 setProductItems 接口**

前置：先创建一个产品（POST `/inventory/createProduct`）和两个库存件（POST `/inventory/createItem`），拿到 `product_id` 与两个 `item_id`。

```bash
curl -X POST http://localhost:<port>/<apiPrefix>/inventory/setProductItems \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "<产品ID>",
    "items": [
      {"item_id": "<库存件1>", "quantity_per_product": 2, "remark": "主用"},
      {"item_id": "<库存件2>", "quantity_per_product": 1}
    ]
  }'
```
Expected: `{"result":0,"msg":"设置成功","alg":"","datas":{"product_id":"...","count":2}}`

- [ ] **Step 8.4: 调用 listProductItems 验证回显**

```bash
curl "http://localhost:<port>/<apiPrefix>/inventory/listProductItems?product_id=<产品ID>"
```
Expected: 返回 2 条关联，`item_name`、`quantity_per_product` 等字段正确

- [ ] **Step 8.5: 验证差分逻辑（移除 + 复活）**

再次调用 setProductItems，items 只保留库存件 1，再追加一个新库存件 3：
```bash
curl -X POST http://localhost:<port>/<apiPrefix>/inventory/setProductItems \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "<产品ID>",
    "items": [
      {"item_id": "<库存件1>"},
      {"item_id": "<库存件3>"}
    ]
  }'
```
Expected: 成功。再次 listProductItems 应返回 2 条（item1 + item3）。

DB 校验：
```sql
SELECT item_id, status FROM inventory.product_items WHERE product_id='<产品ID>';
-- 期望: item1 status=1, item2 status=2, item3 status=1
```

再次调用 setProductItems 把 item2 加回来，验证复活：
```bash
curl -X POST .../setProductItems \
  -d '{"product_id":"<产品ID>","items":[{"item_id":"<item1>"},{"item_id":"<item2>"}]}'
```
DB 校验：item2 应当从 status=2 变回 status=1（不是新插入一行）。

- [ ] **Step 8.6: 验证 stockOut 校验**

对一个未关联到产品 P 的库存件 X 调用出库：
```bash
curl -X POST .../inventory/out \
  -d '{"productId":"<P>","itemId":"<X>","quantity":1,"date":"2026-06-16"}'
```
Expected: `{"result":1,"msg":"该库存件未关联到此产品",...}`

把 X 关联到 P 后再出库，应成功。

- [ ] **Step 8.7: 验证错误路径**

- 不存在的 product_id 调用 setProductItems → 期望 `产品不存在`
- items 含不存在的 item_id → 期望 `库存件不存在或已停用: <id>`
- items 含重复 item_id → 期望 `库存件列表存在重复项`

- [ ] **Step 8.8: 不需要 commit**

冒烟阶段无代码改动，无需提交。如发现问题，回到对应任务修复后再 commit。

---

## 完成标准

- 所有 8 个 Task 的 checkbox 全部完成
- `pnpm run typecheck` 与 `pnpm run lint` 通过
- SQL 迁移脚本在干净库上执行成功
- 手工冒烟全部期望结果符合
- 共 7 次 commit（Task 1/2/3/4/5/6/7 各一次）

## Self-Review

**1. Spec coverage:**
- 关联表设计 → Task 1 + Task 2 ✓
- 实体删除 product_id → Task 1 Step 1.1 ✓
- DTO 新增/清理 → Task 3 ✓
- ProductService.setProductItems/getProductItems → Task 4 ✓
- StockService.stockOut 调整 → Task 5 ✓
- InventoryItemService.list 清理 → Task 6 ✓
- 路由接入 → Task 7 ✓
- 测试要点（差分、复活、错误路径）→ Task 8 ✓

**2. Placeholder scan:** 已检查无 TBD/TODO/「类似上文」等占位描述。

**3. Type consistency:** `setProductItems` / `getProductItems` 在 Task 4 定义、Task 7 调用；DTO 名称 `SetProductItemsDto` / `ProductItemIdDto` 全文一致；`ProductItem` 实体字段名（`product_item_id`、`quantity_per_product`、`remark`、`status`、`create_time`、`update_time`）在所有任务中保持一致。
