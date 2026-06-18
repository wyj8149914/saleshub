import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import type { LoginPayload, LoginResponseData, UserInfo } from '@/types/auth'

const TOKEN_KEY = 'saleshub_token'
const REFRESH_TOKEN_KEY = 'saleshub_refresh_token'
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
    const refreshToken = ref<string>(localStorage.getItem(REFRESH_TOKEN_KEY) || '')
    const user = ref<UserInfo | null>(readUser())

    const isLoggedIn = computed(() => !!token.value)

    async function login(payload: LoginPayload): Promise<LoginResponseData> {
        const res = await userApi.login(payload)
        const data = res.datas
        const userInfo: UserInfo = {
            user_id: data.user_id,
            username: data.username,
            name: data.name,
            role: data.role
        }
        token.value = data.token
        refreshToken.value = data.refresh_token
        user.value = userInfo
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
        localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
        return data
    }

    function logout() {
        token.value = ''
        refreshToken.value = ''
        user.value = null
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
    }

    return { token, refreshToken, user, isLoggedIn, login, logout }
})
