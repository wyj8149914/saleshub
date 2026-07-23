# 移动端零件拍照上传功能设计

## 背景

仓库人员需要使用手机为零件拍照上传图片，需要：
1. 移动端登录后直接进入零件列表
2. 移动端隐藏侧边栏，只显示零件列表功能
3. 零件列表卡片式布局，每张卡片有拍照按钮
4. 点击拍照按钮调用摄像头拍照并上传

## 设备判定

使用 `window.innerWidth < 768` 判定移动端。

## 功能设计

### 1. 登录跳转逻辑

**当前行为：** 登录成功后跳转到 `/inventory/products`

**修改：**
- 桌面端（≥768px）：保持跳转到 `/inventory/products`
- 移动端（<768px）：跳转到 `/inventory/items`

### 2. DefaultLayout 移动端适配

**当前行为：** 移动端（≤1024px）显示缩略图标菜单

**修改：**
- 移动端（<768px）：完全隐藏侧边栏
- 内容区占满全屏
- 顶栏保留页面标题和退出登录按钮

### 3. InventoryList 移动端适配

#### 布局

| 端 | 布局 |
|---|---|
| 桌面端（≥768px） | 保持现有表格布局 |
| 移动端（<768px） | 卡片列表布局 |

#### 移动端卡片内容

每张卡片显示：
- 零件图片（左侧，80x80）
- 零件信息（右侧）：类型、名称、编码、库存
- 拍照按钮（卡片底部）

#### 移动端筛选区

简化为：
- 搜索框（按名称搜索）
- 类型筛选下拉

### 4. 拍照上传功能

#### 交互流程

```
点击拍照按钮 → 调用摄像头 → 拍照 → 自动上传 → 更新图片
```

#### 技术实现

使用 `<input type="file" accept="image/*" capture="environment">`：
- `accept="image/*"` 只接受图片
- `capture="environment"` 优先调用后置摄像头

#### API 调用

1. `fileApi.uploadFile(file)` 上传图片获取 URL
2. `inventoryApi.updateItem({ item_id, image_url })` 更新零件图片

#### 状态反馈

- 上传中：按钮显示 loading 状态
- 上传成功：message 提示 "图片上传成功"，卡片图片刷新
- 上传失败：message 提示错误信息

## 文件改动

| 文件 | 改动 |
|---|---|
| `src/utils/device.ts` | 新增设备检测工具函数 |
| `src/views/Login.vue` | 移动端登录后跳转到零件列表 |
| `src/layouts/DefaultLayout.vue` | 移动端隐藏侧边栏 |
| `src/views/inventory/InventoryList.vue` | 移动端卡片布局 + 拍照功能 |
