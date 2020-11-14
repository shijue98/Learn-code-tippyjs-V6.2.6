import bindGlobalEventListeners, {
  currentInput,
} from './bindGlobalEventListeners';
import createTippy, {mountedInstances} from './createTippy';
import {getArrayOfElements, isElement, isReferenceElement} from './dom-utils';

import {defaultProps, setDefaultProps, validateProps} from './props';

import {HideAll, HideAllOptions, Instance, Props, Targets} from './types';

import {validateTargets, warnWhen} from './validation';


// 返回一个实例
function tippy(
  targets: Targets,  // 触发的目标元素
  optionalProps: Partial<Props> = {}   // 属性参数
): Instance | Instance[] {

  // 合并插件的数组  // 初始化时设置了默认的插件
  const plugins = defaultProps.plugins.concat(optionalProps.plugins || []);

  /* istanbul ignore else */
  //  开发和测试环境
  if (__DEV__) {
    // targets 不存在， 或者不是 元素， 输出错误消息
    validateTargets(targets);
    // 如果传入选项， 不是默认配置项， 也不是插件的配置， 输出警告提示
    validateProps(optionalProps, plugins);
  }

  // 焦点, 键盘触发的, 切换tab依然触发, 鼠标触发的切换鼠标不触发
  bindGlobalEventListeners();

  // 配置选项
  const passedProps: Partial<Props> = {...optionalProps, plugins};

  // 返回一个 元素的数组
  const elements = getArrayOfElements(targets);

  /* istanbul ignore else */
  if (__DEV__) {
    // 插入的内容元素是多个时，则输出警告
    const isSingleContentElement = isElement(passedProps.content);
    const isMoreThanOneReferenceElement = elements.length > 1;
    warnWhen(
      isSingleContentElement && isMoreThanOneReferenceElement,
      [
        'tippy() was passed an Element as the `content` prop, but more than',
        'one tippy instance was created by this invocation. This means the',
        'content element will only be appended to the last tippy instance.',
        '\n\n',
        'Instead, pass the .innerHTML of the element, or use a function that',
        'returns a cloned version of the element instead.',
        '\n\n',
        '1) content: element.innerHTML\n',
        '2) content: () => element.cloneNode(true)',
      ].join(' ')
    );
  }

  // 返回 多个 实例 的数组
  // 为参考元素， 初始化实例
  const instances = elements.reduce<Instance[]>(
    (acc, reference): Instance[] => {
      const instance = reference && createTippy(reference, passedProps);

      if (instance) {
        acc.push(instance);
      }

      return acc;
    },
    []
  );

  // 如果目标是 元素类型 则返回第一个实例, 否则返回实例的数据
  // 一个元素只能对应一个弹出实例
  return isElement(targets) ? instances[0] : instances;
}

// 静态属性
tippy.defaultProps = defaultProps;
tippy.setDefaultProps = setDefaultProps; // 传入的选项， 替换默认中的选项， 
tippy.currentInput = currentInput;

export default tippy;

export const hideAll: HideAll = ({
  exclude: excludedReferenceOrInstance,
  duration,
}: HideAllOptions = {}) => {
  mountedInstances.forEach((instance) => {
    let isExcluded = false;

    if (excludedReferenceOrInstance) {
      isExcluded = isReferenceElement(excludedReferenceOrInstance)
        ? instance.reference === excludedReferenceOrInstance
        : instance.popper === (excludedReferenceOrInstance as Instance).popper;
    }

    if (!isExcluded) {
      const originalDuration = instance.props.duration;

      instance.setProps({duration});
      instance.hide();

      if (!instance.state.isDestroyed) {
        instance.setProps({duration: originalDuration});
      }
    }
  });
};
