# 库存管理系统设计文档

## 概述

为销售订单和库存管理系统设计库存管理模块（一期）。系统服务于小团队（5-20人），主要用户为业务人员。

**技术栈：**
- 后端：TypeScript + Express + TypeORM + PostgreSQL + MinIO
- 前端：Vue3 + TypeScript + Ant Design Vue

## 核心功能

### 1. 产品管理
- 产品 CRUD 操作
- 产品与设备件关联配置

### 2. 库存管理
- **入库管理**：常用件/设备件入库，上传照片
- **出库管理**：选择产品，扣减关联设备件库存
- **库存查询**：实时库存、历史记录
- **库存预警**：低库存提醒
- **库存盘点**：修正实际库存

### 3. 基础数据
- （无需单独的规格管理表）

## 数据模型

### 实体关系

```
Product (产品)
├── product_id: string (主键)
├── name: string (产品名称)
├── code: string (产品编码)
├── description: string? (产品描述)
├── status: number (状态：1-正常，2-停用)
├── createdAt: Date (创建时间)
└── InventoryItem[] (关联的设备件)

InventoryItem (零件，设备件和常用件合并)
├── item_id: string (主键)
├── type: 'device' | 'common' (类型：设备件/常用件)
├── name: string (名称)
├── code: string (编码)
├── product_id: string? (关联产品ID，仅设备件使用)
├── specs: string[] (规格选项，如 ["3mm", "2.5mm", "5mm"]，仅常用件使用)
├── currentStock: number (当前库存)
├── warnStock: number (预警阈值)
├── status: number (状态：1-正常，2-停用)
└── createdAt: Date (创建时间)

StockInRecord (入库记录)
├── in_record_id: string (主键)
├── item_id: string (零件ID)
├── quantity: number (数量)
├── date: Date (入库日期)
├── photoUrl: string (照片MinIO路径)
├── remark: string? (备注)
├── status: number (状态：1-正常，2-停用)
└── createdAt: Date (创建时间)

StockOutRecord (出库记录)
├── out_record_id: string (主键)
├── product_id: string (产品ID)
├── item_id: string (零件ID)
├── quantity: number (数量)
├── date: Date (出库日期)
├── remark: string? (备注)
├── status: number (状态：1-正常，2-停用)
└── createdAt: Date (创建时间)

InventoryCheck (盘点记录)
├── check_id: string (主键)
├── item_id: string (零件ID)
├── beforeStock: number (盘点前库存)
├── afterStock: number (盘点后库存)
├── date: Date (盘点日期)
├── remark: string? (备注)
├── status: number (状态：1-正常，2-停用)
└── createdAt: Date (创建时间)
```

## API 接口

### 产品管理

```
GET    /api/product           获取产品列表
POST   /api/product           创建产品
PUT    /api/product/:id       更新产品
DELETE /api/product/:id       删除产品（软删除）
POST   /api/product/:id/parts 配置关联设备件
POST   /api/product/:id/status 更新产品状态
```

### 库存管理

```
GET    /api/inventory         零件列表（支持按类型、产品筛选）
POST   /api/inventory         创建零件
PUT    /api/inventory/:id     更新零件
DELETE /api/inventory/:id     删除零件（软删除）
POST   /api/inventory/:id/status 更新零件状态
GET    /api/inventory/warnings 库存预警列表
```

```
GET    /api/stock             库存操作记录列表
POST   /api/stock/in          入库
POST   /api/stock/out         出库
GET    /api/stock/history     库存变动历史
POST   /api/stock/check       盘点修正
```

### 文件上传

```
POST   /api/file/upload       上传照片到MinIO
```

## 业务流程

### 入库流程
1. 选择类型（设备件/常用件）
2. **设备件**：选择或关联产品；**常用件**：配置规格选项（如 ["3mm", "2.5mm"]）
3. 填写数量、日期、上传照片
4. 创建 InventoryItem（如不存在）或更新库存
5. 记录 StockInRecord

### 出库流程
1. 选择产品
2. 显示该产品关联的设备件（InventoryItem 中 type='device' 且 productId 匹配）
3. 选择设备件，填写数量、日期
4. 扣减库存（允许负数），记录 StockOutRecord

### 盘点流程
1. 选择零件（设备件/常用件）
2. 输入实际库存数量
3. 更新 InventoryItem 库存，记录 InventoryCheck

## 库存预警规则

当 `currentStock <= warnStock` 时，该件出现在预警列表中。

## 响应格式

遵循 saleshub_serv 规范：

```typescript
{
    result: 0,      // 0 成功，非 0 失败
    msg: 'success',
    alg: '',
    datas: {}
}
```

## 数据库 Schema

使用 PostgreSQL，建议 schema 名为 `inventory`。
