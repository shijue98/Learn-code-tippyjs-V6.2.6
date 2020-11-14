import tippy from '..';
import {div} from '../dom-utils';
import {
  CreateSingleton,
  Plugin,
  CreateSingletonProps,
  ReferenceElement,
  CreateSingletonInstance,
} from '../types';
import {removeProperties} from '../utils';
import {errorWhen} from '../validation';

// 单例
const createSingleton: CreateSingleton = (
  tippyInstances,  // 实例[]
  optionalProps = {}  // 选项
) => {
  /* istanbul ignore else */
  if (__DEV__) {
    errorWhen(
      !Array.isArray(tippyInstances),
      [
        'The first argument passed to createSingleton() must be an array of',
        'tippy instances. The passed value was',
        String(tippyInstances),
      ].join(' ')
    );
  }

  // 实例数组
  let mutTippyInstances = tippyInstances;
  // 参考元素数组
  let references: Array<ReferenceElement> = [];
  let currentTarget: Element;
  let overrides = optionalProps.overrides;

  // 设置参考元素数组
  function setReferences(): void {
    references = mutTippyInstances.map((instance) => instance.reference);
  }

  // 启用 | 禁用 实例
  function enableInstances(isEnabled: boolean): void {
    mutTippyInstances.forEach((instance) => {
      if (isEnabled) {
        instance.enable();
      } else {
        instance.disable();
      }
    });
  }

  // 默认禁用
  enableInstances(false);
  setReferences();

  // 插件
  const singleton: Plugin = {
    fn() {
      return {
        onDestroy(): void {
          enableInstances(true);
        },
        onTrigger(instance, event): void {
          const target = event.currentTarget as Element;
          const index = references.indexOf(target);

          // bail-out
          if (target === currentTarget) {
            return;
          }

          currentTarget = target;

          const overrideProps = (overrides || [])
            .concat('content')
            .reduce((acc, prop) => {
              (acc as any)[prop] = mutTippyInstances[index].props[prop];
              return acc;
            }, {});

          instance.setProps({
            ...overrideProps,
            getReferenceClientRect: () => target.getBoundingClientRect(),
          });
        },
      };
    },
  };

  // 创建实例
  const instance = tippy(div(), {
    ...removeProperties(optionalProps, ['overrides']),
    plugins: [singleton, ...(optionalProps.plugins || [])],
    triggerTarget: references,
  }) as CreateSingletonInstance<CreateSingletonProps>;

  
  const originalSetProps = instance.setProps;

  instance.setProps = (props): void => {
    overrides = props.overrides || overrides;
    originalSetProps(props);
  };

  instance.setInstances = (nextInstances): void => {
    enableInstances(true);

    mutTippyInstances = nextInstances;

    enableInstances(false);
    setReferences();

    instance.setProps({triggerTarget: references});
  };

  return instance;
};

export default createSingleton;
