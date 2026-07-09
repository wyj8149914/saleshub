# SalesHub 系统首页设计文档

## 概述

为 SalesHub 库存管理系统设计一个仪表盘式首页，用于展示系统运行状态和提供快速操作入口。

## 设计目标

- **混合场景**：兼顾管理决策和日常运营需求
- **数据可视化**：清晰展示核心业务指标
- **快速访问**：提供常用功能的快速入口

## 布局设计

采用仪表盘式布局，分为三个区域：

### 1. 顶部主指标区（左侧 2/3）

展示产品维度的 4 个核心指标卡片：

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 产品总数 | `Product` 表 | 显示产品总数量，标注本周新增 |
| 零件总数 | `InventoryItem` 表 | 显示零件总数量，标注本周新增 |
| 规格数量 | `ItemSpec` 表 | 显示规格总数量，显示平均规格/零件 |
| 模块总数 | `ProductModule` 表 | 显示模块总数量，标注本周新增 |

**卡片设计**：
- 大数字突出显示（40px，加粗）
- 左侧彩色边框标识类型
- 显示趋势说明（如"↑ 8 本周新增"）
- 白色背景，阴影效果

### 2. 快速操作区（右侧 1/3）

提供 4 个常用功能入口按钮：

1. **入库管理** - 蓝色按钮，跳转到入库页面
2. **出库管理** - 绿色按钮，跳转到出库页面
3. **盘点管理** - 紫色按钮，跳转到盘点页面
4. **库存历史** - 灰色按钮，跳转到历史页面

**按钮设计**：
- 彩色背景，白色文字
- 图标 + 文字组合
- 垂直排列，等宽等高

### 3. 底部业务活跃度区（三栏）

展示本周业务数据：

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 本周入库总数 | `StockInRecord` 表 | 本周入库数量总和 + 记录数 + 进度条 |
| 本周出库总数 | `StockOutRecord` 表 | 本周出库数量总和 + 记录数 + 进度条 |
| 本周盘点次数 | `StockCheckRecord` 表 | 本周盘点次数 + 盘点零件数 + 进度条 |

**卡片设计**：
- 大数字显示（32px）
- 说明文字（如"18 笔入库记录"）
- 底部渐变进度条展示趋势

## 数据统计逻辑

### 本周数据统计

- 时间范围：本周一 00:00:00 至当前时间
- 入库总数：`SUM(quantity)` WHERE `date >= 本周一`
- 出库总数：`SUM(quantity)` WHERE `date >= 本周一`
- 盘点次数：`COUNT(*)` WHERE `date >= 本周一`

### 新增数据统计

- 产品新增：本周创建的产品数量
- 零件新增：本周创建的零件数量
- 模块新增：本周创建的模块数量

## 页面路由

- 路由路径：`/inventory/dashboard`
- 路由名称：`Dashboard`
- 页面标题：系统首页
- 菜单位置：作为"库存管理"的第一个子菜单

## API 接口需求

需要新增统计接口：

```typescript
// 获取首页统计数据
GET /saleshub/inventory/dashboardStats

// 响应数据结构
interface DashboardStats {
  // 产品维度
  productCount: number
  productNewThisWeek: number
  itemCount: number
  itemNewThisWeek: number
  specCount: number
  avgSpecsPerItem: number
  moduleCount: number
  moduleNewThisWeek: number

  // 业务活跃度
  weeklyStockIn: number
  weeklyStockInRecords: number
  weeklyStockOut: number
  weeklyStockOutRecords: number
  weeklyCheckCount: number
  weeklyCheckItems: number
}
```

## 技术实现

### 前端组件

创建 `src/views/inventory/Dashboard.vue` 文件，包含：

- 顶部指标卡片组件（StatCard）
- 快速操作按钮区
- 底部业务卡片组件（ActivityCard）
- 数据加载状态管理
- 错误处理

### 样式规范

- 遵循项目现有的 Design Token
- 使用 Ant Design Vue 组件
- 响应式设计，支持移动端
- 颜色使用：蓝色(#1890ff)、绿色(#52c41a)、紫色(#722ed1)、橙色(#faad14)

## 性能优化

- 统计数据接口缓存 5 分钟
- 页面加载时显示骨架屏
- 数据刷新采用静默更新

## 后续扩展

未来可考虑添加：

- 库存预警提醒功能
- 数据导出功能
- 更多维度的统计图表
- 自定义首页配置
