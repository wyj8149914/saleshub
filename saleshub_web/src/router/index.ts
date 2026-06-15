import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/inventory/products',
    children: [
      {
        path: 'products',
        name: 'ProductList',
        component: () => import('@/views/inventory/ProductList.vue'),
        meta: { title: '产品管理' }
      },
      {
        path: 'items',
        name: 'InventoryList',
        component: () => import('@/views/inventory/InventoryList.vue'),
        meta: { title: '库存管理' }
      },
      {
        path: 'stock-in',
        name: 'StockIn',
        component: () => import('@/views/inventory/StockIn.vue'),
        meta: { title: '入库管理' }
      },
      {
        path: 'stock-out',
        name: 'StockOut',
        component: () => import('@/views/inventory/StockOut.vue'),
        meta: { title: '出库管理' }
      },
      {
        path: 'history',
        name: 'StockHistory',
        component: () => import('@/views/inventory/StockHistory.vue'),
        meta: { title: '库存历史' }
      },
      {
        path: 'warnings',
        name: 'StockWarning',
        component: () => import('@/views/inventory/StockWarning.vue'),
        meta: { title: '库存预警' }
      }
    ]
  },
  {
    // Redirect root to inventory
    path: '/',
    redirect: '/inventory'
  },
  {
    // 404 Not Found
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面未找到' }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Navigation guard to update page title
router.beforeEach((to, from, next) => {
  const title = to.meta.title as string;
  if (title) {
    document.title = `${title} - SalesHub 库存管理系统`;
  }
  next();
});

export default router;
