import { http } from '@/utils/request';
import type { LoginPayload, LoginResponseData } from '@/types/auth';

export const userApi = {
  login(payload: LoginPayload) {
    return http.post<LoginResponseData>('/saleshub/user/login', payload);
  },
};

export default userApi;
