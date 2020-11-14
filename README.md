

入口文件 
```javascript
    build\bundle-umd.js
  ```
初始化 tippy

返回接口实例
```javascript
  Instance: Instance = {
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
  ```
静态方法
```javascript
    tippy.createSingleton = createSingleton;    // 创建单例  外接函数, 用于创建多个不用的实例
    tippy.delegate = delegate;                  // 事件委派, 用户 通过父元素, 为子元素创建实例
    tippy.hideAll = hideAll;                    // 隐藏全部
    tippy.roundArrow = ROUND_ARROW;
  ```
静态属性
```javascript
tippy.defaultProps = defaultProps;
tippy.setDefaultProps = setDefaultProps;   // 传入的选项， 替换默认中的选项， 
tippy.currentInput = currentInput;         // 当前输入(触发)元素
  ```
index.js
```javascript
function tippy(
  targets: Targets,  // 触发的目标元素
  optionalProps: Partial<Props> = {}   // 属性参数
): Instance | Instance[] {
    // 配置选项
    const passedProps: Partial<Props> = {...optionalProps, plugins};
    // 返回一个 元素的数组
    const elements = getArrayOfElements(targets);
    createTippy(reference, passedProps);
}
  ```
createTippy.ts
```javascript
function createTippy(
  reference: ReferenceElement, // 触发的目标参考元素
  passedProps: Partial<Props>  // 配置选项
): Instance {

     // 返回处理后的选项 , 元素上的属性 (ignoreAttributes==true) 覆盖 传入的属性
    const props = evaluateProps(reference, passedProps);

     // 生成popper  
    const {popper, onUpdate} = props.render(instance = 接口实例);

      // 调用插件的 fn 函数
    const pluginsHooks = plugins.map((plugin) => plugin.fn(instance));

    // 根据 props.trigger , 给 props.triggerTarget || reference 添加监听 
    // mouseenter mouseleave | focusin focusout | click
    addListeners();

    // 如果配置时为显示, 则创建的时候显示
    scheduleShow();

     // 与popper 可交互的情况下, 鼠标移到popper 则阻止隐藏
    popper.addEventListener('mouseenter', () => {
        instance.clearDelayTimeouts();
    });
    // 有mouseenter触发方式, 且 与popper 可交互的情况下,鼠标离开popper, 
    // 如果鼠标在popper 或者 触发目标上, 则 不作为
    // 否则, 移除doc上的监听 且 应该隐藏 scheduleHide()
    //  debouncedOnMouseMove 防抖机制 延时触发移动方法 onMouseMove
    popper.addEventListener('mouseleave', (event) => {
        doc.addEventListener('mousemove', debouncedOnMouseMove);
        debouncedOnMouseMove(event);
    });
}
  ```
template.ts
```javascript
function render(
  instance: Instance
): {
  popper: PopperElement;
  onUpdate?: (prevProps: Props, nextProps: Props) => void;
} {
    // 创建一个popper弹出元素
    const popper = div();
    ...
    // 插入显示的内容
    setContent(content, instance.props);

    // 插入内容后, 后更新对应配置
    onUpdate(instance.props, instance.props);
    // 自定义属性,和class name,css 不香吗?
    function onUpdate(prevProps: Props, nextProps: Props): void {
        // 设置主题
        box.setAttribute('data-theme', nextProps.theme);
        // 设置动画
        box.setAttribute('data-animation', nextProps.animation);
        // 应用弹性动画
        box.setAttribute('data-inertia', '');
        // 如果前后内容,或者html不一致, 从新设置
        setContent(content, instance.props);
        // 配置中有三角
        box.appendChild(createArrowElement(nextProps.arrow));
    }

     return {
        popper,
        onUpdate,
    };
}
  ```
createTippy.ts
应该去显示
可能因为要隐藏, 会取消显示
```javascript
function scheduleShow(event?: Event): void {
     // 清除显示/隐藏/隐藏动画  定时器
    // 不论是正在显示,还是隐藏, 都停止下来
    instance.clearDelayTimeouts();

    // document 上绑定事件
    doc.addEventListener('mousedown', onDocumentPress, true);
    doc.addEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
    doc.addEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
    doc.addEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);

    
    // 延时显示 或 显示
    if (delay) {
      showTimeout = setTimeout(() => {
        instance.show();
      }, delay);
    } else {
      instance.show();
    }
}
  ```
显示
显示前的准备工作
```javascript
function show(): void {

    // 如果 显示 | 销毁 | 禁用 | 禁用touch  则 return

    // 回调返回 false 
    if (instance.props.onShow(instance) === false) return;

    // 设置显示状态
    instance.state.isVisible = true;

    // popperjs 首次更新的钩子
    onFirstUpdate = (): void => {

        // 移动时的过渡动画
        popper.style.transition = instance.props.moveTransition;

        // 挂载完成的数组中没有这个值,就插入, 完成挂载的实例
        pushIfUnique(mountedInstances, instance);

         // 实例挂载完成
        instance.state.isMounted = true;

        // 过渡动画完成后, 调用生命周期钩子
        onTransitionedIn(duration, () => {
          instance.state.isShown = true;
        });
    }

    // 挂载
    mount();

}
  ```

```javascript
 function mount(): void {
     // 插入的目标 配置
    const {appendTo} = instance.props;

    parentNode = invokeWithArgsOrReturn(appendTo,...);  // 插入的目标节点

    parentNode.appendChild(popper);

    // 创建 Popper实例
    createPopperInstance();

 }
```

  创建 Popper实例
```javascript
// https://popper.js.org/docs/v2/modifiers/

function createPopperInstance(): void {
    destroyPopperInstance();
    // 配置选项
    const {
      popperOptions,
      placement,
      offset,
      getReferenceClientRect,
      moveTransition,
    } = instance.props;

    // 设置修饰符
    const modifiers: Array<ExtendedModifiers> = [...]

    // 创建实例
    instance.popperInstance = createPopper<ExtendedModifiers>(...);
}
 ```
销毁Popper实例
```javascript
  function destroyPopperInstance(): void {
    // 销毁popper 实例
    // 解除实例绑定
    if (instance.popperInstance) {
      instance.popperInstance.destroy();
      instance.popperInstance = null;
    }
  }
```

 // 应该去隐藏
 可能因为显示, 取消隐藏
 ```javascript
function scheduleHide(event: Event): void {
     // 清空定时器
    instance.clearDelayTimeouts();

    // 如果正在隐藏
    if (!instance.state.isVisible) {
      // 移除docment上的监听
        doc.removeEventListener('mousedown', onDocumentPress, true);
        doc.removeEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
        doc.removeEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
        doc.removeEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
      return;
    }

     // hover 和 click 两种触发方式， 
    // 当 显示是click触发的，  隐藏是hover触发的， 
    // 则return

    if (delay) {
      hideTimeout = setTimeout(() => {
          instance.hide();
      }, delay);
    } else {
      // 修正了“transitionend”问题，当它触发1帧太晚时，我们不希望调用hide（）。
      scheduleHideAnimationFrame = requestAnimationFrame(() => {
        instance.hide();
      });
    }

}
  ```
// 隐藏
隐藏的准备工作
```javascript
  function hide(): void {
      // 如果  隐藏 || 销毁||禁用  则 return

        // 自定义隐藏回调 返回 false 
      if (instance.props.onHide(instance) === false)  return; 

      // 重置属性
      // 清空交互的鼠标监听事件

      // 过渡动画结束后
        onTransitionedOut(duration, instance.unmount);

  }
  ```
  // 取消挂载
  ```javascript
  function unmount(): void {
       // 销毁popper 实例
    destroyPopperInstance();
    popper.parentNode.removeChild(popper);
    // 挂载实例数组中去除
    mountedInstances = mountedInstances.filter((i) => i !== instance);
    // 挂载状态
    instance.state.isMounted = false;

  }
```

================================
事件监听触发的操作
================================

鼠标在document上 按下的事件监听
应该显示的时候,添加按下监听, 
待到应该隐藏的时候, 移除监听

```javascript
function scheduleShow(event?: Event): void {
    // document 上绑定事件
    doc.addEventListener('mousedown', onDocumentPress, true);
}

function scheduleHide(event: Event): void {
    doc.removeEventListener('mousedown', onDocumentPress, true);
}
```
鼠标在document上 按下的事件监听
可交互时, 点击popper不隐藏
点击触发目标, 如果click方式触发, 在显示中, 不隐藏
如果配置了点击隐藏, 则隐藏
```javascript
  function onDocumentPress(event: MouseEvent | TouchEvent): void {
      // 可交互的配置, 鼠标在Popper上mousedown , 则 return 不隐藏 

      // 在 触发目标上 上mousedown, 且正在显示未挂载时, 且 触发方式包含click, 则 return

      // 如果允许点击隐藏
      instance.clearDelayTimeouts();
      instance.hide();

  }
```

instance.props.trigger  
触发打开  click  mouseenter   focus  focusin
触发关闭  click  mouseleave   focusout


click 触发 打开 / 关闭
mouseenter  focus  focusin  触发打开
```javascript
  function onTrigger(event: Event): void {
    // 两个变量控制click打开还是关闭
    // isVisibleFromClick: boolean      全局变量 
    // shouldScheduleClickHide: boolean 局部变量

    scheduleShow(event);
  }
```
mouseleave 触发关闭
```javascript
  function onMouseLeave(event: MouseEvent): void {
    // pop上有交互
    if (instance.props.interactive) {
      // 有交互的去隐藏
      instance.hideWithInteractivity(event);
      return;
    }

    scheduleHide(event);
  }
```

focusout blur  触发关闭
```javascript
 function onBlurOrFocusOut(event: FocusEvent): void {
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
```

 // pop上有交互,
  // 鼠标离开, 要隐藏
  debouncedOnMouseMove 延时触发移动方法 onMouseMove
  ```javascript
  function hideWithInteractivity(event: MouseEvent): void {

    doc.addEventListener('mousemove', debouncedOnMouseMove);
    pushIfUnique(mouseMoveListeners, debouncedOnMouseMove);
    // mouseLeave
    debouncedOnMouseMove(event);
  }
```

 // 鼠标移动
  // 有交互的情况
  // 不能解决 有空隙的快速切换滑入问题
  // 如果鼠标在popper 或者 触发目标上, 则 不作为
  // 否则, 移除doc上的监听 且 应该隐藏
   ```javascript
  function onMouseMove(event: MouseEvent): void {

    // 鼠标在 参考元素 或 弹出框 上
    const isCursorOverReferenceOrPopper =
      //  参考元素 || popper 
      getCurrentTarget().contains(target) || popper.contains(target);

      // 在 参考元素 或 弹出框 上 移动鼠标, 则 return
    if (event.type === 'mousemove' && isCursorOverReferenceOrPopper) {
      return;
    }

      // 鼠标 在 边界之外
    if (isCursorOutsideInteractiveBorder(popperTreeData, event)) {
      // 移除 document 上 鼠标监听
      cleanupInteractiveMouseListeners();
      scheduleHide(event);
    }
  }

Learn-code-tippyjs-V6.2.6

// 闭包的应用
// 防抖机制
//--------------------
function debounce(fn , ms){

  var timeout = null;

  return function(arg) {
    clearTimeout(timeout);

    timeout = setTimeout(function(){
      fn(arg);

    }, ms);
  }
}
// 使用方法 和 测试
//--------------------
function log(arg){
  console.log(arg);
}
// 初始化闭包函数
var debounceLog = debounce(log, 200);

// 这三个一起调用, 只能输出最后一个
debounceLog(1)
debounceLog(2)
debounceLog(3)

// 一个一个调用, 每次都输出
setInterval(function(){
  debounceLog(5)
},300)


}
  ```
```javascript

function debounce(fn , ms){
  //  ======================
  // 从这里


  // 这个变量相当于debounceLog函数的全局变量
  var timeout = null;



  // 到这里 
  //  只有调用var debounceLog = debounce(log, 200);
  //  的时候执行了一次 
  // ============================


  // debounceLog(1) 调用这个函数的时候, 
  // 只调用下面的, 上面的不调用

  return function(arg) {
    clearTimeout(timeout);

    timeout = setTimeout(function(){
      fn(arg);

    }, ms);
  }
}


var fn = function (arg){
  console.log(arg);
}
var ms = 200;
var timeout = null;

var debounceLog = function(arg) {
    clearTimeout(timeout);

    timeout = setTimeout(function(){
      fn(arg);

    }, ms);
}


    var timeout = setTimeout(function(){
      console.log(1);
    }, 200);

    clearTimeout(timeout);

    const uuid = (function () {
        let id = 0;
        return function (str) {
            str = str || '';
            id++;
            return str + id
        }

    })();

```