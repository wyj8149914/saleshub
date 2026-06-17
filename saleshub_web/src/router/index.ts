import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    redirect: '/inventory/products'
  },
  {
    path: '/inventory',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/inventory/products',
    meta: { requiresAuth: true },
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
        component: () => import('@/views/inventory/InventoryList.vue')
      },
      {
        path: 'stock-in',
        name: 'StockIn',
        component: () => import('@/views/inventory/StockIn.vue')
      },
      {
        path: 'stock-out',
        name: 'StockOut',
        component: () => import('@/views/inventory/StockOut.vue')
      },
      {
        path: 'history',
        name: 'StockHistory',
        component: () => import('@/views/inventory/StockHistory.vue')
      },
      {
        path: 'warnings',
        name: 'StockWarning',
        component: () => import('@/views/inventory/StockWarning.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'Login' && authStore.isLoggedIn) {
    return { path: '/inventory/products' }
  }
  return true
})

export default router
