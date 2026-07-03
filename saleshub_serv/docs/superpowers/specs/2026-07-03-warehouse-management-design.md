# 仓库管理功能设计文档

## 1. 概述

### 1.1 背景

当前库存管理系统只有入库、出库、盘点功能，未记录零件存放的仓库位置。需要新增仓库管理功能，支持入库和出库时选择所属仓库。

### 1.2 目标

- 实现仓库的基础管理（增删改查）
- 入库/出库/盘点操作必须指定仓库
- 支持同一零件规格在不同仓库存放，各自独立库存

### 1.3 设计原则

- 方案A：新增库存明细表，保留现有总库存字段
- 向后兼容：warehouse_id 可空，历史数据不迁移
- 最小改动：保持现有业务逻辑框架

---

## 2. 数据库设计

### 2.1 新增仓库表 `inventory.warehouse`

| 字段 | 类型 | 说明 |
|------|------|------|
| warehouse_id | VARCHAR(32) | 主键 |
| name | VARCHAR(100) | 仓库名称 |
| location | VARCHAR(200) | 位置 |
| status | INT | 状态：1-正常，2-停用 |
| create_time | TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | 修改时间 |

### 2.2 新增库存明细表 `inventory.item_spec_warehouse`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 主键 |
| spec_id | VARCHAR(32) | 规格ID |
| warehouse_id | VARCHAR(32) | 仓库ID |
| current_stock | INT | 该规格在该仓库的库存数量 |
| status | INT | 状态：1-正常，2-停用 |
| create_time | TIMESTAMP | 创建时间 |
| update_time | TIMESTAMP | 修改时间 |

**约束：** UNIQUE(spec_id, warehouse_id)

### 2.3 修改现有记录表

**入库记录表 `inventory.stock_in_record` 新增：**
- `warehouse_id VARCHAR(32)` - 入库仓库ID（可空）

**出库记录表 `inventory.stock_out_record` 新增：**
- `warehouse_id VARCHAR(32)` - 出库仓库ID（可空）

**盘点记录表 `inventory.inventory_check` 新增：**
- `warehouse_id VARCHAR(32)` - 盘点仓库ID（可空）

---

## 3. API接口设计

### 3.1 仓库管理接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 查询仓库列表 | GET | `/listWarehouses` | 支持分页、状态筛选 |
| 创建仓库 | POST | `/createWarehouse` | 创建新仓库 |
| 更新仓库 | POST | `/updateWarehouse` | 修改仓库名称、位置等 |
| 删除仓库 | POST | `/deleteWarehouse` | 软删除仓库 |

### 3.2 修改现有接口

**入库接口：**
- `StockInDto` 新增必填字段 `warehouse_id`
- `StockInBatchDto` 新增必填字段 `warehouse_id`

**出库接口：**
- `StockOutDto` 新增必填字段 `warehouse_id`
- `StockOutBatchDto` 新增必填字段 `warehouse_id`
- `StockOutByProductDto` 新增必填字段 `warehouse_id`

**盘点接口：**
- `StockCheckDto` 新增必填字段 `warehouse_id`
- `StockCheckBatchDto` 新增必填字段 `warehouse_id`

### 3.3 新增库存查询接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 查询规格库存明细 | GET | `/listSpecWarehouseStock` | 查询某规格在各仓库的库存分布 |

### 3.4 分配零件仓库接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 分配零件仓库 | POST | `/assignSpecWarehouse` | 为零件规格分配仓库及库存数量（用于历史数据初始化） |

**请求参数 `AssignSpecWarehouseDto`：**
- `spec_id: string` - 规格ID（必填）
- `warehouse_id: string` - 仓库ID（必填）
- `quantity: number` - 分配数量（必填，必须大于0且不超过该规格总库存）

**业务规则：**
- 校验规格存在且状态正常
- 校验仓库存在且状态正常
- 校验分配数量不能超过规格总库存（InventoryItemSpec.current_stock）
- 如果该规格已分配到此仓库，则累加库存
- 分配成功后，规格总库存不变（只是明确了存放位置）

---

## 4. 业务逻辑设计

### 4.1 入库逻辑

**流程：**
1. 校验零件、规格存在
2. 校验仓库存在且状态正常
3. 创建入库记录（含 warehouse_id）
4. 更新或创建 InventoryItemSpecWarehouse.current_stock
5. 更新 InventoryItemSpec.current_stock（总量）

**事务保证：** 三步更新在同一事务中完成

### 4.2 出库逻辑

**流程：**
1. 校验零件、规格存在
2. 校验仓库存在且状态正常
3. 校验该仓库中该规格库存充足
4. 创建出库记录（含 warehouse_id）
5. 更新 InventoryItemSpecWarehouse.current_stock
6. 更新 InventoryItemSpec.current_stock（总量）

### 4.3 盘点逻辑

**流程：**
1. 校验零件、规格存在
2. 校验仓库存在且状态正常
3. 记录盘点前后库存（该仓库的库存）
4. 更新 InventoryItemSpecWarehouse.current_stock
5. 更新 InventoryItemSpec.current_stock（总量 = 其他仓库库存 + 盘点后库存）

### 4.4 删除仓库约束

删除仓库时检查是否存在库存明细（current_stock > 0）：
- 有库存：不允许删除，返回错误提示
- 无库存：允许软删除

---

## 5. 数据迁移策略

### 5.1 历史数据处理

- warehouse_id 字段设为可空，历史数据的 warehouse_id 保持 NULL
- 历史库存数据通过**手动分配**方式处理：管理员使用 `/assignSpecWarehouse` 接口为现有库存指定仓库
- 分配后，InventoryItemSpecWarehouse 表记录各规格在各仓库的库存分布

### 5.2 新数据处理

- 新入库操作必须指定 warehouse_id（DTO 层面必填）
- 入库时自动创建或更新 InventoryItemSpecWarehouse 记录
- 同时更新 InventoryItemSpec.current_stock（总量）

### 5.3 查询兼容

- 查询总库存：使用 InventoryItemSpec.current_stock
- 查询分仓库库存：查询 InventoryItemSpecWarehouse
- 未分配仓库的规格在分仓库查询时显示为空

---

## 6. 文件结构

### 6.1 新增文件

```
src/
├── entity/
│   └── warehouse.entity.ts           # 仓库实体 + 库存明细实体
├── dto/
│   └── warehouse.dto.ts              # 仓库相关DTO
├── service/
│   └── inventory/
│       └── warehouse.service.ts      # 仓库服务
```

### 6.2 修改文件

```
src/
├── entity/
│   └── stock.entity.ts               # 添加warehouse_id字段
├── dto/
│   └── stock.dto.ts                  # 添加warehouse_id字段
├── service/
│   └── inventory/
│       └── stock.service.ts          # 修改入库/出库/盘点逻辑
├── routes/
│   └── inventory.route.ts            # 添加仓库管理路由
├── service/
│   └── inventory/
│       └── index.ts                  # 导出warehouseService
```

---

## 7. 成功标准

- [ ] 仓库的增删改查功能正常
- [ ] 入库/出库/盘点必须指定仓库
- [ ] 同一规格在不同仓库有独立库存
- [ ] 删除有库存的仓库时正确提示错误
- [ ] 分配零件仓库接口正常工作，支持历史数据手动分配
- [ ] 历史数据兼容，不受影响
