import {BasePlacement, Placement} from './types';

// Object的hasOwnProperty()方法返回一个布尔值，判断对象是否包含特定的自身（非继承）属性。
// 判断 obj 中 是否包含key这个属性
export function hasOwnProperty(obj: object, key: string): boolean {
  return {}.hasOwnProperty.call(obj, key);
}
// 获取值在索引或者返回时
// value 是数组 则返回 index的值, 不存在返回默认值index的值 或者 默认值,
// value 不是数组, 返回value值
export function getValueAtIndexOrReturn<T>(
  value: T | [T | null, T | null],
  index: number,
  defaultValue: T | [T, T]
): T {
  
  if (Array.isArray(value)) {
    const v = value[index];
    return v == null
      ? Array.isArray(defaultValue)
        ? defaultValue[index]
        : defaultValue
      : v;
  }

  return value;
}

// 判断传入的对象值, 是否是对应的类型 
export function isType(value: any, type: string): boolean {
  // "[object String]" "[object Array]" 等
  const str = {}.toString.call(value);
  return str.indexOf('[object') === 0 && str.indexOf(`${type}]`) > -1;
}

// 如果 值的类型是 function , 则把第二个参数, 传入函数, 否则直接返回
export function invokeWithArgsOrReturn(value: any, args: any[]): any {
  return typeof value === 'function' ? value(...args) : value;
}

// 防抖机制 : 延时调用回调函数, 清除延时执行函数 
// 闭包, 保存 timeout
export function debounce<T>(
  fn: (arg: T) => void,
  ms: number
): (arg: T) => void {
  // 延时为 0 , 则 直接执行
  if (ms === 0) {
    return fn;
  }

  let timeout: any;

  return (arg): void => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      fn(arg);
    }, ms);

  };
}



// 删除 obj中 keys 数组中的 属性
export function removeProperties<T>(obj: T, keys: string[]): Partial<T> {
  const clone = {...obj};
  keys.forEach((key) => {
    delete (clone as any)[key];
  });
  return clone;
}

// 根据空格分成数组
export function splitBySpaces(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}
// 把值转为数组
export function normalizeToArray<T>(value: T | T[]): T[] {
  return ([] as T[]).concat(value);
}

// 数组中没有这个值,就插入
export function pushIfUnique<T>(arr: T[], value: T): void {
  if (arr.indexOf(value) === -1) {
    arr.push(value);
  }
}

export function appendPxIfNumber(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value;
}

// 浅拷贝
export function unique<T>(arr: T[]): T[] {
  return arr.filter((item, index) => arr.indexOf(item) === index);
}

export function getNumber(value: string | number): number {
  return typeof value === 'number' ? value : parseFloat(value);
}

export function getBasePlacement(placement: Placement): BasePlacement {
  return placement.split('-')[0] as BasePlacement;
}

// 把 value 转为数组
export function arrayFrom(value: ArrayLike<any>): any[] {
  return [].slice.call(value);
}

// 移除 值为 未定义 的属性
export function removeUndefinedProps(
  obj: Record<string, unknown>
): Partial<Record<string, unknown>> {
  return Object.keys(obj).reduce((acc, key) => {
    if (obj[key] !== undefined) {
      (acc as any)[key] = obj[key];
    }

    return acc;
  }, {});
}
