/**
 * ESLint v10 Flat Config(扁平化配置)
 *
 * 与旧版 .eslintrc.js 的主要区别:
 * - 使用数组导出,数组中每个对象代表一段配置块(可按 files 匹配不同文件)
 * - 后面的配置块会覆盖前面的同名规则(覆盖顺序:核心推荐 → TS推荐 → prettier → 项目自定义)
 * - env 被移除,全局变量改由 languageOptions.globals + globals 包提供
 * - extends 被移除,改为直接在数组中展开配置对象
 */
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

module.exports = [
    // ============ 全局忽略 ============
    // 不参与 lint 检查的目录:构建产物、依赖、覆盖率报告等
    {
        ignores: ['node_modules/**', 'dist/**', 'coverage/**', '**/*.js'],
    },

    // ============ JavaScript 核心推荐规则(eslint:recommended) ============
    // 提供 no-undef / no-dupe-keys / eqeqeq 等基础正确性检查
    js.configs.recommended,

    // ============ TypeScript 推荐规则(@typescript-eslint/recommended) ============
    // 注意:插件里 configs.recommended 是旧版 eslintrc 格式(含 extends),
    // flat 格式在 configs['flat/recommended'](数组),此处展开写入:
    // 内部已设置 parser(@typescript-eslint/parser)与插件注册,
    // 并对 **/*.ts 关闭了与 TS 冲突的核心规则(如 no-undef、no-unused-vars 改用 TS 版本)
    ...tseslint.configs['flat/recommended'],

    // ============ Prettier 集成(eslint-plugin-prettier/recommended) ============
    // 等价于旧版的 extends: ['prettier'] + plugins: ['prettier'] + 'prettier/prettier': 'error':
    // 1. 关闭所有与 Prettier 冲突的格式类规则(eslint-config-prettier)
    // 2. 将 Prettier 格式化结果作为 eslint 规则执行(prettier/prettier)
    prettierRecommended,

    // ============ 项目自定义配置(仅对 TS 源码生效) ============
    {
        files: ['src/**/*.ts', 'scripts/**/*.ts'],
        languageOptions: {
            // 使用 TS 解析器以支持装饰器(TypeORM)与类型感知规则
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                // 启用类型检查(需与 tsconfig.json 一致),供类型感知规则使用
                project: './tsconfig.json',
                // tsconfig 相对路径的基准目录 = 本配置文件所在目录
                tsconfigRootDir: __dirname,
            },
            // 替代旧版 env: { node: true, es6: true },提供 process/console/require 等 Node 全局变量
            globals: {
                ...globals.node,
                ...globals.es2020,
            },
        },
        rules: {
            // 未使用变量报错,但允许以 _ 开头的参数占位(如 (err, _req) 回调签名)
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            // 不强制要求函数显式声明返回类型(保持与现有代码风格兼容)
            '@typescript-eslint/explicit-function-return-type': 'off',
            // 不强制模块导出入口函数声明返回类型
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            // any 类型仅警告不报错(存量代码较多,渐进收紧)
            '@typescript-eslint/no-explicit-any': 'warn',
            // Prettier 格式不符时报错(格式问题统一交给 Prettier 处理)
            'prettier/prettier': 'error',
            // 禁用 console,但保留 console.warn / console.error(错误输出场景)
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
    },
];
