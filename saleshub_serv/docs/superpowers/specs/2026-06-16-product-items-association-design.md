# 产品-零件关联表改造设计

日期：2026-06-16
作者：Jason + Claude
状态：已与用户确认设计，待编写实现计划

## 背景

当前 `inventory.inventory_items` 表通过 `product_id` 外键直接关联到 `inventory.products`，语义为"每个设备件（type=device）属于一个产品"。此设计无法表达：

- 一个产品由多个不同的零件组成（BOM 语义）
- 同一零件（如螺丝等通用件）被多个产品共用

需求是将 `product_id` 从 `inventory_items` 移出，建立独立的产品-零件关联表，支持 M:N 关系，并在 `ProductService` 中提供"设置产品零件"接口。

## 范围

- 新增关联表 `inventory.product_items`（BOM 语义）
- 删除 `inventory_items.product_id` 列
- 新增 TypeORM 实体 `ProductItem`
- 在 `ProductService` 新增 `setProductItems` 与 `getProductItems` 方法
- 调整 `StockService.stockOut` 的产品归属校验逻辑
- 新增对应 DTO 与路由
- 编写增量 SQL 迁移脚本

不在范围内：

- 现有 `stock_in/out/check` 历史记录表的结构变更
- 关联表关联表（如产品分类树）等更高层抽象
- 前端实现

## 数据模型

### 关联表 `inventory.product_items`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `product_item_id` | VARCHAR(32) | PK | 主键，应用层用 `uuid v7` 去掉 `-` 生成 |
| `product_id` | VARCHAR(32) | NOT NULL, FK → products | 产品 ID |
| `item_id` | VARCHAR(32) | NOT NULL, FK → inventory_items | 零件 ID |
| `quantity_per_product` | INT | NOT NULL DEFAULT 1 | 单台产品所需数量，最小 1 |
| `remark` | TEXT | NULL | 备注 |
| `status` | INT | NOT NULL DEFAULT 1, CHECK IN (1,2) | 1-正常，2-停用 |
| `create_time` | TIMESTAMP | NOT NULL DEFAULT NOW() | 创建时间 |
| `update_time` | TIMESTAMP | NOT NULL DEFAULT NOW() | 更新时间 |

约束：
- `UNIQUE (product_id, item_id)`：避免重复关联（注意 status=2 的软删除行也包含在唯一约束内，因此重新启用时使用 UPDATE 而非 INSERT）
- 外键不带 `ON DELETE` 行为：删除产品/零件走软删除（status=2），不会触发级联

索引：
- `idx_product_items_product_id (product_id)`
- `idx_product_items_item_id (item_id)`
- `idx_product_items_status (status)`

### `inventory_items` 表变更

- 删除 `product_id` 列
- 删除相关外键约束 `fk_inventory_items_product`
- 删除相关索引 `idx_inventory_items_product_id`

实体侧同步删除 `InventoryItem.product_id` 属性。

## 实体设计

`src/entity/product.entity.ts` 现有 `Product`、`InventoryItem` 两个类，新增 `ProductItem`：

```typescript
@Entity({ schema: 'inventory', name: 'product_items' })
export class ProductItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    product_item_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
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

`InventoryItem` 删除 `product_id` 字段。

## DTO 设计

`src/dto/product.dto.ts` 新增：

```typescript
export class ProductItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
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

    @IsArray()
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

注：`@ValidateNested` 与 `@Type` 配合实现嵌套校验，需要从 `class-validator` 和 `class-transformer` 引入。

## Service 设计

### ProductService 新增 Repository

```typescript
private productItemRepository = AppDataSource.getRepository(ProductItem);
```

### setProductItems(dto)

语义：全量覆盖。给定期 `product_id` 和 `items` 列表，使产品在关联表中的有效关联（status=1）等于传入列表。

算法（在事务中执行）：

1. 校验产品存在且 status=1，否则返回 `{ result: 1, msg: '产品不存在' }`
2. 校验 `items` 中所有 `item_id` 在 `inventory_items` 中存在且 status=1，否则返回 `{ result: 1, msg: '零件不存在: <id>' }`
3. 校验同一 `item_id` 不在 `items` 中重复出现
4. 查询当前产品的所有关联行（不限 status），在内存中按 `item_id` 建立 Map
5. 构造差分（按 item_id 比对）：
   - 新列表中的 item_id 且旧关联中已存在（无论 status=1 还是 status=2）：UPDATE `quantity_per_product`、`remark`、`status=1`、`update_time=NOW()`
   - 旧关联 status=1 但新列表中无：UPDATE `status=2`、`update_time=NOW()`
   - 旧关联 status=2 且新列表中无：保持不变（已是软删除状态）
   - 新列表中的 item_id 且旧关联中不存在：INSERT 新行 `status=1`
6. 返回 `{ result: 0, msg: '设置成功', datas: { product_id, count: items.length } }`

错误处理：捕获异常，事务回滚，返回 `{ result: 1, msg: '设置失败' }`。

### getProductItems(product_id)

返回某产品当前所有有效关联（status=1），含零件详情：

```sql
SELECT pi.product_item_id, pi.product_id, pi.item_id,
       pi.quantity_per_product, pi.remark,
       i.name AS item_name, i.code AS item_code, i.type AS item_type,
       i.current_stock, i.warn_stock
FROM inventory.product_items pi
JOIN inventory.inventory_items i ON i.item_id = pi.item_id
WHERE pi.product_id = :productId AND pi.status = 1
ORDER BY pi.create_time DESC
```

使用 QueryBuilder 实现。

### StockService.stockOut 调整

将 `item.product_id !== dto.productId` 的内存比较改为通过 `productItemRepository` 查询：

```typescript
const rel = await this.productItemRepository.findOne({
    where: { product_id: dto.productId, item_id: dto.itemId, status: 1 },
});
if (!rel) {
    return { result: 1, msg: '该零件未关联到此产品', alg: '', datas: null };
}
```

`StockService` 需新增 `productItemRepository` 依赖。

### InventoryItemService.list 调整

移除对 `dto.product_id` 的过滤（DTO 字段同步移除）。如果将来需要按产品筛 item，应通过 `getProductItems` 接口。

## 路由设计

`src/routes/inventory.route.ts` 新增：

```typescript
// 设置产品零件（全量覆盖）
router.post('/setProductItems',
    validationMiddleware(SetProductItemsDto),
    asyncHandler(async (req, res, next) => {
        const dtoObj = plainToInstance(SetProductItemsDto, req.body);
        const result = await productService.setProductItems(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询产品的零件列表
router.get('/listProductItems',
    validationMiddleware(ProductItemIdDto),
    asyncHandler(async (req, res, next) => {
        const dtoObj = plainToInstance(ProductItemIdDto, req.query);
        const result = await productService.getProductItems(dtoObj.product_id);
        res.locals.datas = result;
        next();
    })
);
```

## SQL 迁移脚本

新文件 `sql/migration-product-items.sql`：

- `CREATE TABLE inventory.product_items`（含约束、索引、字段注释）
- `ALTER TABLE inventory.inventory_items DROP CONSTRAINT fk_inventory_items_product`
- `DROP INDEX inventory.idx_inventory_items_product_id`
- `ALTER TABLE inventory.inventory_items DROP COLUMN product_id`
- 在脚本顶部用注释说明改动意图与对应的原脚本版本

原文件 `sql/create-inventory-schema.sql` 不改动（按用户要求走增量迁移）。

## 错误处理

遵循项目现有风格：

- Service 层 try/catch，捕获后返回 `{ result: 1, msg: '...', alg: '', datas: null }`
- 不抛异常到路由层
- `setProductItems` 使用 TypeORM `queryRunner` 或 `entityManager.transaction` 保证原子性

## 测试要点

- setProductItems：
  - 全新关联：传入 N 项，应插入 N 行 status=1
  - 部分更新：保留 2 项、新增 1 项、移除 1 项 → 期望保留行 UPDATE、新行 INSERT、移除行 status=2
  - 复活场景：原本 status=2 的关联再次出现在列表中 → 应 UPDATE 为 status=1
  - 重复 item_id：返回错误
  - 不存在的 product_id 或 item_id：返回错误
- getProductItems：只返回 status=1 关联，含 item 详情
- stockOut：未关联的 item + product 组合返回错误

## 风险与权衡

- **唯一约束与软删除冲突**：`UNIQUE (product_id, item_id)` 意味着 status=2 的行也占位。实现差分逻辑时需先查现存所有行（不限 status）再决定 INSERT/UPDATE，避免插入冲突。这是正确的——已记录在算法中。
- **事务边界**：setProductItems 必须在事务中执行，避免半成功状态。
- **历史出库记录**：`stock_out_records.product_id` 字段保留，与本次改动无关。
