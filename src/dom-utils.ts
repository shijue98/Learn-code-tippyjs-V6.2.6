import {ReferenceElement, Targets} from './types';
import {PopperTreeData} from './types-internal';
import {arrayFrom, isType, normalizeToArray, getBasePlacement} from './utils';

export function div(): HTMLDivElement {
  return document.createElement('div');
}

// 是否 为 元素
export function isElement(value: unknown): value is Element | DocumentFragment {
  return ['Element', 'Fragment'].some((type) => isType(value, type));
}

export function isNodeList(value: unknown): value is NodeList {
  return isType(value, 'NodeList');
}

// 是否 为 鼠标事件
export function isMouseEvent(value: unknown): value is MouseEvent {
  return isType(value, 'MouseEvent');
}

// 是否为 引用元素
export function isReferenceElement(value: any): value is ReferenceElement {
  return !!(value && value._tippy && value._tippy.reference === value);
}

// 返回一个 元素的数组
export function getArrayOfElements(value: Targets): Element[] {
  // 是 元素则返回, 元素数组
  if (isElement(value)) {
    return [value];
  }

  // 如果是 node节点 转为数组
  if (isNodeList(value)) {
    return arrayFrom(value);
  }

  // 如果是 数组直接返回
  if (Array.isArray(value)) {
    return value;
  }
  // 选择器等, 查找node节点, 转为数组
  return arrayFrom(document.querySelectorAll(value));
}

// 设置过渡动画持续时间
export function setTransitionDuration(
  els: (HTMLDivElement | null)[],
  value: number
): void {
  els.forEach((el) => {
    if (el) {
      el.style.transitionDuration = `${value}ms`;
    }
  });
}

export function setVisibilityState(
  els: (HTMLDivElement | null)[],
  state: 'visible' | 'hidden'
): void {
  els.forEach((el) => {
    if (el) {
      el.setAttribute('data-state', state);
    }
  });
}

// 获取自身 document 兼容 iframe
export function getOwnerDocument(
  elementOrElements: Element | Element[]
): Document {
  const [element] = normalizeToArray(elementOrElements);
  return element ? element.ownerDocument || document : document;
}
// 鼠标是否在边界之外
export function isCursorOutsideInteractiveBorder(
  popperTreeData: PopperTreeData[],
  event: MouseEvent
): boolean {
  const {clientX, clientY} = event;
  /**
  every() 方法用于检测数组所有元素是否都符合指定条件（通过函数提供）。
  every() 方法使用指定函数检测数组中的所有元素：
  如果数组中检测到有一个元素不满足，则整个表达式返回 false ，且剩余的元素不会再进行检测。
  如果所有元素都满足条件，则返回 true。
  注意： every() 不会对空数组进行检测。
  注意： every() 不会改变原始数组。
  */
  return popperTreeData.every(({popperRect, popperState, props}) => {
    const {interactiveBorder} = props;
    const basePlacement = getBasePlacement(popperState.placement);
    const offsetData = popperState.modifiersData.offset;

    if (!offsetData) {
      return true;
    }

    const topDistance = basePlacement === 'bottom' ? offsetData.top!.y : 0;
    const bottomDistance = basePlacement === 'top' ? offsetData.bottom!.y : 0;
    const leftDistance = basePlacement === 'right' ? offsetData.left!.x : 0;
    const rightDistance = basePlacement === 'left' ? offsetData.right!.x : 0;

    const exceedsTop =
      popperRect.top - clientY + topDistance > interactiveBorder;
    const exceedsBottom =
      clientY - popperRect.bottom - bottomDistance > interactiveBorder;
    const exceedsLeft =
      popperRect.left - clientX + leftDistance > interactiveBorder;
    const exceedsRight =
      clientX - popperRect.right - rightDistance > interactiveBorder;

    return exceedsTop || exceedsBottom || exceedsLeft || exceedsRight;
  });
}

export function updateTransitionEndListener(
  box: HTMLDivElement,
  action: 'add' | 'remove',
  listener: (event: TransitionEvent) => void
): void {
  // 监听类型
  const method = `${action}EventListener` as
    | 'addEventListener'
    | 'removeEventListener';

  // some browsers apparently support `transition` (unprefixed) but only fire
  // `webkitTransitionEnd`...
  ['transitionend', 'webkitTransitionEnd'].forEach((event) => {
    box[method](event, listener as EventListener);
  });
}
