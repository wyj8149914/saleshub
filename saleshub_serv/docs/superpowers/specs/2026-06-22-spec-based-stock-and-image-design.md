# 设计:按规格区分库存 + 零件/产品图片字段

**日期**: 2026-06-22
**状态**: 设计已批准,待制定实现计划

## 背景

当前系统存在两个问题:

1. **零件库存不分规格**:`InventoryItem.current_stock` 是单一字段,虽然 `specs: string[]` 记录了可选规格,但规格不入库,无法独立追踪每种规格的库存数量。
2. **零件/产品无图片字段**:产品表和零件表都缺少图片关联,无法展示零件实物图或产品示意图。

## 目标

1. 库存改为按规格(spec)独立管理,每个规格对应独立 SKU 库存
2. 零件(`InventoryItem`)和产品(`Product`)新增 `image_id` 字段,关联 `file.relation_id`

## 需求决策(用户已确认)

| 决策点 | 选择 |
|--------|------|
| 规格维度模型 | 单维度(扁平),specs 是 string[],每个值是独立 SKU |
| 规格适用范围 | 所有零件都可规格,但可选(specs 为空表示单一默认 SKU) |
| 出入库规格处理 | 必须指定单一规格 |
| 预警级别 | 零件级别(按所有规格库存汇总比较) |
| BOM 规格 | ProductItem 必须指定 spec(零件无规格时传 `''`) |
| 图片字段 | 单张图片,使用 image_id 关联 file.relation_id |
| 盘点粒度 | 单接口支持单规格或批量(specs 数组长度 1 或 N) |
| 数据迁移 | 开发环境可清空,无需迁移脚本 |

## 数据模型设计

### 新增实体 `InventoryItemSpec`

位置:`src/entity/product.entity.ts`(与 `InventoryItem` 同文件)

```typescript
@Entity({ schema: 'inventory', name: 'inventory_item_spec' })
@Unique('uq_item_spec', ['item_id', 'spec'])
export class InventoryItemSpec {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    spec_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, comment: '规格值(空串代表默认 SKU)' })
    spec: string;

    @Column({ type: 'int', default: 0, comment: '当前库存' })
    current_stock: number;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- `(item_id, spec)` 唯一约束
- `spec = ''` 表示零件无规格时的默认 SKU

### `InventoryItem` 改动

- ❌ 移除 `current_stock` 字段(改由 spec 表汇总)
- ❌ 移除 `specs: string[]` 字段(改由 spec 表反查)
- ✅ 保留 `warn_stock`(零件级别预警)
- ✅ 新增 `image_id`(varchar,nullable,关联 `file.relation_id`)

### `Product` 改动

- ✅ 新增 `image_id`(varchar,nullable,关联 `file.relation_id`)

### `ProductItem` 改动(BOM 关联)

- ✅ 新增 `spec`(varchar,长度 100,默认 `''`)
- 含义:产品需要的具体零件规格,零件无规格时传 `''`

### `StockInRecord` / `StockOutRecord` 改动

- ✅ 均新增 `spec` 字段(varchar,长度 100,默认 `''`)
- 出入库时必须与对应零件某个现存 spec 匹配

### `InventoryCheck` 改动(盘点)

- ✅ 新增 `spec` 字段(varchar,长度 100,默认 `''`)
- 单条记录仍是单规格,**批量盘点时生成 N 条记录**(每个规格一条)

## 业务规则

### 规格生命周期

**创建零件时**:
- DTO 提供 `specs: string[]`(可为 `undefined` 或空数组,二者同等处理)
- 系统为每个 spec 创建一条 `InventoryItemSpec` 记录,`current_stock = 0`
- 若 `specs` 为空/未传,创建一条 `spec = ''` 的默认 SKU 记录

**更新零件时**:
- `specs` 字段变化 → 同步到 spec 表
- 新增的规格:插入新记录,`current_stock = 0`
- 保留的规格:库存不变
- 删除的规格:校验该规格 `current_stock = 0`(历史流水记录不影响,StockInRecord/StockOutRecord 作为历史保留即可) → 允许删除;库存非零则拒绝
- 零件从有规格改为无规格(清空 specs):所有现存规格必须库存为 0 才允许,然后创建默认 SKU

**删除零件时**:
- 校验所有规格的 `current_stock` 必须全为 0(任一非零拒绝)
- 通过后软删除零件,同时软删除关联的 spec 记录

### 入库 `stockIn`

- 必填 `spec` 参数,必须匹配零件某个现存规格
- 找到对应 `InventoryItemSpec`,`current_stock += quantity`
- 写 `StockInRecord`(带 spec)

### 出库 `stockOut`

- 必填 `spec` 参数
- **沿用现有约束:仅设备件(`type = 'device'`)可出库**,常用件不可出库
- 校验该规格库存 `>= quantity`,不足返回错误
- `current_stock -= quantity`
- 写 `StockOutRecord`(带 spec)

### 盘点 `stockCheck`

- 请求 DTO 携带 `specs: { spec, after_stock }[]` 数组
- 长度为 1 即单规格盘点,长度为 N 即批量盘点
- 服务端在事务中循环处理,为每个规格:
  - 读旧库存作为 `before_stock`
  - 更新 `current_stock = after_stock`
  - 写一条 `InventoryCheck` 记录
- 整体使用 queryRunner 显式事务,要么全成功要么全回滚

### 预警判断

- `listItems` 接口支持 `isWarning` 筛选
- 预警逻辑:对每个零件,`SUM(spec.current_stock) < item.warn_stock` 即为预警
- SQL 用子查询或左连接汇总 spec 表库存

### BOM 设置 `setProductItems`

- ProductItem DTO 每条项目新增 `spec` 字段(必填,允许 `''`)
- 校验:若关联零件有规格,`spec` 必须在该零件 spec 列表中;否则必须为 `''`

### 图片字段

- 创建/更新零件、产品 DTO 新增 `image_id`(可选)
- 不强校验是否存在于 file 表(参考现有 `photo_id` 的做法)
- 删除零件/产品时不级联删除 file(由 file 服务独立管理)

## DTO 变更

### 零件 DTO (`src/dto/item.dto.ts`)

`CreateInventoryItemDto` / `UpdateInventoryItemDto` 新增:
```typescript
@IsOptional() @IsString() image_id?: string;
// specs 字段保留(string[]),用于同步 spec 表
```

### 产品 DTO (`src/dto/product.dto.ts`)

`CreateProductDto` / `UpdateProductDto` 新增:
```typescript
@IsOptional() @IsString() image_id?: string;
```

### 库存 DTO (`src/dto/stock.dto.ts`)

`StockInDto` / `StockOutDto` 新增:
```typescript
@IsString() @IsNotEmpty() spec: string;  // 默认规格传 ''
```

`StockCheckDto` 调整为批量结构:
```typescript
@IsString() item_id: string;
@IsDateString() date: string;
@IsArray() @ValidateNested({ each: true })
specs: StockCheckSpecDto[];
@IsOptional() @IsString() remark?: string;

// StockCheckSpecDto
@IsString() spec: string;
@IsInt() @Min(0) after_stock: number;
```

### BOM DTO

`SetProductItemsDto` 子项新增:
```typescript
@IsString() @IsNotEmpty() item_id: string;
@IsInt() @Min(1) quantity_per_product: number;
@IsString() spec: string;  // 默认 ''
@IsOptional() @IsString() remark?: string;
```

## API 响应调整

### `listItems` 响应

每个零件对象:
- 移除 `current_stock`、`specs` 顶层字段
- 新增 `specs: { spec, current_stock }[]`(从 spec 表聚合)
- 新增 `total_stock`(所有规格库存汇总,用于预警判断)
- 新增 `image_id`

### 路由层

无新增端点,沿用现有 `/listItems`、`/stockIn`、`/stockCheck` 等。

## 实现影响范围

### 受影响文件

**实体层** (`src/entity/`)
- `product.entity.ts`:新增 `InventoryItemSpec`;`InventoryItem`/`Product`/`ProductItem` 字段调整
- `stock.entity.ts`:三个记录表新增 `spec`

**DTO 层** (`src/dto/`)
- `item.dto.ts`、`product.dto.ts`、`stock.dto.ts` 调整

**Service 层** (`src/service/inventory/`)
- `item.service.ts`:create/update/delete 同步 spec 表,list 聚合查询
- `product.service.ts`:create/update 处理 image_id,setProductItems 校验 spec
- `stock.service.ts`:stockIn/stockOut 按 spec 操作,stockCheck 改为批量事务,listHistory 返回带 spec

**初始化 SQL**
- 新建 `inventory_item_spec` 表
- 修改 `inventory_item`、`product`、`product_item`、`stock_in_record`、`stock_out_record`、`inventory_check` 表
- 开发环境清空相关表数据

### 事务边界

- 盘点批量:显式 queryRunner 事务,N 条更新 + N 条插入原子化
- 入库/出库:沿用现有事务策略,不强制新增事务
- 删除零件/规格:先查库存,再删,无需事务

### ID 生成

- `InventoryItemSpec.spec_id`:沿用项目现有 UUID 生成方式

## 不做的事(YAGNI)

- ❌ 不实现产品级自动扣减出库(用户出库仍手动选规格)
- ❌ 不为历史记录做规格字段回填(开发环境数据可清空)
- ❌ 不引入规格组/规格维度的复杂模型(单维度扁平已满足)
- ❌ 不做多张图片支持(单字段足够)
- ❌ 不改 file 服务(file 表已满足需求)

## 验证策略

- 类型检查:`pnpm run typecheck` 通过
- 代码规范:`pnpm run lint` 通过
- 手工验证路径:创建带规格零件 → 入库 → 批量盘点 → 出库 → 删除规格(库存非零时拒绝)→ 删除零件(库存非零时拒绝)
