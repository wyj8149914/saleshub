<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="title">SalesHub</h1>
        <p class="subtitle">库存管理系统</p>
      </div>

      <a-form :model="form" :rules="rules" layout="vertical" @finish="handleSubmit">
        <a-form-item label="账号" name="username">
          <a-input
            v-model:value="form.username"
            size="large"
            placeholder="请输入账号"
            allow-clear
          >
            <template #prefix>
              <UserOutlined />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="密码" name="password">
          <a-input-password
            v-model:value="form.password"
            size="large"
            placeholder="请输入密码"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item label="验证码" name="captcha">
          <div class="captcha-row">
            <a-input
              v-model:value="form.captcha"
              size="large"
              placeholder="请输入验证码"
              allow-clear
            >
              <template #prefix>
                <SafetyOutlined />
              </template>
            </a-input>
            <div class="captcha-box" title="请输入图中字符">{{ captchaText }}</div>
          </div>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            :loading="loading"
            block
          >
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import type { LoginPayload } from '@/types/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const captchaText = ref('A1B2')
const loading = ref(false)

const form = reactive<LoginPayload>({
  username: '',
  password: '',
  captcha: ''
})

const validateCaptcha = async (_rule: unknown, value: string) => {
  if (!value) {
    return Promise.reject('请输入验证码')
  }
  if (value.toUpperCase() !== captchaText.value) {
    return Promise.reject('验证码不正确')
  }
  return Promise.resolve()
}

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, validator: validateCaptcha, trigger: 'blur' }]
}

async function handleSubmit() {
  loading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 500))
    authStore.login({
      username: form.username,
      password: form.password,
      captcha: form.captcha
    })
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/inventory/products'
    router.replace(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a8a 0%, #6d28d9 100%);
}

.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: #1e3a8a;
  margin: 0;
}

.subtitle {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 8px;
}

.captcha-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.captcha-box {
  flex-shrink: 0;
  width: 120px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 6px;
  font-style: italic;
  color: #fff;
  background: repeating-linear-gradient(
    45deg,
    #1e3a8a,
    #1e3a8a 6px,
    #3b82f6 6px,
    #3b82f6 12px
  );
  border-radius: 4px;
  user-select: none;
}
</style>
