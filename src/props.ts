import {DefaultProps, Plugin, Props, ReferenceElement, Tippy} from './types';
import {
  hasOwnProperty,
  removeProperties,
  invokeWithArgsOrReturn,
} from './utils';
import {warnWhen} from './validation';

const pluginProps = {
  animateFill: false,
  followCursor: false,
  inlinePositioning: false,
  sticky: false,
};

const renderProps = {
  allowHTML: false,
  animation: 'fade',
  arrow: true,
  content: '',
  inertia: false,
  maxWidth: 350,
  role: 'tooltip',
  theme: '',
  zIndex: 9999,
};

// 默认的配置选项
export const defaultProps: DefaultProps = {
  appendTo: () => document.body,
  aria: {
    content: 'auto',
    expanded: 'auto',
  },
  delay: 0,
  duration: [300, 250],
  getReferenceClientRect: null,
  hideOnClick: true,
  ignoreAttributes: false,
  interactive: false,
  interactiveBorder: 2,
  interactiveDebounce: 0,
  moveTransition: '',
  offset: [0, 10],
  onAfterUpdate() {},
  onBeforeUpdate() {},
  onCreate() {},
  onDestroy() {},
  onHidden() {},
  onHide() {},
  onMount() {},
  onShow() {},
  onShown() {},
  onTrigger() {},
  onUntrigger() {},
  onClickOutside() {},
  placement: 'top',
  plugins: [],
  popperOptions: {},
  render: null,
  showOnCreate: false,

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
  touch: true, 
  trigger: 'mouseenter focus',
  /**
   * 触发的元素, 允许与reference分离
   * // default (reference is used)
      triggerTarget: null,
      // Element
      triggerTarget: someElement,
      // Element[]
      triggerTarget: [someElement1, someElement2],
   */
  triggerTarget: null,   
  ...pluginProps,
  ...renderProps,
};

//  默认属性的key的数组
const defaultKeys = Object.keys(defaultProps);

export const setDefaultProps: Tippy['setDefaultProps'] = (partialProps) => {
  /* istanbul ignore else */
  if (__DEV__) {
    // 验证传入选项， 在不在配置 选项中
    validateProps(partialProps, []);
  }
  // 传入的选项， 替换默认中的选项， 
  const keys = Object.keys(partialProps) as Array<keyof DefaultProps>;
  keys.forEach((key) => {
    (defaultProps as any)[key] = partialProps[key];
  });
};

export function getExtendedPassedProps(
  passedProps: Partial<Props> & Record<string, unknown>
): Partial<Props> {

  const plugins = passedProps.plugins || [];

  const pluginProps = plugins.reduce<Record<string, unknown>>((acc, plugin) => {
    const {name, defaultValue} = plugin;

    if (name) {
      acc[name] =
        passedProps[name] !== undefined ? passedProps[name] : defaultValue;
    }

    return acc;
  }, {});

  return {
    ...passedProps,
    ...pluginProps,
  };
}

// 获取元素上的配置属性
export function getDataAttributeProps(
  reference: ReferenceElement,
  plugins: Plugin[]
): Record<string, unknown> {
  const propKeys = plugins
    ? Object.keys(getExtendedPassedProps({...defaultProps, plugins}))
    : defaultKeys;

  const props = propKeys.reduce(
    (acc: Partial<Props> & Record<string, unknown>, key) => {
      const valueAsString = (
        reference.getAttribute(`data-tippy-${key}`) || ''
      ).trim();

      if (!valueAsString) {
        return acc;
      }

      if (key === 'content') {
        acc[key] = valueAsString;
      } else {
        try {
          acc[key] = JSON.parse(valueAsString);
        } catch (e) {
          acc[key] = valueAsString;
        }
      }

      return acc;
    },
    {}
  );

  return props;
}

//  处理传入的属性, 和 元素上的属性
export function evaluateProps(
  reference: ReferenceElement,
  props: Props
): Props {
  // 元素上的属性, 覆盖传入的属性
  const out = {
    ...props,
    content: invokeWithArgsOrReturn(props.content, [reference]), // props.content 函数, 则把reference传入函数,调用返回值, 否则直接返回
    ...(props.ignoreAttributes // 是否忽略reference上的属性
      ? {}
      : getDataAttributeProps(reference, props.plugins)),  // 获取元素上的属性
  };

  //  覆盖默认属性
  // 屏幕阅读器
  out.aria = {
    ...defaultProps.aria,
    ...out.aria,
  };

  out.aria = {
    expanded:
      out.aria.expanded === 'auto' ? props.interactive : out.aria.expanded,
    content:
      out.aria.content === 'auto'
        ? props.interactive
          ? null
          : 'describedby'
        : out.aria.content,
  };

  return out;
}

// 验证传入的选项
export function validateProps(
  partialProps: Partial<Props> = {},
  plugins: Plugin[] = []
): void {
  // 传入的选项 keys 
  const keys = Object.keys(partialProps) as Array<keyof Props>;

  keys.forEach((prop) => {
    // 从默认配置项中 排除掉插件中 的属性
    const nonPluginProps = removeProperties(
      defaultProps,
      Object.keys(pluginProps)
    );

    // 判断 默认配置 中 是否包含 传入的 这个属性
    let didPassUnknownProp = !hasOwnProperty(nonPluginProps, prop);

    // 如果传入的属性， 不在配置项中
    if (didPassUnknownProp) {
      // 检查插件中是否存在该属性`
      didPassUnknownProp =
        plugins.filter((plugin) => plugin.name === prop).length === 0;
    }
    // 如果传入选项， 不是默认配置项， 也不是插件的配置， 
    // 输出警告提示
    warnWhen(
      didPassUnknownProp,
      [
        `\`${prop}\``,
        "is not a valid prop. You may have spelled it incorrectly, or if it's",
        'a plugin, forgot to pass it in an array as props.plugins.',
        '\n\n',
        'All props: https://atomiks.github.io/tippyjs/v6/all-props/\n',
        'Plugins: https://atomiks.github.io/tippyjs/v6/plugins/',
      ].join(' ')
    );
  });

}
