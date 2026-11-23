# 标准前端工程目录结构（默认落位规范）

> 用途：frontend-spec-engineer 生成 openspec 的「工程化文件边界」与 Prompt 的
> 「Implementation Deliverables / Page and Component Architecture」时，按此结构给组件、
> 组合式函数、类型、工具、接口请求分配建议路径。
> 原则：**若目标工程已存在结构，以现有结构为准；仅在新工程或结构缺失时套用本规范。**

## 目录结构

```text
project-root/
├── public/                # 不经过打包的静态资源（favicon、robots.txt）
├── src/
│   ├── api/               # 接口请求，按业务模块拆分（user.ts / order.ts）
│   ├── assets/            # 编译型资源：图片、字体、全局scss变量
│   ├── components/        # 全局通用公共组件（按钮、弹窗、表格封装、基础UI）
│   │   ├── base/          # 基础原子组件 BaseButton、BaseInput
│   │   └── business/      # 跨页面复用业务组件 SearchBar、FileUpload
│   ├── composables/       # Vue组合式函数（React换成 hooks/）
│   ├── layout/            # 全局布局组件（侧边栏、header、main布局容器）
│   ├── router/            # 路由配置、路由守卫
│   ├── store/             # 状态管理 Pinia / Zustand / Redux
│   ├── types/             # TS全局类型、接口定义、枚举
│   ├── utils/             # 通用工具函数：日期、脱敏、请求封装、正则
│   ├── views/（pages/）   # 页面级路由页面，一个路由对应一个文件夹
│   │   └── user/
│   │       ├── index.vue
│   │       └── components/ # 仅当前页面私有组件
│   ├── App.vue / App.tsx
│   └── main.ts            # 入口文件
├── .env.development       # 环境变量
├── .env.production
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## 落位规则（生成文件清单时逐条套用）

| 产物 | 落位 | 说明 |
| --- | --- | --- |
| 原子组件（BaseButton、BaseInput 等） | `src/components/base/` | 命名一律 `Base` 前缀 PascalCase |
| 跨页面业务组件（SearchBar、FileUpload 等） | `src/components/business/` | 仅被单个页面使用时下沉到该页面 `components/` |
| 页面私有组件 | `src/views/<route>/components/` | 一个路由一个文件夹；Vue 用 `index.vue`，React 用 `index.tsx` |
| 全局布局（侧边栏/header/容器） | `src/layout/` | 原型中的 header、侧边栏、多栏容器在此落地 |
| 组合式函数 / 状态逻辑 | `src/composables/`（Vue）/ `src/hooks/`（React） | 从原型的内联交互线索提炼；React 一律替换目录名 |
| 接口请求 | `src/api/<module>.ts` | 按业务模块拆分；**原型中不存在的接口只定义类型与 mock，不编造路径** |
| 全局状态 | `src/store/` | Pinia（Vue）/ Zustand / Redux（React），模块化拆分 |
| 全局类型、接口定义、枚举 | `src/types/` | 组件内私有类型就近定义，跨组件共享的才上提 |
| 工具函数（日期、脱敏、请求封装、正则） | `src/utils/` | 请求封装放 `src/utils/request.ts`，供 `api/` 引用 |
| 静态图片、字体、全局样式变量 | `src/assets/` | 全局 SCSS 变量/设计令牌放 `assets/styles/` |
| 不打包资源（favicon、robots.txt） | `public/` | 原型外链资源仅给适配建议，不下载 |
| 环境变量 | `.env.development` / `.env.production` | 接口 baseURL 等走环境变量，不硬编码 |

## 框架差异速查

- **Vue 3**：`views/` + `composables/` + `App.vue`；UI 库默认 Element Plus（按需自动引入），完整可落地配置基线见 [vue3-template.md](vue3-template.md)。
- **React**：`views/` 可叫 `pages/`，`composables/` 改为 `hooks/`，`App.vue` 改 `App.tsx`；shadcn/antd 组件按 framework-matrix.md 引入。
- **响应式断点、设计令牌**：以 CSS Variables 形式放 `src/assets/styles/`（如 `tokens.scss` / `variables.scss`），全局 `main.ts` 引入。

## 与 openspec 的衔接

openspec 第 8 节「工程化文件边界」中的每个建议路径都必须能映射到本表的某一行；
映射不到的（如原型特有的非页面模块）单独列出并注明理由，不强行套用。
