/**
 * 用户模块工具函数
 */

/**
 * 密码强度校验(与后端规则一致)
 * 规则:长度至少 8 位,且大写字母、小写字母、数字、特殊符号中至少包含三种
 * @param value 待校验密码
 * @returns 校验通过 resolve,不通过 reject 错误信息(可直接用于 a-form 自定义 validator)
 */
export function validatePasswordStrength(value: string): Promise<void> {
  if (!value) {
    return Promise.reject('请输入密码');
  }
  if (value.length < 8) {
    return Promise.reject('密码长度至少为8位');
  }
  const kinds = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (kinds < 3) {
    return Promise.reject('密码须包含大写字母、小写字母、数字、特殊符号中至少三种');
  }
  return Promise.resolve();
}
