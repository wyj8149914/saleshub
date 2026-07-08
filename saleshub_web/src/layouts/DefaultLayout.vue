<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-bg">
        <div class="sidebar-grid"></div>
        <div class="sidebar-glow"></div>
      </div>

      <div class="sidebar-header">
        <span class="logo-mark">
          <svg viewBox="0 0 32 32" width="26" height="26">
            <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
            <rect x="17" y="2" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
            <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
            <rect x="17" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.85" />
          </svg>
        </span>
        <span class="logo-text">SalesHub</span>
      </div>

      <nav class="sidebar-menu">
        <template v-for="item in menuItems" :key="item.label">
          <template v-if="item.children">
            <button type="button" class="menu-item menu-item-parent"
              :class="{ 'menu-item-contains-active': containsActive(item) }" :aria-expanded="expandedMap[item.label]"
              @click="toggleExpand(item.label)">
              <component :is="item.icon" v-if="item.icon" class="menu-icon" />
              <span class="menu-label">{{ item.label }}</span>
              <DownOutlined class="menu-chevron" :class="{ 'menu-chevron-open': expandedMap[item.label] }" />
            </button>
            <div v-show="expandedMap[item.label]" class="menu-submenu">
              <router-link v-for="child in item.children" :key="child.path" :to="child.path!"
                class="menu-item menu-item-child" active-class="menu-item-active">
                <component :is="child.icon" v-if="child.icon" class="menu-icon" />
                <span class="menu-label">{{ child.label }}</span>
              </router-link>
            </div>
          </template>

          <router-link v-else :to="item.path!" class="menu-item" active-class="menu-item-active">
            <component :is="item.icon" v-if="item.icon" class="menu-icon" />
            <span class="menu-label">{{ item.label }}</span>
          </router-link>
        </template>
      </nav>

      <div class="sidebar-footer">
        <span>SalesHub Inventory Platform</span>
        <span>© 2026</span>
      </div>
    </aside>

    <header class="topbar">
      <h1 class="page-title">{{ currentTitle }}</h1>

      <div class="topbar-actions">
        <button type="button" class="version-badge" title="查看更新日志" @click="openChangelog">
          <InfoCircleOutlined class="version-icon" />
          <span class="version-text">v{{ appVersion }}</span>
          <span class="version-label">更新日志</span>
        </button>

        <div class="user-area">
          <div class="user-info">
            <div class="user-avatar" :aria-label="displayName">{{ userInitial }}</div>
            <div class="user-meta">
              <span class="user-name">{{ displayName }}</span>
              <span class="user-role">{{ roleLabel }}</span>
            </div>
          </div>

          <a-button class="logout-btn" @click="handleLogout">
            <template #icon>
              <LogoutOutlined />
            </template>
            <span class="logout-label">退出登录</span>
          </a-button>
        </div>
      </div>
    </header>

    <main class="content">
      <router-view />
    </main>

    <a-modal v-model:open="changelogVisible" title="更新日志" :footer="null" width="860px"
      wrap-class-name="changelog-modal-wrap" class="changelog-modal" destroy-on-close>
      <iframe :src="changelogEmbedUrl" class="changelog-iframe" title="SalesHub 更新日志" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
  /**
   * 主框架布局：左侧菜单 + 顶部栏 + 主内容区
   * 通过 CSS Grid Areas 实现，sidebar / topbar / content 三块独立布局
   * 设计 token 与 Login.vue 共享，确保品牌一致
   */
  import { computed, reactive, ref, watch } from 'vue'
  import type { Component } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Modal, message } from 'ant-design-vue'
  import {
    AppstoreOutlined,
    DatabaseOutlined,
    DownOutlined,
    LogoutOutlined,
    BlockOutlined,
    ImportOutlined,
    ExportOutlined,
    AuditOutlined,
    HistoryOutlined,
    InfoCircleOutlined,
    HomeOutlined,
  } from '@ant-design/icons-vue'
  import { useAuthStore } from '@/stores/auth'
  import { APP_VERSION, CHANGELOG_EMBED_URL } from '@/constants/app'

  interface MenuItem {
    path?: string
    label: string
    icon?: Component
    children?: MenuItem[]
  }

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const appVersion = APP_VERSION
  const changelogEmbedUrl = CHANGELOG_EMBED_URL
  const changelogVisible = ref(false)

  function openChangelog() {
    changelogVisible.value = true
  }

  /**
   * 菜单配置：无 children 为一级菜单（直接跳路由），含 children 为可展开父级
   * 「库存预警」路由保留（直接访问 URL 仍可用），但菜单不展示
   */
  const menuItems: MenuItem[] = [
    { path: '/inventory/products', label: '产品管理', icon: AppstoreOutlined },
    {
      label: '库存管理',
      icon: DatabaseOutlined,
      children: [
        { path: '/inventory/items', label: '零件管理', icon: BlockOutlined },
        { path: '/inventory/warehouse', label: '仓库管理', icon: HomeOutlined },
        { path: '/inventory/stock-in', label: '入库管理', icon: ImportOutlined },
        { path: '/inventory/stock-out', label: '出库管理', icon: ExportOutlined },
        { path: '/inventory/stock-check', label: '盘点管理', icon: AuditOutlined },
        { path: '/inventory/history', label: '库存历史', icon: HistoryOutlined }
      ]
    }
  ]

  // 顶栏标题兜底：部分路由未配置 meta.title，按路由 name 匹配中文名
  const routeTitleMap: Record<string, string> = {
    ProductList: '产品管理',
    InventoryList: '零件管理',
    StockIn: '入库管理',
    StockOut: '出库管理',
    StockCheck: '盘点管理',
    StockHistory: '库存历史',
    StockWarning: '库存预警',
    WarehouseList: '仓库管理'
  }

  // 默认展开「库存管理」，避免首次进入时用户看不到子项
  const expandedMap = reactive<Record<string, boolean>>({
    库存管理: true
  })

  // 判断父级菜单是否包含激活的子项（用于父级文字高亮，区别于子项的 active 高亮）
  function containsActive(item: MenuItem): boolean {
    return !!item.children?.some((c) => c.path && route.path.startsWith(c.path))
  }

  function toggleExpand(label: string) {
    expandedMap[label] = !expandedMap[label]
  }

  // 路由切换时自动展开包含当前路由的父级，避免折叠状态下用户找不到当前位置
  watch(
    () => route.path,
    () => {
      menuItems.forEach((item) => {
        if (item.children && containsActive(item)) {
          expandedMap[item.label] = true
        }
      })
    },
    { immediate: true }
  )

  const currentTitle = computed(() => {
    const metaTitle = route.meta.title as string | undefined
    if (metaTitle) return metaTitle
    return routeTitleMap[route.name as string] || 'SalesHub'
  })

  const displayName = computed(
    () => authStore.user?.name || authStore.user?.username || '用户'
  )
  const userInitial = computed(() => displayName.value.charAt(0).toUpperCase())
  const roleLabel = computed(() => (authStore.user?.role === 'admin' ? '管理员' : '普通用户'))

  function handleLogout() {
    // 二次确认避免误触；确认后清理登录态并跳回登录页
    Modal.confirm({
      title: '确认退出登录？',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        authStore.logout()
        message.success('已退出登录')
        router.replace('/login')
      }
    })
  }
</script>

<style scoped>

  /* ============ Tokens（与 Login.vue 共享同一套品牌色与圆角） ============ */
  .app-layout {
    /* Brand (sidebar) */
    --brand-bg: #0a0f1e;
    --brand-text: #f4f6fb;
    --brand-text-muted: rgba(244, 246, 251, 0.62);
    --brand-border: rgba(244, 246, 251, 0.08);

    /* Surface (topbar / content) */
    --bg: #fafafa;
    --surface: #ffffff;
    --text: #18181b;
    --text-muted: #52525b;
    --border: #e4e4e7;

    /* Locked accent */
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --accent-soft: rgba(37, 99, 235, 0.16);
    --danger: #dc2626;
    --danger-soft: #fef2f2;
    --danger-border: #fecaca;

    /* Shape */
    --radius-sm: 8px;
    --radius-md: 12px;

    min-height: 100dvh;
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: 64px 1fr;
    grid-template-areas:
      'sidebar topbar'
      'sidebar content';
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ============ Sidebar ============ */
  .sidebar {
    grid-area: sidebar;
    position: relative;
    background: var(--brand-bg);
    color: var(--brand-text);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    isolation: isolate;
  }

  .sidebar-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .sidebar-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 50% at 30% 0%, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 80% 50% at 30% 0%, black 0%, transparent 70%);
  }

  .sidebar-glow {
    position: absolute;
    width: 360px;
    height: 360px;
    top: -120px;
    left: -80px;
    background: radial-gradient(circle, #1e40af 0%, transparent 70%);
    filter: blur(80px);
    opacity: 0.4;
  }

  .sidebar-header {
    position: relative;
    z-index: 1;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    border-bottom: 1px solid var(--brand-border);
    flex-shrink: 0;
  }

  .logo-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    filter: drop-shadow(0 4px 14px rgba(37, 99, 235, 0.35));
  }

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .sidebar-menu {
    position: relative;
    z-index: 1;
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    color: var(--brand-text-muted);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.18s ease, color 0.18s ease;
    position: relative;
    cursor: pointer;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--brand-text);
  }

  .menu-item-active {
    background: var(--accent-soft);
    color: #ffffff;
  }

  .menu-item-active::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--accent);
    border-radius: 0 3px 3px 0;
  }

  .menu-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  /* 父级菜单（可展开） */
  .menu-item-parent {
    width: 100%;
    background: transparent;
    border: none;
    text-align: left;
  }

  .menu-item-contains-active {
    color: var(--brand-text);
  }

  .menu-chevron {
    margin-left: auto;
    font-size: 10px;
    color: var(--brand-text-muted);
    transition: transform 0.2s ease;
  }

  .menu-chevron-open {
    transform: rotate(180deg);
  }

  /* 二级菜单 */
  .menu-submenu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0 6px 0;
  }

  .menu-item-child {
    padding-left: 28px;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  /* 子级图标比父级略小，维持视觉层级 */
  .menu-item-child .menu-icon {
    font-size: 14px;
    opacity: 0.85;
  }

  .menu-item-child.menu-item-active::before {
    height: 16px;
  }

  .sidebar-footer {
    position: relative;
    z-index: 1;
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--brand-text-muted);
    border-top: 1px solid var(--brand-border);
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  /* ============ Topbar ============ */
  .topbar {
    grid-area: topbar;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .page-title {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
    margin: 0;
    line-height: 1.2;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-left: auto;
  }

  .version-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--bg);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    font-family: inherit;
  }

  .version-badge:hover {
    color: var(--accent);
    border-color: rgba(37, 99, 235, 0.35);
    background: var(--accent-soft);
  }

  .version-icon {
    font-size: 13px;
    color: var(--accent);
  }

  .version-text {
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .version-label {
    padding-left: 6px;
    border-left: 1px solid var(--border);
  }

  .user-area {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, #1e40af 100%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .user-role {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .logout-btn {
    border-radius: var(--radius-sm) !important;
    border-color: var(--border) !important;
    color: var(--text-muted) !important;
    background: var(--surface) !important;
    font-size: 13px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease !important;
  }

  .logout-btn:hover {
    color: var(--danger) !important;
    border-color: var(--danger-border) !important;
    background: var(--danger-soft) !important;
  }

  /* ============ Content ============ */
  .content {
    grid-area: content;
    padding: 32px;
    overflow-y: auto;
  }

  .changelog-modal :deep(.ant-modal-content) {
    background: #0c0e14;
    border: 1px solid #252b38;
    border-radius: 12px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    padding: 0;
    overflow: hidden;
  }

  .changelog-modal :deep(.ant-modal-header) {
    background: #141820;
    border-bottom: 1px solid #252b38;
    margin-bottom: 0;
    padding: 14px 20px;
  }

  .changelog-modal :deep(.ant-modal-title) {
    color: #e8eaed;
    font-weight: 600;
  }

  .changelog-modal :deep(.ant-modal-close) {
    top: 14px;
    color: #8b93a7;
  }

  .changelog-modal :deep(.ant-modal-close:hover) {
    color: #e8eaed;
    background: rgba(255, 255, 255, 0.06);
  }

  .changelog-modal :deep(.ant-modal-body) {
    padding: 0;
    overflow: hidden;
    background: #0c0e14;
  }

  .changelog-iframe {
    display: block;
    width: 100%;
    height: 75vh;
    max-height: 720px;
    border: none;
    background: #0c0e14;
  }

  /* ============ Responsive ============ */
  @media (max-width: 1024px) {
    .app-layout {
      grid-template-columns: 72px 1fr;
    }

    .sidebar-header {
      padding: 0;
      justify-content: center;
    }

    .logo-text,
    .menu-label,
    .menu-chevron,
    .menu-submenu,
    .sidebar-footer {
      display: none !important;
    }

    .sidebar-menu {
      padding: 16px 8px;
      align-items: center;
    }

    .menu-item {
      justify-content: center;
      padding: 12px;
    }

    .menu-item-active::before {
      left: -8px;
    }
  }

  @media (max-width: 640px) {
    .user-meta {
      display: none;
    }

    .version-label {
      display: none;
    }

    .logout-label {
      display: none;
    }

    .content {
      padding: 20px;
    }

    .topbar {
      padding: 0 20px;
    }
  }

  /* ============ Reduced motion ============ */
  @media (prefers-reduced-motion: reduce) {

    .menu-item,
    .logout-btn {
      transition: none !important;
    }
  }
</style>
