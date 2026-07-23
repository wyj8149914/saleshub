<template>
  <div class="login-page">
    <!-- 品牌面板：仅在桌面端（≥1024px）显示，移动端隐藏 -->
    <aside class="brand-panel" aria-hidden="true">
      <div class="brand-bg">
        <div class="brand-grid"></div>
        <div class="brand-glow brand-glow-1"></div>
        <div class="brand-glow brand-glow-2"></div>
      </div>

      <div class="brand-inner">
        <header class="brand-header">
          <span class="logo-mark">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
              <rect x="17" y="2" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
              <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
              <rect x="17" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.85" />
            </svg>
          </span>
          <span class="logo-text">SalesHub</span>
        </header>

        <div class="brand-headline">
          <h1>库存管理<br />尽在掌控</h1>
          <p>为仓储与供应链团队打造的库存操作平台，覆盖产品、出入库、预警与历史追溯。</p>
        </div>

        <ul class="brand-features">
          <li>
            <CheckOutlined class="feature-icon" />
            <span>实时库存追踪与产品关联</span>
          </li>
          <li>
            <CheckOutlined class="feature-icon" />
            <span>智能预警与出入库审批</span>
          </li>
          <li>
            <CheckOutlined class="feature-icon" />
            <span>完整历史溯源与报表</span>
          </li>
        </ul>

        <footer class="brand-footer">
          <span>SalesHub Inventory Platform</span>
          <span>© 2026 深圳市光克拉科技有限公司 版权所有</span>
        </footer>
      </div>
    </aside>

    <main class="form-panel">
      <div class="form-wrapper">
        <!-- 移动端 Logo：brand-panel 在窄屏隐藏时，此处补回品牌标识 -->
        <header class="form-brand-mobile">
          <span class="logo-mark">
            <svg viewBox="0 0 32 32" width="24" height="24">
              <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
              <rect x="17" y="2" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
              <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.5" />
              <rect x="17" y="17" width="13" height="13" rx="3" fill="currentColor" opacity="0.85" />
            </svg>
          </span>
          <span class="logo-text">SalesHub</span>
        </header>

        <div class="form-header">
          <h2>欢迎回来</h2>
          <p>请输入您的账号信息以继续</p>
        </div>

        <a-form :model="form" :rules="rules" layout="vertical" class="login-form" @finish="handleSubmit">
          <a-form-item label="账号" name="username">
            <a-input v-model:value="form.username" size="large" placeholder="请输入账号" allow-clear autocomplete="username">
              <template #prefix>
                <UserOutlined />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="form.password" size="large" placeholder="请输入密码"
              autocomplete="current-password">
              <template #prefix>
                <LockOutlined />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" size="large" :loading="loading" block>
              登录
            </a-button>
          </a-form-item>
        </a-form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
  /**
   * 登录页：左右分屏布局
   * - 左侧 brand-panel：品牌展示（桌面端可见）
   * - 右侧 form-panel：账号密码表单
   * 设计 token 与 DefaultLayout.vue 保持一致，确保两个页面品牌感统一
   */
  import { ref, reactive } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { message } from 'ant-design-vue'
  import { UserOutlined, LockOutlined, CheckOutlined } from '@ant-design/icons-vue'
  import { useAuthStore } from '@/stores/auth'
  import type { LoginPayload } from '@/types/auth'
  import { isMobile } from '@/utils/device'

  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()

  const loading = ref(false)

  const form = reactive<LoginPayload>({
    username: '',
    password: ''
  })

  const rules = {
    username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
  }

  async function handleSubmit() {
    loading.value = true
    try {
      await authStore.login({
        username: form.username,
        password: form.password
      })
      message.success('登录成功')
      // 移动端跳转到零件列表，桌面端跳转到产品列表；若 URL 带 redirect 参数则优先跳该地址
      const defaultRedirect = isMobile() ? '/inventory/items' : '/inventory/products'
      const redirect = (route.query.redirect as string) || defaultRedirect
      router.replace(redirect)
    } catch {
      // 业务错误（用户名/密码错误等）已由 utils/request.ts 的拦截器统一弹窗，此处静默
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>

  /* ============ Tokens（与 DefaultLayout.vue 共享同一套品牌色与圆角） ============ */
  .login-page {
    /* Brand panel */
    --brand-bg: #0a0f1e;
    --brand-text: #f4f6fb;
    --brand-text-muted: rgba(244, 246, 251, 0.62);
    --brand-border: rgba(244, 246, 251, 0.08);

    /* Form panel */
    --form-bg: #fafafa;
    --form-card: #ffffff;
    --form-text: #18181b;
    --form-text-muted: #52525b;
    --form-border: #e4e4e7;

    /* Locked accent (single blue, used everywhere) */
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --accent-soft: rgba(37, 99, 235, 0.14);

    /* Shape */
    --radius-sm: 8px;
    --radius-md: 12px;

    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr;
    background: var(--form-bg);
    color: var(--form-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ============ Brand panel ============ */
  .brand-panel {
    display: none;
    position: relative;
    overflow: hidden;
    background: var(--brand-bg);
    color: var(--brand-text);
    isolation: isolate;
  }

  .brand-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .brand-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 60% at 30% 20%, black 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 30% 20%, black 0%, transparent 75%);
  }

  .brand-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
  }

  .brand-glow-1 {
    width: 520px;
    height: 520px;
    top: -140px;
    left: -140px;
    background: radial-gradient(circle, #1e40af 0%, transparent 70%);
    opacity: 0.55;
    animation: drift-1 24s ease-in-out infinite;
  }

  .brand-glow-2 {
    width: 380px;
    height: 380px;
    bottom: -100px;
    right: -100px;
    background: radial-gradient(circle, #0ea5e9 0%, transparent 70%);
    opacity: 0.32;
    animation: drift-2 30s ease-in-out infinite;
  }

  @keyframes drift-1 {

    0%,
    100% {
      transform: translate(0, 0);
    }

    50% {
      transform: translate(60px, 40px);
    }
  }

  @keyframes drift-2 {

    0%,
    100% {
      transform: translate(0, 0);
    }

    50% {
      transform: translate(-40px, -60px);
    }
  }

  .brand-inner {
    position: relative;
    z-index: 1;
    height: 100%;
    padding: 48px 56px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .brand-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    filter: drop-shadow(0 4px 14px rgba(37, 99, 235, 0.35));
  }

  .logo-text {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .brand-headline {
    margin-top: auto;
    margin-bottom: auto;
    max-width: 38ch;
  }

  .brand-headline h1 {
    font-size: 44px;
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 600;
    margin: 0 0 20px 0;
    color: var(--brand-text);
  }

  .brand-headline p {
    font-size: 15px;
    line-height: 1.65;
    color: var(--brand-text-muted);
    margin: 0;
  }

  .brand-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .brand-features li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: var(--brand-text-muted);
  }

  .feature-icon {
    font-size: 13px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .brand-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--brand-text-muted);
    padding-top: 24px;
    border-top: 1px solid var(--brand-border);
    letter-spacing: 0.02em;
  }

  /* ============ Form panel ============ */
  .form-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    min-height: 100dvh;
  }

  .form-wrapper {
    width: 100%;
    max-width: 400px;
    animation: form-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes form-enter {
    from {
      opacity: 0;
      transform: translateY(16px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .form-brand-mobile {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 48px;
  }

  .form-brand-mobile .logo-mark {
    color: var(--accent);
  }

  .form-brand-mobile .logo-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--form-text);
    letter-spacing: -0.01em;
  }

  .form-header {
    margin-bottom: 32px;
  }

  .form-header h2 {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--form-text);
    margin: 0 0 8px 0;
    line-height: 1.2;
  }

  .form-header p {
    font-size: 14px;
    color: var(--form-text-muted);
    margin: 0;
  }

  /* ============ Ant Design Vue overrides ============ */
  .login-form :deep(.ant-form-item) {
    margin-bottom: 18px;
  }

  .login-form :deep(.ant-form-item-label > label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--form-text);
    height: auto;
    padding-bottom: 6px;
  }

  .login-form :deep(.ant-form-item-label > label::after) {
    display: none;
  }

  .login-form :deep(.ant-input-affix-wrapper),
  .login-form :deep(.ant-input) {
    border-radius: var(--radius-sm);
    border-color: var(--form-border);
    background: var(--form-card);
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .login-form :deep(.ant-input-affix-wrapper:hover),
  .login-form :deep(.ant-input:hover) {
    border-color: #d4d4d8;
  }

  .login-form :deep(.ant-input-affix-wrapper-focused),
  .login-form :deep(.ant-input-affix-wrapper:focus-within),
  .login-form :deep(.ant-input:focus) {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .login-form :deep(.ant-input-prefix) {
    color: #a1a1aa;
    margin-right: 10px;
  }

  /* Primary button */
  .login-form :deep(.ant-btn-primary) {
    background: var(--accent);
    border-color: var(--accent);
    border-radius: var(--radius-sm);
    height: 44px;
    font-size: 15px;
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.12);
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease,
      box-shadow 0.18s ease;
  }

  .login-form :deep(.ant-btn-primary:not(:disabled):hover) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(37, 99, 235, 0.28);
  }

  .login-form :deep(.ant-btn-primary:not(:disabled):active) {
    transform: translateY(0);
    background: var(--accent-hover);
  }

  /* ============ Responsive ============ */
  @media (min-width: 1024px) {
    .login-page {
      grid-template-columns: 1fr 1fr;
    }

    .brand-panel {
      display: block;
    }

    .form-brand-mobile {
      display: none;
    }

    .form-panel {
      padding: 48px;
    }
  }

  @media (min-width: 1280px) {
    .brand-inner {
      padding: 64px 72px;
    }

    .brand-headline h1 {
      font-size: 52px;
    }
  }

  @media (max-width: 640px) {
    .form-panel {
      padding: 32px 20px;
    }

    .form-header h2 {
      font-size: 24px;
    }

    .form-header {
      margin-bottom: 28px;
    }
  }

  /* ============ Reduced motion ============ */
  @media (prefers-reduced-motion: reduce) {

    .brand-glow-1,
    .brand-glow-2,
    .form-wrapper {
      animation: none;
      transition: none;
    }
  }
</style>
