// 程序入口
import css from '../dist/tippy.css';
import {injectCSS} from '../src/css';
import {isBrowser} from '../src/browser';

import tippy, {hideAll} from '../src';

import createSingleton from '../src/addons/createSingleton';
import delegate from '../src/addons/delegate';

// 插件
import animateFill from '../src/plugins/animateFill';
import followCursor from '../src/plugins/followCursor';
import inlinePositioning from '../src/plugins/inlinePositioning';
import sticky from '../src/plugins/sticky';

import {ROUND_ARROW} from '../src/constants';

import {render} from '../src/template';

// 如果是浏览器环境
if (isBrowser) {
  // 在 style 或 link 标签前, 注入css
  injectCSS(css);
}

// 设置默认的属性 , 和插件
tippy.setDefaultProps({
  plugins: [animateFill, followCursor, inlinePositioning, sticky],
  render,
});

// 创建单例  外接函数, 用于创建多个不用的实例
tippy.createSingleton = createSingleton;
// 事件委派, 用户 通过父元素, 为子元素创建实例
tippy.delegate = delegate;
tippy.hideAll = hideAll;
tippy.roundArrow = ROUND_ARROW;

export default tippy;
