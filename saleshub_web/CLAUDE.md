# SalesHub Web 前端代码规范

## 项目概述

Vue3 + TypeScript + Ant Design Vue 前端应用。

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **UI 组件库**: Ant Design Vue 4.x
- **状态管理**: Pinia
- **HTTP 客户端**: Axios
- **路由**: Vue Router
- **构建工具**: Vite
- **代码规范**: ESLint + Prettier

## 目录结构

```
src/
├── api/              # API 接口定义
│   └── inventory.ts  # 库存管理接口
├── assets/           # 静态资源（图片、样式等）
├── components/       # 公共组件
│   └── inventory/    # 库存模块组件
├── composables/      # 组合式函数 (可复用逻辑)
├── layouts/          # 布局组件
├── router/           # 路由配置
│   └── index.ts      # 路由定义
├── stores/           # Pinia 状态管理
├── types/            # TypeScript 类型定义
│   └── inventory.ts  # 库存模块类型
├── utils/            # 工具函数
├── views/            # 页面组件
│   └── inventory/    # 库存模块页面
├── App.vue           # 根组件
└── main.ts           # 应用入口
```

## 编码规范

### TypeScript 配置

- Target: ES2020
- Module: ESNext
- Strict: 启用
- JSX: Vue JSX 模式
- 路径别名: `@` 指向 `src`

### 代码风格 (Prettier)

- 引号: 双引号 `"`
- 分号: 必须
- 缩进: 2 空格
- 行宽: 100 字符
- 尾部逗号: ES5
- 换行: LF
- Vue 单文件组件: `<script setup lang="ts">` 格式
- 代码需要加上必要的注释,方法需要有功能说明,复杂的业务逻辑需要详细的说明

### 命名规范

| 类型                 | 命名规则                | 示例                                       |
| -------------------- | ----------------------- | ------------------------------------------ |
| 组件 (.vue)          | PascalCase              | `ProductList.vue`, `InventoryItemForm.vue` |
| TypeScript 接口/类型 | PascalCase              | `Product`, `InventoryItem`, `ApiResponse`  |
| 枚举                 | PascalCase              | `ItemType`, `ItemStatus`                   |
| 变量/函数            | camelCase               | `loadProducts`, `handleDelete`             |
| 常量                 | camelCase 或 UPPER_CASE | `apiUrl`, `MAX_SIZE`                       |
| CSS 类名             | kebab-case              | `.product-list`, `.inventory-item`         |
| 路由名称             | PascalCase              | `ProductList`, `StockIn`                   |

### 导入顺序

1. Vue 核心库 (`vue`, `vue-router`)
2. 第三方 npm 包 (`ant-design-vue`, `axios`)
3. 项目内部模块（使用 `@/` 别名）

## 组件规范

### 单文件组件结构

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';

// 2. Props 定义
interface Props {
  visible: boolean;
  item?: Item | null;
}
const props = defineProps<Props>();

// 3. Emits 定义
interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}
const emit = defineEmits<Emits>();

// 4. 状态定义
const loading = ref(false);
const form = ref({});

// 5. 计算属性
const isEdit = computed(() => !!props.item);

// 6. 方法
const handleSubmit = async () => {
  // 实现
};

// 7. 生命周期
onMounted(() => {
  // 初始化
});
</script>

<style scoped lang="scss">
/* 样式 */
</style>
```

### 组件命名

- 组件文件名使用 PascalCase：`ProductList.vue`
- 组件注册使用 kebab-case：`<product-form />`
- 组件内部变量使用 camelCase：`const productForm = ref()`

## API 接口规范

### 接口定义

```typescript
// api/inventory.ts
import axios from 'axios';
import type { ApiResponse, Product } from '@/types/inventory';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

export const inventoryApi = {
  async getProducts(): Promise<ApiResponse<Product[]>> {
    const { data } = await api.get<ApiResponse<Product[]>>('/api/product');
    return data;
  },

  async createProduct(product: Partial<Product>): Promise<ApiResponse<Product>> {
    const { data } = await api.post<ApiResponse<Product>>('/api/product', product);
    return data;
  },
};
```

### 统一响应格式

```typescript
interface ApiResponse<T = any> {
  result: number; // 0 成功，非 0 失败
  msg: string;
  alg: string;
  datas: T;
}
```

## 类型定义规范

### 类型定义

```typescript
// types/inventory.ts
export enum ItemType {
  DEVICE = 'device',
  COMMON = 'common',
}

export interface Product {
  productId: string;
  name: string;
  code: string;
  description: string;
  status: number;
  createdAt: Date;
}

export interface InventoryItem {
  itemId: string;
  type: ItemType;
  name: string;
  // ...
}
```

## Pinia Store 规范

### Store 定义

```typescript
// stores/inventory.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Product } from '@/types/inventory';

export const useInventoryStore = defineStore('inventory', () => {
  const products = ref<Product[]>([]);
  const loading = ref(false);

  const fetchProducts = async () => {
    loading.value = true;
    try {
      const response = await inventoryApi.getProducts();
      if (response.result === 0) {
        products.value = response.datas;
      }
    } finally {
      loading.value = false;
    }
  };

  return {
    products,
    loading,
    fetchProducts,
  };
});
```

## 路由规范

### 路由定义

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/layouts/DefaultLayout.vue'),
    children: [
      {
        path: 'products',
        name: 'ProductList',
        component: () => import('@/views/inventory/ProductList.vue'),
        meta: { title: '产品管理' },
      },
    ],
  },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
```

## Ant Design Vue 使用规范

### 组件导入

```typescript
import { message, Modal } from 'ant-design-vue';
```

### 消息提示

```typescript
// 成功提示
message.success('操作成功');

// 错误提示
message.error('操作失败');

// 确认对话框
Modal.confirm({
  title: '确认删除？',
  onOk: async () => {
    await handleDelete();
  },
});
```

### 表单验证

```vue
<a-form :model="form" :rules="rules" @finish="handleSubmit">
  <a-form-item label="名称" name="name" :rules="[{ required: true, message: '请输入名称' }]">
    <a-input v-model:value="form.name" />
  </a-form-item>
</a-form>
```

## 错误处理

### API 错误处理

```typescript
const loadData = async () => {
  loading.value = true;
  try {
    const response = await api.getData();
    if (response.result === 0) {
      data.value = response.datas;
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('加载失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};
```

## 开发指南

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npm run type-check
```

### 代码检查

```bash
npm run lint
```

### 格式化代码

```bash
npm run format
```

## 注意事项

1. **使用 Composition API**: 优先使用 `<script setup>` 语法
2. **类型安全**: 所有 props 和 emits 必须有类型定义
3. **API 调用**: 统一使用定义好的 API 接口，不要在组件中直接调用 axios
4. **状态管理**: 复杂状态使用 Pinia，简单状态使用组件内部 ref
5. **代码复用**: 可复用逻辑提取到 composables
6. **样式隔离**: 使用 `<style scoped>` 避免样式污染

## 最佳实践

1. **组件拆分**: 保持组件职责单一，大型组件拆分为多个小组件
2. **懒加载**: 路由和大型组件使用动态导入
3. **防抖节流**: 搜索、输入等场景使用防抖
4. **加载状态**: 异步操作显示 loading 状态
5. **错误边界**: 关键操作添加错误处理和用户提示
6. **性能优化**: 列表使用虚拟滚动，图片使用懒加载

## Git Commit 规范

### 提交消息格式规范

不要主动提交代码,本项目遵循结构化的Git提交消息格式,包含以下部分:

```
<类型>: <简短描述>

## 详细变更说明

### 1. <主要功能/模块名称>
- 具体变更1
- 具体变更2

### 2. <另一个功能/模块名称>
- 具体变更3
- 具体变更4

...

### N. 其他变更
- 代码清理/优化说明

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 提交类型 (Type)

使用中文类型标识,常见类型包括:

- **功能** (feat): 新功能
- **修改** (fix): Bug修复
- **重构** (refactor): 代码重构(不改变功能)
- **新增** (add): 添加新内容(文档/配置等)
- **删除** (remove): 删除功能或文件
- **优化** (optimize): 性能或代码优化
- **文档** (docs): 文档变更
- **测试** (test): 测试相关

### 提交消息编写规范

1. **第一行**: `<类型>: <简短描述>` (不超过50字)
   - 使用中文,简洁明确
   - 使用祈使句语气
   - 不包含句号

2. **详细说明**: 使用 `## 主要变更` 或 `## 详细变更说明` 开头
   - 按模块/功能分类
   - 每个变更使用 `-` 列表
   - 具体说明变更内容和原因

3. **Co-Authored-By**: 使用AI辅助开发时必须添加
   ```
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   ```

### 提交前检查清单

在执行 `git commit` 前,确保:

1. ✅ **代码已测试**: 新功能正常工作,无运行时错误
2. ✅ **无调试代码**: 移除所有 `console.log`, `debugger` 等
3. ✅ **代码格式**: 运行 `npm run lint` 确保代码风格一致
4. ✅ **敏感信息**: 不包含 `.env` 等敏感配置文件
5. ✅ **提交消息**: 使用完整格式,清晰描述变更内容

### 提交示例

**好的提交示例:**

```
功能: 网格工单系统新增区域用户支持及微信登录功能

## 主要变更

### 1. 网格工单系统优化
- 新增区域工单列表查询接口(/districtList),支持区域用户按权限查询辖区内工单
- 优化12345工单处理逻辑,支持通过community_id直接关联工单,不依赖grid_id

### 2. 区域用户微信登录支持
- DistrictUser实体新增open_id和union_id字段,支持微信登录绑定
- 微信登录接口(getGridBindInfo)新增区域用户登录支持

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**不好的提交示例:**

```
fix bug
update
feat
tmp
```

1. **不要自动提交**: 不要自动提交代码,只有明确说明提交代码时才提交
2. **不要自动推送**: 提交代码时不要使用 `git push`
3. **提交消息语言**:
   - 使用中文编写提交消息
   - 技术术语可以保留英文(如: JWT, TypeORM, API等)
