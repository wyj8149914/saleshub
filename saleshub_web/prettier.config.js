/**
 * Prettier 配置：只负责「代码长什么样」（格式），不检查逻辑对错。
 *
 * 与 ESLint / Oxlint 分工：
 * - Prettier：引号、分号、行宽、换行等纯格式
 * - ESLint / Oxlint：未使用变量、错误 API、Vue 规范等语义问题
 *
 * 运行：npm run format
 * 文档：https://prettier.io/docs/options
 *
 * 说明：下列为 Prettier 3.x 全部适合写在配置文件中的选项。
 * 未写明「已自定义」的项均为官方默认值，显式列出便于查阅与统一修改。
 * 不适合写进配置文件的 API/CLI 项（parser / filepath / rangeStart / rangeEnd）已省略。
 *
 * @type {import('prettier').Config}
 */
export default {
  // ---------- 实验性 ----------
  /** 三元表达式新格式（问号跟在条件后）；默认 false */
  experimentalTernaries: false,
  /** 二元表达式换行时运算符位置：'start' | 'end'；默认 'end' */
  experimentalOperatorPosition: 'end',

  // ---------- 通用排版 ----------
  /** 每行大致最大字符数（软限制，非硬性 max-len）；【已自定义】默认 80 */
  printWidth: 120,
  /** 缩进空格数；默认 2 */
  tabWidth: 2,
  /** 用 Tab 缩进（false 为用空格）；默认 false */
  useTabs: false,
  /** 语句末尾加分号；默认 true */
  semi: true,
  /** 字符串用单引号（JSX 不受此项影响，见 jsxSingleQuote）；【已自定义】默认 false */
  singleQuote: true,
  /** 对象属性加引号时机：'as-needed' | 'consistent' | 'preserve'；默认 'as-needed' */
  quoteProps: 'as-needed',
  /** JSX 中使用单引号；默认 false */
  jsxSingleQuote: false,
  /**
   * 多行结构尾随逗号：'all' | 'es5' | 'none'
   * v3 默认已是 'all'
   */
  trailingComma: 'all',
  /** 对象字面量括号内空格：{ foo: bar } vs {foo: bar}；默认 true */
  bracketSpacing: true,
  /**
   * 对象字面量换行策略：'preserve' | 'collapse'
   * preserve：开括号后已有换行则保持多行；collapse：能单行则压成单行
   * 默认 'preserve'
   */
  objectWrap: 'preserve',
  /**
   * 多行 HTML/JSX/Vue 标签的 `>` 是否跟在最后一行属性后（非自闭合）
   * true：`>` 不单独占一行；默认 false
   */
  bracketSameLine: false,
  /**
   * 箭头函数单参数是否加括号：'always' | 'avoid'
   * always：(x) => x；avoid：x => x；默认 'always'
   */
  arrowParens: 'always',

  // ---------- 特殊标记 / 渐进接入 ----------
  /** 仅格式化文件顶部带 @prettier / @format 的文件；默认 false */
  requirePragma: false,
  /** 格式化后在文件顶部插入 @format；默认 false */
  insertPragma: false,
  /** 识别 @noprettier / @noformat 并跳过该文件；默认 false */
  checkIgnorePragma: false,

  // ---------- Markdown / HTML / Vue ----------
  /**
   * Markdown 散文换行：'always' | 'never' | 'preserve'
   * 默认 'preserve'（不改原有换行）
   */
  proseWrap: 'preserve',
  /**
   * HTML/Vue/Angular 空白敏感度：'css' | 'strict' | 'ignore'
   * 默认 'css'（按 CSS display 默认值判断空白是否重要）
   */
  htmlWhitespaceSensitivity: 'css',
  /** Vue 的 <script> / <style> 内代码是否再缩进一层；默认 false */
  vueIndentScriptAndStyle: false,

  // ---------- 换行符 / 嵌入语言 / 属性 ----------
  /**
   * 换行符：'lf' | 'crlf' | 'cr' | 'auto'
   * 默认 'lf'（与跨平台 Git 仓库更友好）
   */
  endOfLine: 'lf',
  /**
   * 是否格式化嵌入代码（如 md 代码块、html`...` 标签模板）
   * 'auto' | 'off'；默认 'auto'
   */
  embeddedLanguageFormatting: 'auto',
  /**
   * HTML/Vue/JSX 是否强制每个属性单独一行
   * false：能放同一行就同一行，超 printWidth 再拆成一属性一行
   * 默认 false
   */
  singleAttributePerLine: false,
};
