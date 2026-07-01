# 零件类型系统重构设计

## 背景

当前零件类型系统只有固定的两种类型（设备件、常用件），存储在零件表的 `type` 字段中。需要改造为支持自定义两级类型的系统，类型数据存储在数据库中，管理员可动态维护。

## 需求说明

### 功能需求

1. **两级类型结构**
   - 一级类型和二级类型形成树形结构
   - 创建零件时可以只选一级类型，也可以选到二级类型
   - 一级类型下可以不设置二级类型

2. **类型管理**
   - 管理员可以创建、编辑、删除类型
   - 类型包含：名称、编码、排序号、备注
   - 同一父级下类型名称不能重复

3. **删除约束**
   - 删除即停用（软删除，状态改为停用）
   - 已被零件使用的类型不能删除
   - 一级类型被删除时，其下所有子类型也同时删除

4. **查询要求**
   - 默认只查询状态正常的类型
   - 支持按父级查询子类型列表
   - 支持查询完整类型树

### 非功能需求

- 兼容现有零件数据（设备件、常用件）
- 类型数据迁移到新表后保持业务连续性

## 技术方案

### 数据库设计

#### 新建类型表 `item_type`

```sql
CREATE TABLE inventory.item_type (
    type_id VARCHAR(32) PRIMARY KEY COMMENT '类型ID',
    parent_id VARCHAR(32) NULL COMMENT '父类型ID，NULL表示一级类型',
    name VARCHAR(100) NOT NULL COMMENT '类型名称',
    code VARCHAR(50) COMMENT '类型编码',
    sort_order INT DEFAULT 0 COMMENT '排序号，越小越靠前',
    status INT DEFAULT 1 COMMENT '状态：1-正常，2-停用',
    remark TEXT COMMENT '备注',
    create_time TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_parent_name (parent_id, name) COMMENT '同一父级下名称唯一',
    INDEX idx_parent_id (parent_id) COMMENT '父类型索引',
    INDEX idx_status (status) COMMENT '状态索引'
);
```

#### 修改零件表 `inventory_item`

```sql
-- 新增 type_id 字段
ALTER TABLE inventory.inventory_item
ADD COLUMN type_id VARCHAR(32) COMMENT '类型ID' AFTER item_id;

-- 添加外键约束
ALTER TABLE inventory.inventory_item
ADD CONSTRAINT fk_item_type FOREIGN KEY (type_id) REFERENCES inventory.item_type(type_id);

-- 删除旧的 type 字段（数据迁移后）
ALTER TABLE inventory.inventory_item DROP COLUMN type;
```

#### 初始数据

```sql
INSERT INTO inventory.item_type (type_id, parent_id, name, code, sort_order, status, create_time, update_time)
VALUES
    ('type_device', NULL, '设备件', 'device', 1, 1, NOW(), NOW()),
    ('type_common', NULL, '常用件', 'common', 2, 1, NOW(), NOW());
```

### 实体层设计

**文件**: `src/entity/item-type.entity.ts`

```typescript
@Entity({ schema: 'inventory', name: 'item_type' })
export class ItemType {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    type_id: string;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '父类型ID，NULL表示一级类型' })
    parent_id: string;

    @Column({ type: 'varchar', length: 100, comment: '类型名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, nullable: true, comment: '类型编码' })
    code: string;

    @Column({ type: 'int', default: 0, comment: '排序号' })
    sort_order: number;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

### DTO 层设计

**文件**: `src/dto/item-type.dto.ts`

```typescript
export class CreateItemTypeDto {
    @IsOptional()
    @IsString()
    parent_id?: string;

    @IsString()
    @MaxLength(100, { message: '类型名称最多100个字符' })
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(50, { message: '类型编码最多50个字符' })
    code?: string;

    @IsOptional()
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateItemTypeDto {
    @IsString({ message: '类型ID不能为空' })
    type_id: string;

    @IsOptional()
    @IsString()
    @MaxLength(100, { message: '类型名称最多100个字符' })
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50, { message: '类型编码最多50个字符' })
    code?: string;

    @IsOptional()
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    @IsString()
    remark?: string;
}

export class DeleteItemTypeDto {
    @IsString({ message: '类型ID不能为空' })
    type_id: string;
}

export class ListItemTypeDto {
    @IsOptional()
    @IsString()
    parent_id?: string;
}
```

### Service 层设计

**文件**: `src/service/inventory/item-type.service.ts`

#### 主要方法

```typescript
export class ItemTypeService {
    // 创建类型
    async create(dto: CreateItemTypeDto): Promise<ItemType>

    // 更新类型
    async update(dto: UpdateItemTypeDto): Promise<ItemType>

    // 删除类型（软删除）
    async delete(dto: DeleteItemTypeDto): Promise<void>

    // 查询类型列表
    async list(dto: ListItemTypeDto): Promise<ItemType[]>

    // 查询类型树
    async tree(): Promise<ItemTypeTree[]>

    // 检查类型是否被零件使用
    private async isTypeInUse(typeId: string): Promise<boolean>
}
```

#### 业务逻辑

**创建类型**:
1. 验证 parent_id 存在且状态正常
2. 检查 parent_id 不是二级类型（不支持三级）
3. 检查同一父级下名称是否重复
4. 生成 type_id，创建类型

**更新类型**:
1. 验证类型存在且状态正常
2. 如果修改名称，检查同一父级下是否重复
3. 更新类型

**删除类型**:
1. 验证类型存在
2. 检查是否被零件使用
   - 一级类型：检查自身和所有子类型是否被使用
   - 二级类型：检查自身是否被使用
3. 如果被使用则抛出错误
4. 一级类型：将自身和所有子类型状态改为停用
5. 二级类型：将自身状态改为停用

**查询类型列表**:
1. 查询状态为正常的类型
2. 如果有 parent_id，查询该父级下的子类型
3. 如果没有 parent_id，查询一级类型
4. 按 sort_order 排序

**查询类型树**:
1. 查询所有状态正常的类型
2. 组装成树形结构返回

### 路由设计

**文件**: `src/routes/inventory.route.ts` (在现有文件中添加)

| 方法 | 路径 | 说明 | 请求参数 |
|------|------|------|----------|
| GET | /api/inventory/listItemTypes | 查询类型列表 | Query: `parent_id?` |
| GET | /api/inventory/listItemTypeTree | 查询类型树 | 无 |
| POST | /api/inventory/createItemType | 创建类型 | Body: `{ parent_id?, name, code?, sort_order?, remark? }` |
| POST | /api/inventory/updateItemType | 更新类型 | Body: `{ type_id, name?, code?, sort_order?, remark? }` |
| POST | /api/inventory/deleteItemType | 删除类型 | Body: `{ type_id }` |

### 数据迁移方案

#### 步骤

1. 创建 `item_type` 表
2. 插入现有类型数据（设备件、常用件）
3. 添加 `type_id` 字段到 `inventory_item` 表
4. 迁移现有零件的类型数据（type → type_id）
5. 添加外键约束
6. 删除旧的 `type` 字段

#### SQL 脚本

```sql
-- 1. 创建新表
CREATE TABLE inventory.item_type (
    type_id VARCHAR(32) PRIMARY KEY COMMENT '类型ID',
    parent_id VARCHAR(32) NULL COMMENT '父类型ID，NULL表示一级类型',
    name VARCHAR(100) NOT NULL COMMENT '类型名称',
    code VARCHAR(50) COMMENT '类型编码',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    status INT DEFAULT 1 COMMENT '状态：1-正常，2-停用',
    remark TEXT COMMENT '备注',
    create_time TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_parent_name (parent_id, name),
    INDEX idx_parent_id (parent_id),
    INDEX idx_status (status)
);

-- 2. 插入现有类型数据
INSERT INTO inventory.item_type (type_id, parent_id, name, code, sort_order, status, create_time, update_time)
VALUES
    ('type_device', NULL, '设备件', 'device', 1, 1, NOW(), NOW()),
    ('type_common', NULL, '常用件', 'common', 2, 1, NOW(), NOW());

-- 3. 添加 type_id 字段
ALTER TABLE inventory.inventory_item
ADD COLUMN type_id VARCHAR(32) COMMENT '类型ID' AFTER item_id;

-- 4. 迁移数据
UPDATE inventory.inventory_item
SET type_id = CASE
    WHEN type = 'device' THEN 'type_device'
    WHEN type = 'common' THEN 'type_common'
END;

-- 5. 添加外键约束
ALTER TABLE inventory.inventory_item
ADD CONSTRAINT fk_item_type FOREIGN KEY (type_id) REFERENCES inventory.item_type(type_id);

-- 6. 删除旧字段
ALTER TABLE inventory.inventory_item DROP COLUMN type;
```

### 零件相关接口修改

#### DTO 修改

**文件**: `src/dto/item.dto.ts`

- `CreateInventoryItemDto`: `type` → `type_id`
- `UpdateInventoryItemDto`: `type` → `type_id`
- `ListInventoryItemDto`: `type` → `type_id`

#### Service 修改

**文件**: `src/service/inventory/item.service.ts`

- 查询列表时关联 `item_type` 表获取类型名称
- 创建/更新时验证 `type_id` 存在且状态正常
- 返回数据增加 `type_name` 和 `type_full_name` 字段

#### 返回数据结构

```typescript
interface InventoryItemResponse {
    item_id: string;
    type_id: string;
    type_name: string;           // 类型名称
    type_full_name: string;      // 完整类型名称（一级 > 二级）
    // ... 其他字段
}
```

### 错误处理

| 场景 | 错误信息 |
|------|----------|
| 创建类型时 parent_id 不存在 | 父类型不存在 |
| 创建类型时 parent_id 已停用 | 父类型已停用 |
| 创建类型时 parent_id 是二级类型 | 不支持创建三级类型 |
| 创建类型时名称重复 | 类型名称已存在 |
| 更新类型时类型不存在 | 类型不存在 |
| 更新类型时类型已停用 | 类型已停用，无法修改 |
| 更新类型时名称重复 | 类型名称已存在 |
| 删除类型时类型不存在 | 类型不存在 |
| 删除类型时类型已被使用 | 类型已被使用，无法删除 |
| 删除一级类型时子类型已被使用 | 子类型已被使用，无法删除 |
| 创建零件时 type_id 不存在 | 类型不存在 |
| 创建零件时 type_id 已停用 | 类型已停用 |

### 类型树返回格式

```typescript
interface ItemTypeTree {
    type_id: string;
    name: string;
    code: string;
    sort_order: number;
    remark: string;
    children?: ItemTypeTree[];
}
```

## 实现优先级

1. 创建 `item_type` 表和实体
2. 实现 `ItemTypeService`（CRUD + 树查询）
3. 添加路由接口
4. 数据迁移（type → type_id）
5. 修改零件相关 Service 和 DTO
6. 测试验证

## 影响范围

### 后端

- 新增: `src/entity/item-type.entity.ts`
- 新增: `src/dto/item-type.dto.ts`
- 新增: `src/service/inventory/item-type.service.ts`
- 修改: `src/service/inventory/index.ts`
- 修改: `src/routes/inventory.route.ts`
- 修改: `src/entity/product.entity.ts`
- 修改: `src/dto/item.dto.ts`
- 修改: `src/service/inventory/item.service.ts`

### 前端

- 修改: `src/types/inventory.ts`
- 修改: `src/api/inventory.ts`
- 修改: 零件相关页面组件（类型选择器）

## 风险评估

1. **数据迁移风险**: 需要在业务低峰期执行，确保数据一致性
2. **向后兼容**: 前端需要同步修改类型选择逻辑
3. **性能影响**: 类型查询增加了数据库关联，但类型数据量较小，影响可控
