// 判断是否在浏览器环境下运行
export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined';

// 获取浏览器的userAgent
const ua = isBrowser ? navigator.userAgent : '';

// 判断是否为IE浏览器
export const isIE = /MSIE |Trident\//.test(ua);
