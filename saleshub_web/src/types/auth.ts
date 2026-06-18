export type UserRole = 'admin' | 'user'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponseData {
  token: string
  refresh_token: string
  user_id: string
  username: string
  name: string
  role: UserRole
}

export interface UserInfo {
  user_id: string
  username: string
  name: string
  role: UserRole
}
