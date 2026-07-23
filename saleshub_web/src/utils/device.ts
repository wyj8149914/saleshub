/**
 * 设备检测工具函数
 */

/** 移动端断点阈值（px） */
const MOBILE_BREAKPOINT = 768

/**
 * 判断当前是否为移动端设备
 * 基于视口宽度判断，宽度小于 MOBILE_BREAKPOINT 视为移动端
 */
export function isMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/**
 * 监听设备类型变化
 * @param callback 设备类型变化时的回调函数
 * @returns 清除监听的函数
 */
export function onDeviceChange(callback: (isMobile: boolean) => void): () => void {
  let lastIsMobile = isMobile()

  const handler = () => {
    const currentIsMobile = isMobile()
    if (currentIsMobile !== lastIsMobile) {
      lastIsMobile = currentIsMobile
      callback(currentIsMobile)
    }
  }

  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}
