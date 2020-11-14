import {createPopper, StrictModifiers, Modifier} from '@popperjs/core';
import {currentInput} from './bindGlobalEventListeners';
import {isIE} from './browser';
import {TOUCH_OPTIONS} from './constants';
import {
  div,
  getOwnerDocument,
  isCursorOutsideInteractiveBorder,
  isMouseEvent,
  setTransitionDuration,  // 设置过渡动画持续时间
  setVisibilityState,
  updateTransitionEndListener,
} from './dom-utils';
import {defaultProps, evaluateProps, getExtendedPassedProps} from './props';
import {getChildren} from './template';
import {
  Content,
  Instance,
  LifecycleHooks,
  PopperElement,
  Props,
  ReferenceElement,
} from './types';
import {ListenerObject, PopperTreeData, PopperChildren} from './types-internal';
import {
  arrayFrom,
  debounce,
  getValueAtIndexOrReturn,
  invokeWithArgsOrReturn,
  normalizeToArray,
  pushIfUnique,
  splitBySpaces,
  unique,
  removeUndefinedProps,
} from './utils';
import {createMemoryLeakWarning, errorWhen, warnWhen} from './validation';

let idCounter = 1;
let mouseMoveListeners: ((event: MouseEvent) => void)[] = []; // 鼠标move 时的, 回调函数

// Used by `hideAll()`
// 挂载的实例
export let mountedInstances: Instance[] = [];

export default function createTippy(
  reference: ReferenceElement, // 触发的目标参考元素
  passedProps: Partial<Props>  // 配置选项
): Instance {

  // 返回处理后的选项 , 元素上的属性 (ignoreAttributes==true) 覆盖 传入的属性
  // 
  const props = evaluateProps(reference, {
    ...defaultProps,
    ...getExtendedPassedProps(removeUndefinedProps(passedProps)),   // // 移除 值为 未定义的选项, 拓展插件中的选项
  });

  // ===========================================================================
  // 🔒 Private members  私有属性
  // ===========================================================================
  let showTimeout: any; // 显示 延时定时器
  let hideTimeout: any; // 隐藏 延时定时器
  let scheduleHideAnimationFrame: number; // 隐藏帧动画定时器

  let isVisibleFromClick = false; // 是否点击显示
  let didHideDueToDocumentMouseDown = false; // 是否在文档中点击鼠标隐藏popper
  let didTouchMove = false;   // 
  let ignoreOnFirstUpdate = false; // 是否忽略OnFirstUpdate事件回调
  let lastTriggerEvent: Event | undefined;
  let currentTransitionEndListener: (event: TransitionEvent) => void;  // 过渡动画结束时监听回调
  let onFirstUpdate: () => void;  // 首次更新
  let listeners: ListenerObject[] = [];  // 保存监听数据 listeners.push({node, eventType, handler, options});
   // 鼠标在document上移动,防抖 (执行fn , 延迟时间 ms) 
   // props.interactiveDebounce 有交互的时间间隔
  let debouncedOnMouseMove = debounce(onMouseMove, props.interactiveDebounce); 
 
  let currentTarget: Element;
  const doc = getOwnerDocument(props.triggerTarget || reference); // 返回自身的document

  // ===========================================================================
  // 🔑 Public members 公开属性
  // ===========================================================================
  
  // 上面定义的全局变量
  const id = idCounter++;
  // pop 实例
  const popperInstance = null;
  // 浅拷贝
  const plugins = unique(props.plugins);

  const state = {
    // Is the instance currently enabled?
    // 是否已启用实例当前
    isEnabled: true,

    // Is the tippy currently showing and not transitioning out?
    // 是否 pop是在显示状态 且 过渡动画完成
    isVisible: false,

    // Has the instance been destroyed?
    // 是否已销毁实例？
    isDestroyed: false,

    // Is the tippy currently mounted to the DOM?
    // 实例是否挂载到DOM
    isMounted: false,

    // Has the tippy finished transitioning in?
    //  是否完成过渡动画
    isShown: false,
  };

  // 实例接口
  const instance: Instance = {
    // properties
    id,
    reference,
    popper: div(), // 创建div元素, document.createElement('div');
    popperInstance,
    props,
    state,
    plugins,
    // methods
    clearDelayTimeouts,  // 清除延时定时器
    setProps,
    setContent,
    show,
    hide,
    hideWithInteractivity,
    enable,
    disable,
    unmount,
    destroy,
  };

  // render 不存在, 直接返回实例, 需要自定义render的情况
  // render 自定义渲染函数, 所有带R标识的属性,将失效
  // https://atomiks.github.io/tippyjs/v6/headless-tippy/

  // TODO: Investigate why this early return causes a TDZ error in the tests —
  // it doesn't seem to happen in the browser
  /* istanbul ignore if */
  if (!props.render) {
    if (__DEV__) {
      // 在测试环境时, 不被支持
      errorWhen(true, 'render() function has not been supplied.');
    }

    return instance;
  }

  // ===========================================================================
  // Initial mutations 初始化
  // ===========================================================================
  
  // 生成popper  
  const {popper, onUpdate} = props.render(instance);

  // 设置属性和id
  popper.setAttribute('data-__NAMESPACE_PREFIX__-root', '');
  popper.id = `__NAMESPACE_PREFIX__-${instance.id}`;

  // 保存到实例中
  instance.popper = popper;

  // 把实例, 保存到参考元素和弹出元素
  reference._tippy = instance;
  popper._tippy = instance;

  // 调用插件的 fn 函数
  const pluginsHooks = plugins.map((plugin) => plugin.fn(instance));
  const hasAriaExpanded = reference.hasAttribute('aria-expanded');

  // 根据 props.trigger , 给 props.triggerTarget || reference 添加监听 
    // mouseenter mouseleave | focusin focusout | click
  addListeners();

  // 手动添加属性,  aria-expanded
  handleAriaExpandedAttribute();
    // 手动处理样式
  handleStyles();

  // 调用生命周期钩子函数
  invokeHook('onCreate', [instance]);

  if (props.showOnCreate) {

    scheduleShow();
  }

  // Prevent a tippy with a delay from hiding if the cursor left then returned
  // before it started hiding
  // 与popper 可交互的情况下, 鼠标移到popper 则阻止隐藏
  popper.addEventListener('mouseenter', () => {
    if (instance.props.interactive && instance.state.isVisible) {
      instance.clearDelayTimeouts();
    }
  });
  // 有mouseenter触发方式, 且 与popper 可交互的情况下,鼠标离开popper, 
  // 如果鼠标在popper 或者 触发目标上, 则 不作为
  // 否则, 移除doc上的监听 且 应该隐藏
  popper.addEventListener('mouseleave', (event) => {
    if (
      instance.props.interactive &&
      instance.props.trigger.indexOf('mouseenter') >= 0
    ) {
      doc.addEventListener('mousemove', debouncedOnMouseMove);
      debouncedOnMouseMove(event);
    }
  });

  return instance;

  // ===========================================================================
  // 🔒 Private methods 私有方法
  // ===========================================================================
  
  // 获取触摸行为
  function getNormalizedTouchSettings(): [string | boolean, number] {
     /**
   * 确定触摸设备上的行为。
   *  // default
      touch: true,
      禁止tippy在触摸设备上显示
      touch: false,
      需要按住屏幕来显示
      touch: 'hold',
      同上, 长按行为
      touch: ['hold', 500],
   */
    const {touch} = instance.props;
    return Array.isArray(touch) ? touch : [touch, 0];
  }

  // 是否需要按住屏幕(触摸设备)显示
  function getIsCustomTouchBehavior(): boolean {
    return getNormalizedTouchSettings()[0] === 'hold';
  }

  // ?. 可选链 
  // 判断是否为默认的渲染函数
  function getIsDefaultRenderFn(): boolean {
    // @ts-ignore
    return !!instance.props.render?.$$tippy;
  }

  // 当前监听目标 或者 参考元素
  function getCurrentTarget(): Element {
    return currentTarget || reference;
  }

  // 返回默认popper的子元素
  function getDefaultTemplateChildren(): PopperChildren {
    return getChildren(popper);
  }

  function getDelay(isShow: boolean): number {
    // For touch or keyboard input, force `0` delay for UX reasons
    // Also if the instance is mounted but not visible (transitioning out),
    // ignore delay

    // 对于触摸或键盘输入，出于用户体验原因强制延迟为“0”。
    // 另外，如果实例已挂载上, 但不可见（transitioning out），忽略延迟
    // 上次是焦点触发, 延时为0
    if (
      (instance.state.isMounted && !instance.state.isVisible) ||
      currentInput.isTouch ||
      (lastTriggerEvent && lastTriggerEvent.type === 'focus')
    ) {
      return 0;
    }

    // 返回显示|隐藏, 时的延时
    return getValueAtIndexOrReturn(
      instance.props.delay,
      isShow ? 0 : 1,
      defaultProps.delay
    );
  }

  // 处理样式
  function handleStyles(): void {
    // 事件禁用
    popper.style.pointerEvents =
      instance.props.interactive && instance.state.isVisible ? '' : 'none';
      // 层级
    popper.style.zIndex = `${instance.props.zIndex}`;
  }

  // 调用生命周期钩子函数
  function invokeHook(
    hook: keyof LifecycleHooks,
    args: [Instance, any?],
    shouldInvokePropsHook = true
  ): void {

    // 触发插件中的回调
    pluginsHooks.forEach((pluginHooks) => {
      if (pluginHooks[hook]) {
        pluginHooks[hook]!(...args);
      }
    });

    // 触发属性中的回调, 默认触发
    if (shouldInvokePropsHook) {
      instance.props[hook](...args);
    }
  }

  function handleAriaContentAttribute(): void {
    const {aria} = instance.props;

    if (!aria.content) {
      return;
    }

    const attr = `aria-${aria.content}`;
    const id = popper.id;
    const nodes = normalizeToArray(instance.props.triggerTarget || reference);

    nodes.forEach((node) => {
      const currentValue = node.getAttribute(attr);

      if (instance.state.isVisible) {
        node.setAttribute(attr, currentValue ? `${currentValue} ${id}` : id);
      } else {
        const nextValue = currentValue && currentValue.replace(id, '').trim();

        if (nextValue) {
          node.setAttribute(attr, nextValue);
        } else {
          node.removeAttribute(attr);
        }
      }
    });
  }

  //  手动添加属性,  aria-expanded
  function handleAriaExpandedAttribute(): void {
    if (hasAriaExpanded || !instance.props.aria.expanded) {
      return;
    }

    const nodes = normalizeToArray(instance.props.triggerTarget || reference);

    nodes.forEach((node) => {
      if (instance.props.interactive) {
        node.setAttribute(
          'aria-expanded',
          instance.state.isVisible && node === getCurrentTarget()
            ? 'true'
            : 'false'
        );
      } else {
        node.removeAttribute('aria-expanded');
      }
    });
  }

  function cleanupInteractiveMouseListeners(): void {
    // 移除 document 上 鼠标监听 , 防抖机制
    doc.removeEventListener('mousemove', debouncedOnMouseMove);
    // 监听列表中移除
    mouseMoveListeners = mouseMoveListeners.filter(
      (listener) => listener !== debouncedOnMouseMove
    );
  }

  // 鼠标在document上 按下
  function onDocumentPress(event: MouseEvent | TouchEvent): void {
    // Moved finger to scroll instead of an intentional tap outside
    // 移动手指滚动，而不是有意在外面轻敲
    if (currentInput.isTouch) {
      if (didTouchMove || event.type === 'mousedown') {
        return;
      }
    }

    // Clicked on interactive popper
    // 在popper上点击
    if (
      instance.props.interactive &&   // 可交互的, 鼠标在Popper上不隐藏
      popper.contains(event.target as Element)
    ) {
      return;
    }

    // Clicked on the event listeners target
    // 在监听目标(触发元素)上点击
    if (getCurrentTarget().contains(event.target as Element)) {
      if (currentInput.isTouch) {
        return;
      }

      //  在 触发目标上 上mousedown, 且正在显示未挂载时, 且 触发方式包含click, 则 return
      if (
        instance.state.isVisible && // 正在显示未挂载时
        instance.props.trigger.indexOf('click') >= 0  // click触发方式
      ) {
        return;
      }
    } else {
      // 调用 popper 外点击生命周期钩子
      invokeHook('onClickOutside', [instance, event]);
    }

    // 点击时 隐藏popper
    if (instance.props.hideOnClick === true) {
      // 清空显示/隐藏/动画定时器
      instance.clearDelayTimeouts();
      instance.hide();

      // `mousedown` event is fired right before `focus` if pressing the
      // currentTarget. This lets a tippy with `focus` trigger know that it
      // should not show
      didHideDueToDocumentMouseDown = true;
      setTimeout(() => {
        didHideDueToDocumentMouseDown = false;
      });

      // The listener gets added in `scheduleShow()`, but this may be hiding it
      // before it shows, and hide()'s early bail-out behavior can prevent it
      // from being cleaned up
      if (!instance.state.isMounted) {
        removeDocumentPress();
      }
    }
  }

  function onTouchMove(): void {
    didTouchMove = true;
  }

  function onTouchStart(): void {
    didTouchMove = false;
  }

  // document 上绑定事件
  function addDocumentPress(): void {
    doc.addEventListener('mousedown', onDocumentPress, true);
    doc.addEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
    doc.addEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
    doc.addEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
  }
  // document 上移除绑定事件
  function removeDocumentPress(): void {
    doc.removeEventListener('mousedown', onDocumentPress, true);
    doc.removeEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
    doc.removeEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
    doc.removeEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
  }

  // 过渡动画结束后,回调
  // pop是隐藏 && pop 存在
  function onTransitionedOut(duration: number, callback: () => void): void {
    onTransitionEnd(duration, () => {
      if (
        !instance.state.isVisible &&
        popper.parentNode &&
        popper.parentNode.contains(popper)
      ) {
        callback();
      }
    });
  }

  // 过渡动画开始后, 到完成时间后, 回调
  function onTransitionedIn(duration: number, callback: () => void): void {
    onTransitionEnd(duration, callback);
  }

  // 过渡动画结束, 执行回调
  // 如果时间为0 则 直接调用
  // 否则, 等待过渡动画完成后调用
  function onTransitionEnd(duration: number, callback: () => void): void {
      // 返回默认popper的子元素
    const box = getDefaultTemplateChildren().box;
    let timer:any = null;
    function listener(event: TransitionEvent): void {
      if (event.target === box) {
        // 调用监听后, 移除监听事件
        updateTransitionEndListener(box, 'remove', listener);
        clearTimeout(timer)
        callback();
      }
    }

    // Make callback synchronous if duration is 0
    // `transitionend` won't fire otherwise
    // 如果持续时间为0，则将回调设为同步，否则“transitionend”将不会触发
    if (duration === 0) {
      return callback();
    }

    timer = setTimeout(()=>{
      callback();
    },duration)

    // 第一次当前监听回调为空, 移除当前监听
    updateTransitionEndListener(box, 'remove', currentTransitionEndListener);
    // 添加新的监听
    updateTransitionEndListener(box, 'add', listener);

    // 设置当前监听
    currentTransitionEndListener = listener;
  }

  // 添加监听
  function on(
    eventType: string,
    handler: EventListener,
    options: boolean | object = false
  ): void {

    const nodes = normalizeToArray(instance.props.triggerTarget || reference);

    nodes.forEach((node) => {
      node.addEventListener(eventType, handler, options);
      // 保存监听数据
      listeners.push({node, eventType, handler, options});
    });

  }

  function addListeners(): void {

    // 是否需要按住屏幕(触摸设备)显示
    if (getIsCustomTouchBehavior()) {
      // 再加一个 是移动端的事件
      on('touchstart', onTrigger, {passive: true});
      on('touchend', onMouseLeave as EventListener, {passive: true});

      // 移动端没有鼠标事件
    }

    splitBySpaces(instance.props.trigger).forEach((eventType) => {
      // 手动调用
      if (eventType === 'manual') {
        return;
      }

      // 监听触发
      on(eventType, onTrigger);

      // 监听关闭
      // 成对监听, ===> 有进入就有离开,  有获取焦点就有失去焦点
      switch (eventType) {
        case 'mouseenter':
          on('mouseleave', onMouseLeave as EventListener);
          break;

        case 'focus':
          on(isIE ? 'focusout' : 'blur', onBlurOrFocusOut as EventListener);
          break;

        case 'focusin':
          on('focusout', onBlurOrFocusOut as EventListener);
          break;
      }
    });
  }

  function removeListeners(): void {
    listeners.forEach(({node, eventType, handler, options}: ListenerObject) => {
      node.removeEventListener(eventType, handler, options);
    });
    listeners = [];
  }

  // 触发popper显示
  // Toggle show/hide 
  function onTrigger(event: Event): void {
    // 是否应该点击隐藏
    let shouldScheduleClickHide = false;


    if (
      !instance.state.isEnabled ||
      isEventListenerStopped(event) ||
      didHideDueToDocumentMouseDown
    ) {
      // 禁用实例 || 阻止监听事件 || 鼠标在文档中点击去隐藏
      return;
    }

    // 上一次触发事件是focus
    const wasFocused = lastTriggerEvent?.type === 'focus';

    // 触发事件
    lastTriggerEvent = event;
    // 当前触发目标元素
    currentTarget = event.currentTarget as Element;

    // Aria 扩转属性, 屏幕阅读器, 表示展开or关闭
    handleAriaExpandedAttribute();

    // 隐藏状态 且 是鼠标事件
    if (!instance.state.isVisible && isMouseEvent(event)) {
      // If scrolling, `mouseenter` events can be fired if the cursor lands
      // over a new target, but `mousemove` events don't get fired. This
      // causes interactive tooltips to get stuck open until the cursor is
      // moved

      //当滚动时，如果光标碰到新目标，将会触发mouseenter事件
      //但是mousemove事件不会被触发。
      //这会导致tooltips一直处于打开状态，直到光标移动为止

      mouseMoveListeners.forEach((listener) => listener(event));
    }

    // 在点击popper是显示还是隐藏
    // Toggle show/hide when clicking click-triggered tooltips
    // 点击事件 && (没有mouseenter触发的情况 || isVisibleFromClick) && 点击popper 外侧隐藏 && 当前是显示状态
    if (
      event.type === 'click' &&
      (instance.props.trigger.indexOf('mouseenter') < 0 || isVisibleFromClick) &&
      instance.props.hideOnClick !== false &&
      instance.state.isVisible
    ) {
      
      shouldScheduleClickHide = true;

    } else {

      scheduleShow(event);

    }

    // 上次是隐藏, 这次就应该是显示了
    if (event.type === 'click') {
      isVisibleFromClick = !shouldScheduleClickHide;
    }

    // 去隐藏
    if (shouldScheduleClickHide && !wasFocused) {
      scheduleHide(event);
    }
  }

  // 鼠标移动
  // 有交互的情况
  // 不能解决 有空隙的快速切换滑入问题
  // 如果鼠标在popper 或者 触发目标上, 则 不作为
  // 否则, 移除doc上的监听 且 应该隐藏
  function onMouseMove(event: MouseEvent): void {
    const target = event.target as Node;

    // 鼠标在 参考元素 或 弹出框 上
    const isCursorOverReferenceOrPopper =
      //  参考元素 || popper 
      getCurrentTarget().contains(target) || popper.contains(target);

      // 在 参考元素 或 弹出框 上 移动鼠标, 则 return
    if (event.type === 'mousemove' && isCursorOverReferenceOrPopper) {
      return;
    }

    // popper state 为 true 的 信息
    const popperTreeData = getNestedPopperTree()  // 返回所有 popper 元素 , 是数组
      .concat(popper)
      .map((popper) => {
        const instance = popper._tippy!;
        const state = instance.popperInstance?.state;

        if (state) {
          return {
            popperRect: popper.getBoundingClientRect(),
            popperState: state,
            props,
          };
        }

        return null;
      })
      .filter(Boolean) as PopperTreeData[];

      // 鼠标 在 边界之外
    if (isCursorOutsideInteractiveBorder(popperTreeData, event)) {
      // 移除 document 上 鼠标监听
      cleanupInteractiveMouseListeners();
      scheduleHide(event);
    }
  }

  //  triggerTarget || reference  上监听 touchend   mouseLeave
  function onMouseLeave(event: MouseEvent): void {
    // 应该保留
    // 停止监听 || (click 触发 && 应该去显示) 则 return
    const shouldBail =
      isEventListenerStopped(event) ||
      (instance.props.trigger.indexOf('click') >= 0 && isVisibleFromClick);

    if (shouldBail) {
      return;
    }

    // pop上有交互
    if (instance.props.interactive) {
      // 有交互的去隐藏
      instance.hideWithInteractivity(event);
      return;
    }

    scheduleHide(event);
  }

  // foucs foucsin
  function onBlurOrFocusOut(event: FocusEvent): void {
    // foucs 触发, && 不是触发元素触发 则return
    // foucs 触发 && 参考元素失去焦点 , 则继续
    if (
      instance.props.trigger.indexOf('focusin') < 0 &&
      event.target !== getCurrentTarget()
    ) {
      return;
    }

    /**
     * relatedTarget 事件属性返回与事件的目标节点相关的节点。
      对于 mouseover 事件来说，该属性是鼠标指针移到目标节点上时所离开的那个节点。
      对于 mouseout 事件来说，该属性是离开目标时，鼠标指针进入的节点。
      focusout  , 目标失去焦点时, 鼠标指针进入的节点。
      对于其他类型的事件来说，这个属性没有用。

     */
    // If focus was moved to within the popper
    // 如果在弹出框内点击,使参考元素失去焦点

    // 有交互 &&  在pop上触发的失去焦点
    if (
      instance.props.interactive &&
      event.relatedTarget &&
      popper.contains(event.relatedTarget as Element)
    ) {
      // 重新获取焦点
      // event.target.fouse()
      // 不触发焦点显示事件, 设置一个状态
      return;
    }

    scheduleHide(event);
  }

  function isEventListenerStopped(event: Event): boolean {
    return currentInput.isTouch
      ? getIsCustomTouchBehavior() !== event.type.indexOf('touch') >= 0
      : false;
  }

  // createPopper 实例
  function createPopperInstance(): void {
    destroyPopperInstance();

    const {
      popperOptions,
      placement,
      offset,
      getReferenceClientRect,
      moveTransition,
    } = instance.props;

    // 三角
    const arrow = getIsDefaultRenderFn() ? getChildren(popper).arrow : null;

    //  参考定位的范围
    const computedReference = getReferenceClientRect
      ? {
          getBoundingClientRect: getReferenceClientRect,
          contextElement: getReferenceClientRect.contextElement || getCurrentTarget(),
        }
      : reference;

        // 自定义修饰器
    //  隐藏显示popper
    const tippyModifier: Modifier<'$$tippy', {}> = {
      name: '$$tippy',
      // 将在Popper生命周期内执行
      enabled: true,
      /**
       * 生命周期分为三个核心阶段:  
       * read, 需要从DOM中读取
       * main : 只使用算法执行逻辑
       * write : 写入dom
       * 这样做是为了优化库，以便将其对DOM的访问组合在一起，而不是分散在整个生命周期中。
       * 注意，
       * Popper在其状态下提供了DOM度量的缓存，
       * 这样修饰符就可以读取它们，而不是查询DOM，
       * 从而优化整个执行时间。这意味着您应该很少需要连接到读取阶段。
       * 对于进一步细化, 又分为before 和 after 两个阶段
      */
      phase: 'beforeWrite',
       /**
       * 指定它所依赖的修饰符列表。
       * Popper将按顺序执行修饰符，以允许依赖修饰符访问依赖修饰符提供的数据。
       * 简而言之，修饰符依赖于修饰符的数据列表才能工作。
      */
      requires: ['computeStyles'],
       /**
       * fn
       * 这是主要功能，用于向修饰符提供逻辑。
       * 在某些情况下，您可能希望通过修饰符控制Popper生命周期。
       * 例如，flip修饰符可以更改placement 选项，
       * 如果发生这种情况，Popper将再次运行所有修饰符，以便它们能够对更新的放置值做出反应。
       * 修饰符可以通过将State.Reset设置为true来重置生命周期。
      */
      fn({state}) {
        if (getIsDefaultRenderFn()) {
            // 返回默认popper的子元素
          const {box} = getDefaultTemplateChildren();

          // 它向state.properties添加属性：
          //   data-popper-reference-hidden: 
          //   当引用元素被完全裁剪并从视图中隐藏时，此属性将应用于Popper，这将导致Popper看起来没有附加到任何东西上。
          //   data-popper-escaped: 
          //   当popper转义引用元素的边界(因此它看起来是分离的)时，将应用此属性。


          ['placement', 'reference-hidden', 'escaped'].forEach((attr) => {
            if (attr === 'placement') {
              box.setAttribute('data-placement', state.placement);
            } else {
              if (state.attributes.popper[`data-popper-${attr}`]) {
                box.setAttribute(`data-${attr}`, '');
              } else {
                box.removeAttribute(`data-${attr}`);
              }
            }
          });

          state.attributes.popper = {};
        }
      },
    };

    type TippyModifier = Modifier<'$$tippy', {}>;
    type ExtendedModifiers = StrictModifiers | Partial<TippyModifier>;

    const modifiers: Array<ExtendedModifiers> = [
      // https://popper.js.org/docs/v2/modifiers/offset/
      {
        name: 'offset',
        options: {
          offset,
        },
      },
      // 通过移动来防止pop被切断，使其在其边界区域内保持可见。
      {
        name: 'preventOverflow',
        options: {
          padding: {
            top: 2,
            bottom: 2,
            left: 5,
            right: 5,
          },
        },
      },
      {
        name: 'flip',
        options: {
          padding: 5,
        },
      },
      {
        name: 'computeStyles',
        options: {
          adaptive: !moveTransition,
        },
      },
      tippyModifier,
    ];

    if (getIsDefaultRenderFn() && arrow) {
      modifiers.push({
        name: 'arrow',
        options: {
          element: arrow,
          padding: 3,
        },
      });
    }

    modifiers.push(...(popperOptions?.modifiers || []));

    instance.popperInstance = createPopper<ExtendedModifiers>(
      computedReference,
      popper,
      {
        ...popperOptions,
        placement,
        onFirstUpdate,
        modifiers,
      }
    );
  }

  function destroyPopperInstance(): void {
    // 销毁popper 实例
    // 解除实例绑定
    if (instance.popperInstance) {
      instance.popperInstance.destroy();
      instance.popperInstance = null;
    }
  }

  

  // 返回所有popper 元素 数组
  function getNestedPopperTree(): PopperElement[] {
    return arrayFrom(
      popper.querySelectorAll('[data-__NAMESPACE_PREFIX__-root]')
    );
  }

  // 显示计划
  function scheduleShow(event?: Event): void {
    // 清除显示/隐藏/隐藏动画  定时器
    // 不论是正在显示,还是隐藏, 都停止下来
    instance.clearDelayTimeouts();

    if (event) {
      // 触发生命周期钩子
      invokeHook('onTrigger', [instance, event]);
    }

     // document 上绑定事件
     /**
      * doc.addEventListener('mousedown', onDocumentPress, true);
        doc.addEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
        doc.addEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
        doc.addEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
      */
    addDocumentPress();

    // 显示时的延时
    let delay = getDelay(true);

    // 获取触摸行为 和 延时
    const [touchValue, touchDelay] = getNormalizedTouchSettings();

    // 当前是按压触摸设备, 且 有延时
    if (currentInput.isTouch && touchValue === 'hold' && touchDelay) {
      // 延时为触摸延时
      delay = touchDelay;
    }

    // 延时显示 或 显示
    if (delay) {
      showTimeout = setTimeout(() => {
        instance.show();
      }, delay);
    } else {
      instance.show();
    }
  }
  // 隐藏计划
  function scheduleHide(event: Event): void {
    // 清空定时器
    instance.clearDelayTimeouts();
    // 生命周期钩子
    invokeHook('onUntrigger', [instance, event]);

    // 如果正在隐藏
    if (!instance.state.isVisible) {
      // 移除docment上的监听
      removeDocumentPress();
      return;
    }

    // For interactive tippies, scheduleHide is added to a document.body handler
    // from onMouseLeave so must intercept scheduled hides from mousemove/leave
    // events when trigger contains mouseenter and click, and the tip is
    // currently shown as a result of a click.

    // hover 和 click 两种触发方式， 
    // 当 显示是click触发的，  隐藏是hover触发的， 
    // 则return
    if (
      instance.props.trigger.indexOf('mouseenter') >= 0 &&
      instance.props.trigger.indexOf('click') >= 0 &&
      ['mouseleave', 'mousemove'].indexOf(event.type) >= 0 &&
      isVisibleFromClick
    ) {
      return;
    }

    // 延时
    const delay = getDelay(false);
    // 延时隐藏 
    if (delay) {
      hideTimeout = setTimeout(() => {
        if (instance.state.isVisible) {
          instance.hide();
        }
      }, delay);
    } else {
      // 告诉浏览器——你希望执行一个动画，
      // 并且要求浏览器在下次重绘之前调用指定的回调函数更新动画。
      // 该方法需要传入一个回调函数作为参数，该回调函数会在浏览器下一次重绘之前执行

      // Fixes a `transitionend` problem when it fires 1 frame too
      // late sometimes, we don't want hide() to be called.
      // 修正了“transitionend”问题，当它触发1帧太晚时，我们不希望调用hide（）。
      scheduleHideAnimationFrame = requestAnimationFrame(() => {
        instance.hide();
      });
    }
  }

  // ===========================================================================
  // 🔑 Public methods
  // ===========================================================================
  function enable(): void {
    // 启用实例
    instance.state.isEnabled = true;
  }

  function disable(): void {
    // Disabling the instance should also hide it
    // https://github.com/atomiks/tippy.js-react/issues/106
    // 禁用实例, 应该先隐藏实例
    instance.hide();
    instance.state.isEnabled = false;
  }

  // 清除延时定时器
  function clearDelayTimeouts(): void {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);
    cancelAnimationFrame(scheduleHideAnimationFrame);
  }
  // 设置属性
  function setProps(partialProps: Partial<Props>): void {
    /* istanbul ignore else */
    if (__DEV__) {
      warnWhen(instance.state.isDestroyed, createMemoryLeakWarning('setProps'));
    }

    if (instance.state.isDestroyed) {
      return;
    }

    invokeHook('onBeforeUpdate', [instance, partialProps]);

    removeListeners();

    const prevProps = instance.props;
    // 传入属性 覆盖原属性  忽略data- 属性
    const nextProps = evaluateProps(reference, {
      ...instance.props,
      ...partialProps,
      ignoreAttributes: true,
    });

    // 保存新属性
    instance.props = nextProps;

    addListeners();

    // 有交互的延时间隔
    if (prevProps.interactiveDebounce !== nextProps.interactiveDebounce) {
      cleanupInteractiveMouseListeners();
      debouncedOnMouseMove = debounce(
        onMouseMove,
        nextProps.interactiveDebounce
      );
    }

    // Ensure stale aria-expanded attributes are removed
    if (prevProps.triggerTarget && !nextProps.triggerTarget) {
      normalizeToArray(prevProps.triggerTarget).forEach((node) => {
        node.removeAttribute('aria-expanded');
      });
    } else if (nextProps.triggerTarget) {
      reference.removeAttribute('aria-expanded');
    }

    handleAriaExpandedAttribute();
    handleStyles();

    if (onUpdate) {
      // 更新配置
      onUpdate(prevProps, nextProps);
    }

    if (instance.popperInstance) {
      // 重新创建
      createPopperInstance();

      // Fixes an issue with nested tippies if they are all getting re-rendered,
      // and the nested ones get re-rendered first.
      // https://github.com/atomiks/tippyjs-react/issues/177
      // TODO: find a cleaner / more efficient solution(!)
      getNestedPopperTree().forEach((nestedPopper) => {
        // React (and other UI libs likely) requires a rAF wrapper as it flushes
        // its work in one
        requestAnimationFrame(nestedPopper._tippy!.popperInstance!.forceUpdate);
      });
    }

    invokeHook('onAfterUpdate', [instance, partialProps]);
  }

  function setContent(content: Content): void {
    instance.setProps({content});
  }

  // 显示
  function show(): void {
    /* istanbul ignore else */
    if (__DEV__) {
      // 如果已经销毁, 则提示信息
      warnWhen(instance.state.isDestroyed, createMemoryLeakWarning('show'));
    }

    // Early bail-out
    const isAlreadyVisible = instance.state.isVisible;
    const isDestroyed = instance.state.isDestroyed;
    const isDisabled = !instance.state.isEnabled;
    const isTouchAndTouchDisabled = currentInput.isTouch && !instance.props.touch; // 禁用touch
    // 过渡动画持续时间
    const duration = getValueAtIndexOrReturn(
      instance.props.duration,
      0,
      defaultProps.duration
    );

    // 显示 | 销毁 | 禁用 | 禁用touch
    if (
      isAlreadyVisible ||
      isDestroyed ||
      isDisabled ||
      isTouchAndTouchDisabled
    ) {
      return;
    }

    // Normalize `disabled` behavior across browsers.
    // Firefox allows events on disabled elements, but Chrome doesn't.
    // Using a wrapper element (i.e. <span>) is recommended.
    //规范跨浏览器的“禁用”行为。
    //Firefox允许禁用元素上的事件，但Chrome不允许。
    //建议使用包装器元素（如<span>）。
    if (getCurrentTarget().hasAttribute('disabled')) {
      return;
    }

    // 生命周期钩子
    invokeHook('onShow', [instance], false);

    // 回调返回 false 
    if (instance.props.onShow(instance) === false) {
      return;
    }

    // 设置显示状态
    instance.state.isVisible = true;

    // 如果是默认渲染函数, 设置显示样式
    if (getIsDefaultRenderFn()) {
      popper.style.visibility = 'visible';
    }
    // 设置样式, 事件禁用 层级
    handleStyles();
    // 在doc 上添加监听
    addDocumentPress();

    // 未挂载时, 清空过渡动画
    if (!instance.state.isMounted) {
      popper.style.transition = 'none';
    }

    // If flipping to the opposite side after hiding at least once, the
    // animation will use the wrong placement without resetting the duration
    // 如果在隐藏至少一次后翻转到另一侧，动画将使用错误的位置而不重置持续时间
    // 重置过渡动画持续时间
    if (getIsDefaultRenderFn()) {
        // 返回默认popper的子元素
      const {box, content} = getDefaultTemplateChildren();
      // 设置过渡动画持续时间
      setTransitionDuration([box, content], 0);
    }

    onFirstUpdate = (): void => {
      // 为隐藏, 或者 忽略第一次更新
      if (!instance.state.isVisible || ignoreOnFirstUpdate) {
        return;
      }
      // 只在第一次更细
      ignoreOnFirstUpdate = true;

      // 重绘
      // reflow
      void popper.offsetHeight;

      // 移动时的过渡动画
      popper.style.transition = instance.props.moveTransition;

      if (getIsDefaultRenderFn() && instance.props.animation) {
       // 返回默认popper的子元素
        const {box, content} = getDefaultTemplateChildren();
        // 设置过渡动画持续时间
        setTransitionDuration([box, content], duration);
        // data-state
        setVisibilityState([box, content], 'visible');
      }

      handleAriaContentAttribute();
      handleAriaExpandedAttribute();

      // 数组中没有这个值,就插入, 完成挂载的实例
      pushIfUnique(mountedInstances, instance);

      // 实例挂载完成
      instance.state.isMounted = true;

      // 生命周期钩子, 挂载成功
      invokeHook('onMount', [instance]);

      if (instance.props.animation && getIsDefaultRenderFn()) {
        // 过渡动画完成后, 调用生命周期钩子
        onTransitionedIn(duration, () => {
          instance.state.isShown = true;
          invokeHook('onShown', [instance]);
        });
      }
    };

    mount();
  }

  function hide(): void {
    /* istanbul ignore else */
    if (__DEV__) {
      warnWhen(instance.state.isDestroyed, createMemoryLeakWarning('hide'));
    }

    // Early bail-out
    const isAlreadyHidden = !instance.state.isVisible; // 正在隐藏
    const isDestroyed = instance.state.isDestroyed;    // 正在销毁
    const isDisabled = !instance.state.isEnabled;      // 禁用状态

    // 隐藏的持续时间
    const duration = getValueAtIndexOrReturn(  // 获取值在索引或返回
      instance.props.duration,  // value
      1,                        // index
      defaultProps.duration    // 默认值
    );

    // 隐藏 || 销毁||禁用
    if (isAlreadyHidden || isDestroyed || isDisabled) {
      return;
    }

    // 调用 隐藏生命 钩子
    invokeHook('onHide', [instance], false);

    // 自定义隐藏回调 返回 false 
    if (instance.props.onHide(instance) === false) {
      return;
    }

    // 重置属性
    instance.state.isVisible = false;
    instance.state.isShown = false;
    ignoreOnFirstUpdate = false;
    isVisibleFromClick = false;

    // 判断是否为默认的渲染函数
    if (getIsDefaultRenderFn()) {
      popper.style.visibility = 'hidden';
    }
    // 清空交互的鼠标监听事件
    cleanupInteractiveMouseListeners();
    removeDocumentPress();
    handleStyles();

    if (getIsDefaultRenderFn()) {
        // 返回默认popper的子元素
      const {box, content} = getDefaultTemplateChildren();

      if (instance.props.animation) {
        // 设置过渡动画持续时间
        setTransitionDuration([box, content], duration);
        // data-state
        setVisibilityState([box, content], 'hidden');
      }
    }

    // Aria- 属性
    handleAriaContentAttribute();
    handleAriaExpandedAttribute();

    if (instance.props.animation) {
      if (getIsDefaultRenderFn()) {
        // 过渡动画结束后
        onTransitionedOut(duration, instance.unmount);
      }
    } else {
      instance.unmount();
    }
  }

  // pop上有交互,
  // 鼠标离开, 要隐藏
  function hideWithInteractivity(event: MouseEvent): void {
    /* istanbul ignore else */
    if (__DEV__) {
      // 销毁状态, 则提示信息
      warnWhen(
        instance.state.isDestroyed,
        createMemoryLeakWarning('hideWithInteractivity')
      );
    }

    doc.addEventListener('mousemove', debouncedOnMouseMove);
    pushIfUnique(mouseMoveListeners, debouncedOnMouseMove);
    // mouseLeave
    debouncedOnMouseMove(event);
  }
  // 挂载
  function mount(): void {
    // 插入的目标 
    const {appendTo} = instance.props;

    let parentNode: any;

    // By default, we'll append the popper to the triggerTargets's parentNode so it's directly after the reference element so the elements inside the
    // tippy can be tabbed to If there are clipping issues, the user can specify a different appendTo and ensure focus management is handled correctly manually
    // 默认情况下，我们将把popper附加到triggerTargets的parentNode，
    // 这样它就直接位于reference元素之后，这样tippy中的元素就可以被选项卡化了。
    // 如果存在剪辑问题，用户可以指定不同的appendTo并确保手动正确处理焦点管理

    // 当前监听目标 或者 参考元素
    const node = getCurrentTarget();

    // 有交互popper, 可以hover到popper上, appendTo 为默认选项
    //  指定插入到父级元素
    if (
      (instance.props.interactive && appendTo === defaultProps.appendTo) ||
      appendTo === 'parent'
    ) {

      parentNode = node.parentNode;
    } else {
      // 函数 | 指定元素
      parentNode = invokeWithArgsOrReturn(appendTo, [node]);
    }

    // The popper element needs to exist on the DOM before its position can be
    // updated as Popper needs to read its dimensions
    //popper元素需要存在于DOM中，
    // 才能更新其位置，因为popper需要读取其维度

    // 如果父级元素中没有popper则插入
    if (!parentNode.contains(popper)) {
      parentNode.appendChild(popper);
    }

    createPopperInstance();

    /* istanbul ignore else */
    if (__DEV__) {
      // Accessibility check
      warnWhen(
        instance.props.interactive &&
          appendTo === defaultProps.appendTo &&
          node.nextElementSibling !== popper,
        [
          'Interactive tippy element may not be accessible via keyboard',
          'navigation because it is not directly after the reference element',
          'in the DOM source order.',
          '\n\n',
          'Using a wrapper <div> or <span> tag around the reference element',
          'solves this by creating a new parentNode context.',
          '\n\n',
          'Specifying `appendTo: document.body` silences this warning, but it',
          'assumes you are using a focus management solution to handle',
          'keyboard navigation.',
          '\n\n',
          'See: https://atomiks.github.io/tippyjs/v6/accessibility/#interactivity',
        ].join(' ')
      );
    }
  }
  // 取消挂载
  function unmount(): void {
    /* istanbul ignore else */
    if (__DEV__) {
      warnWhen(instance.state.isDestroyed, createMemoryLeakWarning('unmount'));
    }

    // 如果是显示状态先隐藏
    if (instance.state.isVisible) {
      instance.hide();
    }
    // 未挂载
    if (!instance.state.isMounted) {
      return;
    }

    // 销毁popper 实例
    destroyPopperInstance();

    // If a popper is not interactive, it will be appended outside the popper
    // tree by default. This seems mainly for interactive tippies, but we should
    // find a workaround if possible
    //如果一个popper不是交互式的，
    // 默认情况下它将被追加到popper树之外。
    // 这似乎主要是针对交互式提示，但如果可能的话，我们应该找到一个解决方法
    getNestedPopperTree().forEach((nestedPopper) => {
      nestedPopper._tippy!.unmount();
    });

    // 删除
    if (popper.parentNode) {
      popper.parentNode.removeChild(popper);
    }

    // 挂载实例数组中去除
    mountedInstances = mountedInstances.filter((i) => i !== instance);
    // 挂载状态
    instance.state.isMounted = false;
    invokeHook('onHidden', [instance]);
  }

  function destroy(): void {
    /* istanbul ignore else */
    if (__DEV__) {
      warnWhen(instance.state.isDestroyed, createMemoryLeakWarning('destroy'));
    }

    if (instance.state.isDestroyed) {
      return;
    }

    instance.clearDelayTimeouts();
    instance.unmount();

    removeListeners();

    delete reference._tippy;

    instance.state.isDestroyed = true;

    invokeHook('onDestroy', [instance]);
  }
}


// function pop(reference, popper,opt){
//   let placement,strategy,onFirstUpdate,modifiers;
//   opt = {
//     strategy,
//     onFirstUpdate,
//     modifiersOption:{
//       offset:{},
//       preventOverflow:{}
//     },
//     modifiers[]
    

//   }
//   modifiers =  [
//     {
//       name: 'offset',
//       options: {
//         offset: [10, 20],
//       },
//     },
//   ]


  // {
  //   name: 'preventOverflow',
  //   options: {
  //     mainAxis: boolean, // true
  //     altAxis: boolean, // false
  //     padding: Padding, // 0
  //     boundary: Boundary, // "clippingParents"
  //     altBoundary: boolean, // false
  //     rootBoundary: RootBoundary, // "viewport"
  //     tether: boolean, // true
  //     tetherOffset: TetherOffset, // 0
  //   },
  // }

  // {
  //   name: 'arrow',
  //   options: {
  //     element: HTMLElement | string, // "[data-popper-arrow]"
  //     padding: Padding, // 0
  //   },
  // },

  // {
  //   name: 'flip',
  //   options: {
  //     fallbackPlacements: Array<Placement>, // [oppositePlacement]
  //     padding: Padding, // 0,
  //     boundary: Boundary, // "clippingParents"
  //     rootBoundary: RootBoundary, // "viewport"
  //     flipVariations: boolean, // true
  //     allowedAutoPlacements: Array<Placement>, // all supported placements
  //   },
  // },

  // {
  //   name: 'computeStyles',
  //   options: {
  //     gpuAcceleration: boolean,
  //     adaptive: boolean,
  //   },
  // },
  

//   createPopper(reference, popper, {
//     placement, // "bottom"
//     modifiers, // []
//     strategy, // "absolute",
//     onFirstUpdate, // undefined
//   });
// }