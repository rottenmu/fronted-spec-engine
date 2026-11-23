# 框架与 UI 库工程化映射

## 框架

| 目标 | 默认文件边界 | 组件写法 | 状态/数据边界 | 测试建议 |
| --- | --- | --- | --- | --- |
| React | `pages/`、`components/`、`hooks/`、`services/`、`types/` | 函数组件、Props、组合式 hooks | hooks/services 不直接塞进 JSX | Vitest + Testing Library |
| Vue | `views/`、`components/`、`composables/`、`api/`、`types/` | Vue 3 `<script setup>`、Props、emits | composables/api 与模板分离 | Vitest + Vue Test Utils |
| Solid | `routes/`、`components/`、`signals/`、`services/` | 函数组件、signals、resources | signals/services 与 JSX 分离 | Vitest + Solid Testing Library |

以上只是默认建议。若用户项目已有目录和命名，优先复用现有约定，并在 Prompt 中列出实际文件边界。

## UI 库

| UI 库 | 迁移策略 | 常用映射 | 注意事项 |
| --- | --- | --- | --- |
| Element Plus | Vue 3 项目默认使用官方组件、主题变量和 composable 能力；生产环境建议按需引入（unplugin 方案） | `ElButton`、`ElInput`、`ElSelect`、`ElTable`、`ElDialog`、`ElForm`、`ElTag`、`ElEmpty` | 安装（按需引入）：`npm install -D unplugin-vue-components unplugin-auto-import`；组件参考 https://element-plus.org/zh-CN/component/overview 。使用 `<script setup>`；统一处理 `loading`、`disabled`、`error`、`empty` 状态；不要在页面中直接拼接请求 |
| Vuetify 3 | 使用 Material Design 官方组件与 `v-` 指令体系，主题/颜色走 Vuetify 主题变量 | `v-btn`、`v-text-field`、`v-select`、`v-data-table`、`v-dialog`、`v-form`、`v-chip`、`v-empty-state` | 安装：`pnpm create vuetify`；用 `v-model` 绑定表单、`rules` 做校验；图标用 `v-icon` + mdi；深色主题通过 `theme.dark` 切换；组件参考 https://vuetifyjs.com/zh-Hans/components/all/ |
| PrimeVue | 使用 PrimeVue 组件与 PrimeFlex/Preset 主题系统，Unstyled 模式可用 Tailwind 定制 | `Button`、`InputText`、`Select`、`DataTable`、`Dialog`、`Form`、`Tag`、`Message` | 安装：`npm install primevue @primeuix/themes`（或 yarn/pnpm 等价）；需要引入主题样式（`@primeuix/themes`）；DataTable 用 `columns` + slot 模板；组件参考 https://primevue.dev/installation/ |
| TDesign | 优先使用官方组件和 token，不手写同功能控件 | Button、Input、Select、Table、Dialog、Form、Tag | 保留尺寸、主题和状态 token；复杂表单拆分 |
| Ant Design | 使用 Ant/AntD 组件、Form 规则和 Table 配置 | Button、Input、Select、Table、Modal、Form、Tag | 不把 Ant Design Table 配置堆在页面组件中 |
| shadcn | 使用可复制的 primitives，样式集中在 token/CSS | Button、Input、Select、Table、Dialog、Badge | 明确哪些组件需要生成到项目，避免假定已安装 |
| none | 使用语义 HTML + CSS Variables + 项目现有基础组件 | button、input、select、table、dialog | 必须补足焦点、键盘、错误和响应式样式 |

## 组件映射规则

1. 先按语义和重复结构划分组件，再按 UI 库替换视觉控件。
2. 原型 class 名是证据，不是最终组件 API；组件 API 必须用目标框架习惯命名。
3. 同一组件的 loading、disabled、error、empty、selected、hover 状态必须列成显式状态，而不是只描述默认态。
4. 原型中的表格、列表和卡片如果没有真实数据契约，只生成类型/字段占位说明，不生成伪造数据。
5. 图标优先使用项目已安装的图标包；没有图标包时在 Prompt 中要求保留可替换的 icon slot。

## Element Plus 按需引入参考（生产环境建议）

安装命令：

```bash
npm install -D unplugin-vue-components unplugin-auto-import
```

vite.config.ts：

```ts
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

plugins: [
  vue(),
  AutoImport({ resolvers: [ElementPlusResolver()], dts: 'src/auto-imports.d.ts' }),
  Components({ resolvers: [ElementPlusResolver()], dts: 'src/components.d.ts' }),
],
// 注意：不要把 'element-plus' 放进 manualChunks（会强制聚合抵消 tree-shaking）
```

main.ts 需手动注册命令式能力（v-loading 指令与消息样式）：

```ts
import { ElLoading } from 'element-plus';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
app.directive('loading', ElLoading.directive); // 不再 use(ElementPlus)
```

App.vue 用 ElConfigProvider 保持中文 locale：

```vue
<el-config-provider :locale="zhCn"><router-view /></el-config-provider>
```

strict 模式两个已知坑：
- el-table 的 slot row 类型收紧为 `DefaultRow`，传参需 `row as XxxType` 断言。
- el-radio 的 `v-model` 不接受 `null`，改 `:model-value="x ?? undefined"` + `@update:model-value` 转换。

## Prompt 中的目标栈段落模板

```markdown
目标框架：<react|vue|solid>
目标 UI 库：<element-plus|vuetify|primevue|tdesign|antd|shadcn|none>
组件边界：<列出页面容器、布局区块、可复用组件、状态/数据层>
实现约束：复用现有工程配置；不创建重复的 UI 基础组件；不伪造接口或业务数据。
```
