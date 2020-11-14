import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import cssOnly from 'rollup-plugin-css-only';
import replace from 'rollup-plugin-replace';
import sass from 'rollup-plugin-sass';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import {terser} from 'rollup-plugin-terser';
import pkg from '../package.json';

// 命名空间   变量 或 tippy
const NAMESPACE_PREFIX = process.env.NAMESPACE || 'tippy';

// 插件列表
const plugins = {
  babel: babel({extensions: ['.js', '.ts']}),

  // 替换命名空间
  replaceNamespace: replace({
    __NAMESPACE_PREFIX__: NAMESPACE_PREFIX,
  }),

  // 生产环境变量退还
  replaceEnvProduction: replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
  }),

  // 开发环境变量替换
  replaceEnvDevelopment: replace({
    'process.env.NODE_ENV': JSON.stringify('development'),
  }),

  // js压缩 
  minify: terser(),

  // 解析 js ts
  resolve: resolve({extensions: ['.js', '.ts']}),

  // 提取css为独立文件
  css: cssOnly({output: false}),

  // json 解析
  json: json(),
};

// 生产环境  公共插件
const prodCommonPlugins = [
  plugins.replaceNamespace,
  plugins.resolve,
  plugins.json,
];

// 插件配置列表
const pluginConfigs = {
  base: [plugins.babel, ...prodCommonPlugins],
  bundle: [plugins.babel, ...prodCommonPlugins, plugins.css],
  umdBase: [plugins.babel, plugins.replaceEnvDevelopment, ...prodCommonPlugins],
  umdBaseMin: [
    plugins.babel,
    plugins.replaceEnvProduction,
    ...prodCommonPlugins,
    plugins.minify,
  ],
  umdBundle: [
    plugins.babel,
    plugins.replaceEnvDevelopment,
    ...prodCommonPlugins,
    plugins.css,
  ],
  umdBundleMin: [
    plugins.babel,
    plugins.replaceEnvProduction,
    ...prodCommonPlugins,
    plugins.minify,
    plugins.css,
  ],
};

const banner = `/**!
* tippy.js v${pkg.version}
* (c) 2017-${new Date().getFullYear()} atomiks
* MIT License
*/`;

// umd 公共输出选项
const commonUMDOutputOptions = {
  globals: {'@popperjs/core': 'Popper'},
  format: 'umd',
  name: 'tippy',
  sourcemap: true,
};

// 配置项
const prodConfig = [
  {
    input: 'build/base-umd.js',
    plugins: pluginConfigs.umdBase,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'dist/tippy.umd.js',
      banner,
    },
  },
  {
    input: 'build/bundle-umd.js',
    plugins: pluginConfigs.umdBundle,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'dist/tippy-bundle.umd.js',
      banner,
    },
  },
  {
    input: 'build/base-umd.js',
    plugins: pluginConfigs.umdBaseMin,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'dist/tippy.umd.min.js',
    },
  },
  {
    input: 'build/bundle-umd.js',
    plugins: pluginConfigs.umdBundleMin,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'dist/tippy-bundle.umd.min.js',
    },
  },
  {
    input: 'build/base.js',
    plugins: pluginConfigs.bundle,
    external: ['@popperjs/core'],
    output: {
      file: 'dist/tippy.esm.js',
      format: 'esm',
      banner,
      sourcemap: true,
    },
  },
  {
    input: 'build/headless.js',
    plugins: pluginConfigs.base,
    external: ['@popperjs/core'],
    output: {
      file: 'headless/dist/tippy-headless.esm.js',
      format: 'esm',
      banner,
      sourcemap: true,
    },
  },
  {
    input: 'build/base.js',
    plugins: pluginConfigs.bundle,
    external: ['@popperjs/core'],
    output: {
      file: 'dist/tippy.cjs.js',
      format: 'cjs',
      exports: 'named',
      banner,
      sourcemap: true,
    },
  },
  {
    input: 'build/headless.js',
    plugins: pluginConfigs.base,
    external: ['@popperjs/core'],
    output: {
      file: 'headless/dist/tippy-headless.cjs.js',
      format: 'cjs',
      exports: 'named',
      banner,
      sourcemap: true,
    },
  },
  {
    input: 'build/headless-umd.js',
    plugins: pluginConfigs.umdBase,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'headless/dist/tippy-headless.umd.js',
    },
  },
  {
    input: 'build/headless-umd.js',
    plugins: pluginConfigs.umdBaseMin,
    external: ['@popperjs/core'],
    output: {
      ...commonUMDOutputOptions,
      file: 'headless/dist/tippy-headless.umd.min.js',
    },
  },
];

// Calling the `serve()` plugin causes the process to hang, so we need to delay its evaluation
// 开发和测试的配置
const configs = {
  dev: () => ({
    input: 'test/visual/tests.js',
    plugins: [
      plugins.babel,
      plugins.json,
      plugins.resolve,
      replace({__DEV__: 'true'}),
      plugins.replaceEnvDevelopment,
      sass({output: true}),
      serve({
        contentBase: 'test/visual',
        port: 1234,
      }),
      livereload(),
    ],
    output: {
      file: 'test/visual/dist/bundle.js',
      format: 'iife',
    },
  }),
  test: () => ({
    input: 'test/visual/tests.js',
    plugins: [
      plugins.babel,
      plugins.json,
      plugins.resolve,
      replace({__DEV__: 'true'}),
      plugins.replaceEnvDevelopment,
      sass({output: true}),
    ],
    output: {
      file: 'test/visual/dist/bundle.js',
      format: 'iife',
    },
  }),
};

// 开发和测试的配置
const func = configs[process.env.NODE_ENV];

// 如果不是开发测试, 则返回生产环境配置
export default func ? func() : prodConfig;
