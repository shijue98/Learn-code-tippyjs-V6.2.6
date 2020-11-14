import {TOUCH_OPTIONS} from './constants';
import {isReferenceElement} from './dom-utils';

export const currentInput = {isTouch: false};
let lastMouseMoveTime = 0;

/**
 * When a `touchstart` event is fired, it's assumed the user is using touch
 * input. We'll bind a `mousemove` event listener to listen for mouse input in
 * the future. This way, the `isTouch` property is fully dynamic and will handle
 * hybrid devices that use a mix of touch + mouse input.
 */
// 当触发“touchstart”事件时，假定用户使用的是触摸输入。
// 我们将绑定一个“mousemove”事件侦听器，以便将来监听鼠标输入。
// 这样，“isTouch”属性是完全动态的，可以处理混合使用触摸+鼠标输入的混合设备。
export function onDocumentTouchStart(): void {
  if (currentInput.isTouch) {
    return;
  }

  currentInput.isTouch = true;

  if (window.performance) {
    document.addEventListener('mousemove', onDocumentMouseMove);
  }
}

/**
 * When two `mousemove` event are fired consecutively within 20ms, it's assumed
 * the user is using mouse input again. `mousemove` can fire on touch devices as
 * well, but very rarely that quickly.
 */
// 当两个“mousemove”事件在20ms内连续激发时，假设用户再次使用鼠标输入。
// `mousemove也可以在触摸设备上启动，但很少有这么快
export function onDocumentMouseMove(): void {
  const now = performance.now();

  if (now - lastMouseMoveTime < 20) {
    currentInput.isTouch = false;

    document.removeEventListener('mousemove', onDocumentMouseMove);
  }

  lastMouseMoveTime = now;
}

/**
 * When an element is in focus and has a tippy, leaving the tab/window and
 * returning causes it to show again. For mouse users this is unexpected, but
 * for keyboard use it makes sense.
 * TODO: find a better technique to solve this problem
 * 当一个元素处于焦点并且有一个tippy时，
 * 离开tab/窗口并返回将导致它再次显示。
 * 对于鼠标用户来说，这是出乎意料的，但对于键盘用户来说，这是有意义的。
    TODO:找到更好的技术来解决这个问题
 */
export function onWindowBlur(): void {
  // activeElement 属性返回文档中当前获得焦点的元素。
  const activeElement = document.activeElement as HTMLElement | null;

  // 是否为引用元素
  if (isReferenceElement(activeElement)) {
    const instance = activeElement._tippy!;

    if (activeElement.blur && !instance.state.isVisible) {
      activeElement.blur();
    }
  }
}

export default function bindGlobalEventListeners(): void {
  // 触摸开始
  document.addEventListener('touchstart', onDocumentTouchStart, TOUCH_OPTIONS);
  // 失去焦点
  window.addEventListener('blur', onWindowBlur);
}




// document.addEventListener('touchstart', function(e){
//   console.log(e)
// }, {passive: true, capture: true});