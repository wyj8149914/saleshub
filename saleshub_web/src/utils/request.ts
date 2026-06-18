import axios, { type AxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

export interface ApiResponse<T = unknown> {
  result: number
  msg: string
  alg: string
  datas: T
}

const PUBLIC_URLS = ['/saleshub/user/login', '/saleshub/user/refresh']

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

instance.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const isPublic = PUBLIC_URLS.some((u) => config.url?.includes(u))
    if (authStore.token && !isPublic) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse
    if (data.result !== 0) {
      const msg = data.msg || '操作失败'
      message.error(msg)
      return Promise.reject(new Error(msg))
    }
    return response
  },
  (error) => {
    const status: number | undefined = error?.response?.status
    const code: string | undefined = error?.code

    if (status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      const current = router.currentRoute.value
      if (current.name !== 'Login') {
        router.replace({
          name: 'Login',
          query: { redirect: current.fullPath }
        })
      }
      return Promise.reject(error)
    }

    if (code === 'ECONNABORTED') {
      message.error('请求超时，请稍后重试')
      return Promise.reject(error)
    }

    if (code === 'ERR_NETWORK') {
      message.error('网络连接异常，请检查网络')
      return Promise.reject(error)
    }

    const biz: ApiResponse | undefined = error?.response?.data
    const msg = biz?.msg || `请求失败 (${status ?? 'unknown'})`
    message.error(msg)
    return Promise.reject(error)
  }
)

export const http = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return instance.get<ApiResponse<T>>(url, config).then((res) => res.data)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return instance.post<ApiResponse<T>>(url, data, config).then((res) => res.data)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return instance.put<ApiResponse<T>>(url, data, config).then((res) => res.data)
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return instance.delete<ApiResponse<T>>(url, config).then((res) => res.data)
  }
}

export { instance as request }
export default http
