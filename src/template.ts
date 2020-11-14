import {
  ARROW_CLASS,
  BACKDROP_CLASS,
  BOX_CLASS,
  CONTENT_CLASS,
  SVG_ARROW_CLASS,
} from './constants';
import {div, isElement} from './dom-utils';
import {Instance, PopperElement, Props} from './types';
import {PopperChildren} from './types-internal';
import {arrayFrom} from './utils';

// Firefox extensions don't allow .innerHTML = "..." property. This tricks it.
const innerHTML = (): 'innerHTML' => 'innerHTML';

function dangerouslySetInnerHTML(element: Element, html: string): void {
  element[innerHTML()] = html;
}

function createArrowElement(value: Props['arrow']): HTMLDivElement {
  const arrow = div();

  if (value === true) {
    // 默认的div 三角
    arrow.className = ARROW_CLASS;
  } else {
    // string or 元素
    arrow.className = SVG_ARROW_CLASS;

    if (isElement(value)) {
      // 是元素则直接插入
      arrow.appendChild(value);
    } else {
      // 当 html 插入
      dangerouslySetInnerHTML(arrow, value as string);
    }

  }

  return arrow;
}

// 如果props.content是元素, 插入的是html
// props.allowHTML 判断, 插入的是字符串或html
export function setContent(content: HTMLDivElement, props: Props): void {
  // 内容是一个元素
  if (isElement(props.content)) {
    // 清空元素, 后插入元素
    dangerouslySetInnerHTML(content, '');
    content.appendChild(props.content);

  }  // 内容不是一个函数
  else if (typeof props.content !== 'function') {

    // 内容是html 
    if (props.allowHTML) {
      dangerouslySetInnerHTML(content, props.content);
    } // 内容是一个文本 
    else {
      content.textContent = props.content;
    }

  }
}

export function getChildren(popper: PopperElement): PopperChildren {
  // 返回第一个子元素
  const box = popper.firstElementChild as HTMLDivElement;
  const boxChildren = arrayFrom(box.children);

  return {
    box,
    content: boxChildren.find((node) => node.classList.contains(CONTENT_CLASS)),
    arrow: boxChildren.find(
      (node) =>
        node.classList.contains(ARROW_CLASS) ||
        node.classList.contains(SVG_ARROW_CLASS)
    ),
    backdrop: boxChildren.find((node) =>
      node.classList.contains(BACKDROP_CLASS)
    ),
  };
}

export function render(
  instance: Instance
): {
  popper: PopperElement;
  onUpdate?: (prevProps: Props, nextProps: Props) => void;
} {

  // 创建一个div元素
  const popper = div();

  // 创建一个div元素 , 存放内容和三角的div
  const box = div();
  box.className = BOX_CLASS; // tippy-box
  box.setAttribute('data-state', 'hidden');
  box.setAttribute('tabindex', '-1');

  // 存放内容的div
  const content = div(); 
  content.className = CONTENT_CLASS;
  content.setAttribute('data-state', 'hidden');

  setContent(content, instance.props);

  // popper元素 插入内容
  popper.appendChild(box);
  box.appendChild(content);

  // 插入内容, 后更新
  onUpdate(instance.props, instance.props);
  // 自定义属性,和class name,css 不香吗?
  function onUpdate(prevProps: Props, nextProps: Props): void {
    // popper 的子元素
    const {box, content, arrow} = getChildren(popper);

    // 设置主题
    if (nextProps.theme) {
      box.setAttribute('data-theme', nextProps.theme);
    } else {
      box.removeAttribute('data-theme');
    }

    // 设置动画
    if (typeof nextProps.animation === 'string') {
      box.setAttribute('data-animation', nextProps.animation);
    } else {
      box.removeAttribute('data-animation');
    }
    
    // 应用弹性动画
    if (nextProps.inertia) {
      box.setAttribute('data-inertia', '');
    } else {
      box.removeAttribute('data-inertia');
    }

    // 设置最大宽
    box.style.maxWidth =
      typeof nextProps.maxWidth === 'number'
        ? `${nextProps.maxWidth}px`
        : nextProps.maxWidth;

    // 屏幕阅读器
    if (nextProps.role) {
      box.setAttribute('role', nextProps.role);
    } else {
      box.removeAttribute('role');
    }

    // 如果前后内容,或者html不一致, 从新设置
    if (
      prevProps.content !== nextProps.content ||
      prevProps.allowHTML !== nextProps.allowHTML
    ) {
      setContent(content, instance.props);
    }

    // 配置中有三角
    if (nextProps.arrow) {

      if (!arrow) {
        // popper 中无三角, 插入
        box.appendChild(createArrowElement(nextProps.arrow));

      } else if (prevProps.arrow !== nextProps.arrow) {
        // 有三角 与 传入不一致, 重新创建
        box.removeChild(arrow);
        box.appendChild(createArrowElement(nextProps.arrow));
      }
    } else if (arrow) {
      //  popper 中有三角, 配置中无三角, 则删除
      box.removeChild(arrow!);
    }
  }

  return {
    popper,
    onUpdate,
  };
}

// 运行时检查以确定render函数是否是默认函数；
// 这样我们就可以应用默认的CSS转换逻辑，并且可以将其从树中摇动出来
// Runtime check to identify if the render function is the default one; this
// way we can apply default CSS transitions logic and it can be tree-shaken away
render.$$tippy = true;
