<template>
  <a-layout class="default-layout">
    <a-layout-header class="header">
      <div class="logo">
        <h1>SalesHub 库存管理系统</h1>
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="horizontal"
        :style="{ lineHeight: '64px' }"
      >
        <a-menu-item key="products" @click="$router.push('/inventory/products')">
          产品管理
        </a-menu-item>
        <a-menu-item key="items" @click="$router.push('/inventory/items')">
          库存管理
        </a-menu-item>
        <a-menu-item key="stock-in" @click="$router.push('/inventory/stock-in')">
          入库管理
        </a-menu-item>
        <a-menu-item key="stock-out" @click="$router.push('/inventory/stock-out')">
          出库管理
        </a-menu-item>
        <a-menu-item key="history" @click="$router.push('/inventory/history')">
          库存历史
        </a-menu-item>
        <a-menu-item key="warnings" @click="$router.push('/inventory/warnings')">
          库存预警
        </a-menu-item>
      </a-menu>
    </a-layout-header>
    <a-layout-content class="content">
      <router-view />
    </a-layout-content>
    <a-layout-footer class="footer">
      SalesHub 库存管理系统 ©2024
    </a-layout-footer>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const selectedKeys = ref<string[]>([]);

// Update selected menu item based on current route
watch(
  () => route.path,
  (newPath) => {
    const pathMap: Record<string, string> = {
      '/inventory/products': 'products',
      '/inventory/items': 'items',
      '/inventory/stock-in': 'stock-in',
      '/inventory/stock-out': 'stock-out',
      '/inventory/history': 'history',
      '/inventory/warnings': 'warnings'
    };
    selectedKeys.value = [pathMap[newPath] || 'products'];
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.default-layout {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: #001529;

  .logo {
    float: left;
    margin-right: 40px;

    h1 {
      color: #fff;
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      line-height: 64px;
    }
  }
}

.content {
  padding: 24px;
  margin: 24px;
  min-height: 280px;
  background: #fff;
  border-radius: 4px;
}

.footer {
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
}
</style>
