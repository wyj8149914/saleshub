import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { LoginPayload, UserInfo } from '@/types/auth'

const TOKEN_KEY = 'saleshub_token'
const USER_KEY = 'saleshub_user'

function readUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<UserInfo | null>(readUser())

  const isLoggedIn = computed(() => !!token.value)

  function login(payload: LoginPayload) {
    const fakeToken = `fake-token-${Date.now()}`
    const fakeUser: UserInfo = { username: payload.username }
    token.value = fakeToken
    user.value = fakeUser
    localStorage.setItem(TOKEN_KEY, fakeToken)
    localStorage.setItem(USER_KEY, JSON.stringify(fakeUser))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLoggedIn, login, logout }
})
