# 产品模块化零件管理设计

## 概述

将现有产品-零件直接关联模型改为支持模块化分层管理，同时保留直接关联方式，两种方式互斥。

## 需求

- 产品可以通过模块管理零件：产品 → 模块 → 零件
- 产品也可以直接关联零件：产品 → 零件
- 同一个产品只能选择一种方式，互斥
- 现有已直接关联零件的产品保持原状

## 数据模型设计

### 新增 `ProductModule` 表

```sql
CREATE TABLE inventory.product_module (
    module_id VARCHAR(32) PRIMARY KEY,
    product_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    sort_order INT DEFAULT 0,
    remark TEXT,
    status INT DEFAULT 1,
    create_time TIMESTAMP,
    update_time TIMESTAMP
);
```

### 扩展 `ProductItem` 表

新增字段：
- `module_id VARCHAR(32) NULL` - 所属模块ID，NULL 表示产品直接关联

约束：
- 外键关联 `product_module.module_id`
- 同一产品的零件记录必须全部属于同一模式（业务层校验）

## 业务规则

### 模式互斥约束

| 操作 | 校验逻辑 |
|------|----------|
| 创建模块 | 检查产品是否已有直接关联的零件 |
| 设置直接关联零件 | 检查产品是否已有模块 |
| 删除模块 | 若所有模块删除完毕，允许切换方式 |
| 删除直接关联零件 | 若所有零件删除完毕，允许切换方式 |

### 隐式推断规则

通过检查产品下的数据自动判断使用哪种方式：
- 存在 `ProductModule` 记录 → 使用模块方式
- 存在 `ProductItem.module_id IS NULL` 记录 → 使用直接关联方式
- 都不存在 → 未选择，可任选一种

## 接口设计

### 新增接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/product/createModule` | POST | 创建模块 |
| `/product/listModule` | POST | 查询产品的模块列表 |
| `/product/updateModule` | POST | 更新模块信息 |
| `/product/deleteModule` | POST | 删除模块 |
| `/product/setModuleItems` | POST | 设置模块的零件列表 |
| `/product/getModuleItems` | POST | 查询模块的零件列表 |

### 调整接口

| 接口 | 调整内容 |
|------|----------|
| `/product/setProductItems` | 新增校验：产品已有模块则拒绝 |
| `/product/getProductItems` | 返回结构调整，增加模块分组信息 |

## DTO 设计

```typescript
// 创建模块
export class CreateModuleDto {
    @IsNotEmpty() product_id: string;
    @IsNotEmpty() @MaxLength(100) name: string;
    @IsOptional() @MaxLength(50) code?: string;
    @IsOptional() @IsInt() sort_order?: number;
    @IsOptional() @MaxLength(500) remark?: string;
}

// 更新模块
export class UpdateModuleDto {
    @IsNotEmpty() module_id: string;
    @IsOptional() @MaxLength(100) name?: string;
    @IsOptional() @MaxLength(50) code?: string;
    @IsOptional() @IsInt() sort_order?: number;
    @IsOptional() @MaxLength(500) remark?: string;
}

// 模块ID
export class ModuleIdDto {
    @IsNotEmpty() module_id: string;
}

// 设置模块零件
export class SetModuleItemsDto {
    @IsNotEmpty() module_id: string;
    @IsArray() @ValidateNested({ each: true }) items: ProductItemEntryDto[];
}

// 查询模块列表
export class ListModuleDto {
    @IsNotEmpty() product_id: string;
}
```

## 返回结构设计

### getProductItems 接口

模块方式：
```json
{
  "result": 0,
  "datas": {
    "use_module": true,
    "modules": [
      {
        "module_id": "xxx",
        "name": "显示模块",
        "sort_order": 1,
        "items": [
          { "relation_id": "xxx", "item_id": "xxx", "item_name": "屏幕", "quantity_per_product": 1, "spec_id": "xxx", "spec": "15寸" }
        ]
      }
    ]
  }
}
```

直接关联方式：
```json
{
  "result": 0,
  "datas": {
    "use_module": false,
    "items": [
      { "relation_id": "xxx", "item_id": "xxx", "item_name": "屏幕", "quantity_per_product": 1, "spec_id": "xxx", "spec": "15寸" }
    ]
  }
}
```

## 代码变更

### 文件变更列表

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/entity/product.entity.ts` | 修改 | 新增 ProductModule 实体，ProductItem 新增 module_id 字段 |
| `src/dto/product.dto.ts` | 修改 | 新增模块相关 DTO |
| `src/service/inventory/product.service.ts` | 修改 | 新增模块管理方法，调整现有方法 |
| `src/routes/inventory.route.ts` | 修改 | 新增模块相关路由 |

### ProductService 新增方法

- `createModule(dto: CreateModuleDto)` - 创建模块
- `listModule(dto: ListModuleDto)` - 查询模块列表
- `updateModule(dto: UpdateModuleDto)` - 更新模块
- `deleteModule(dto: ModuleIdDto)` - 删除模块
- `setModuleItems(dto: SetModuleItemsDto)` - 设置模块零件
- `getModuleItems(dto: ModuleIdDto)` - 查询模块零件

### ProductService 调整方法

- `setProductItems()` - 新增模式互斥校验
- `getProductItems()` - 返回结构调整，支持模块分组

## 数据库迁移

### 迁移步骤

1. 创建 `product_module` 表
2. 为 `product_item` 表新增 `module_id` 字段（可为空，默认 NULL）
3. 创建索引 `idx_product_item_module`
4. 创建外键约束

### 兼容性

- 现有 `product_item` 数据的 `module_id` 默认为 NULL，保持直接关联方式
- 无需迁移现有数据

## 业务流程

```
创建产品
    ↓
选择管理方式（首次操作时确定）
    ├── 创建模块 → 设置模块零件 → 使用模块方式
    └── 直接设置零件 → 使用直接关联方式
    ↓
切换方式（需清空现有数据）
    └── 删除所有模块/零件后可重新选择
```
