import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { public: true, title: '登录' }
    },
    {
        path: '/',
        redirect: '/login'
    },
    {
        path: '/inventory',
        component: () => import('@/layouts/DefaultLayout.vue'),
        redirect: '/inventory/products',
        meta: { requiresAuth: true, title: '库存管理' },
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
                meta: { title: '零件管理' }
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
                path: 'stock-check',
                name: 'StockCheck',
                component: () => import('@/views/inventory/StockCheck.vue'),
                meta: { title: '盘点管理' }
            },
            {
                path: 'history',
                name: 'StockHistory',
                component: () => import('@/views/inventory/StockHistory.vue'),
                meta: { title: '库存历史' }
            },
            {
                path: 'warehouse',
                name: 'WarehouseList',
                component: () => import('@/views/inventory/WarehouseList.vue'),
                meta: { title: '仓库管理' }
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
    // if (to.name === 'Login' && authStore.isLoggedIn) {
    //     return { path: '/inventory/items' }
    // }
    return true
})

export default router
