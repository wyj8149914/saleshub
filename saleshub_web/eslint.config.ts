/**
 * ESLint Flat Config（ESLint 9+ 扁平配置）
 *
 * 作用：深度静态检查 Vue / TypeScript 代码质量、潜在 bug、最佳实践。
 * 与 Oxlint 分工：Oxlint 负责快速扫描；ESLint 负责更完整的 Vue/TS 规则。
 * 与 Prettier 分工：本文件末尾的 skipFormatting 关闭与 Prettier 冲突的格式类规则。
 *
 * 运行：npm run lint:eslint
 */
import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// 若 .vue 中还要写 TSX 等，可取消下面注释以扩展 script 语言：
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// 详见：https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  // 指定本套规则要检查的文件类型
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  // 全局忽略：构建产物与覆盖率报告不参与 lint
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  // Vue 基础必备规则（essential）
  ...pluginVue.configs['flat/essential'],
  // Vue + TypeScript 推荐规则
  vueTsConfigs.recommended,

  // Vitest 单元测试推荐规则，仅作用于测试目录
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  // 从 .oxlintrc.json 同步规则到 ESLint，避免 Oxlint / ESLint 规则冲突或重复告警
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 关闭所有与 Prettier 冲突的 ESLint 格式化规则，格式化交给 Prettier
  skipFormatting,
)
