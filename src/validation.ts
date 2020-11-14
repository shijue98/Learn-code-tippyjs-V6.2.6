import {Targets} from './types';

// 创建内存泄漏警告
export function createMemoryLeakWarning(method: string): string {
  const txt = method === 'destroy' ? 'n already-' : ' ';

  return [
    `${method}() was called on a${txt}destroyed instance. This is a no-op but`,
    'indicates a potential memory leak.',
  ].join(' ');
}

// 清空多余的空格和换行
export function clean(value: string): string {
  const spacesAndTabs = /[ \t]{2,}/g;
  const lineStartWithSpaces = /^[ \t]*/gm;

  return value
    .replace(spacesAndTabs, ' ')
    .replace(lineStartWithSpaces, '')
    .trim();
}

// %c 用于引用输出style
function getDevMessage(message: string): string {
  return clean(`
  %ctippy.js

  %c${clean(message)}

  %c👷‍ This is a development-only message. It will be removed in production.
  `);
}

// https://developer.mozilla.org/en-US/docs/Web/API/console#Using_string_substitutions
// 带样式格式输出 信息
export function getFormattedMessage(message: string): string[] {
  return [
    getDevMessage(message),
    // title
    'color: #00C584; font-size: 1.3em; font-weight: bold;',
    // message
    'line-height: 1.5',
    // footer
    'color: #a6a095;',
  ];
}

// Assume warnings and errors never have the same message
// 假设警告和错误从来没有相同的消息
// 
// Set 数组, 存放错误和警告的消息
let visitedMessages: Set<string>;
if (__DEV__) {
  resetVisitedMessages();
}
// 初始化 消息存放数组
export function resetVisitedMessages(): void {
  visitedMessages = new Set();
}

// 输出警告信息
export function warnWhen(condition: boolean, message: string): void {
  if (condition && !visitedMessages.has(message)) {
    visitedMessages.add(message);
    console.warn(...getFormattedMessage(message));
  }
}

// 输出错误信息
export function errorWhen(condition: boolean, message: string): void {
  // 条件为真， visitedMessages中未存放这个错误消息， 
  // 如果输出过这个错误， 则不再重复输出
  if (condition && !visitedMessages.has(message)) {
    // 添加错误消息到Set数组
    visitedMessages.add(message);
    console.error(...getFormattedMessage(message));
  }
}

export function validateTargets(targets: Targets): void {

  // 触发目标元素， 不存在
  const didPassFalsyValue = !targets;
  
  // 是对象类型, 不是元素节点
  const didPassPlainObject =
    Object.prototype.toString.call(targets) === '[object Object]' &&
    !(targets as any).addEventListener;

    // 触发目标元素， 不存在， 输出错误信息
  errorWhen(
    didPassFalsyValue,
    [
      'tippy() was passed',
      '`' + String(targets) + '`',
      'as its targets (first) argument. Valid types are: String, Element,',
      'Element[], or NodeList.',
    ].join(' ')
  );
  // 触发目标元素， 不是元素节点， 输出错误信息
  errorWhen(
    didPassPlainObject,
    [
      'tippy() was passed a plain object which is not supported as an argument',
      'for virtual positioning. Use props.getReferenceClientRect instead.',
    ].join(' ')
  );
}
