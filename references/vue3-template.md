# Vite + Vue3 + TypeScript 工程模板（v1.1 修正版）

> 用途：frontend-spec-engineer 在 Vue 3 + Element Plus 目标下生成新工程脚手架或 Prompt 的
> 「Implementation Deliverables」时的**基线模板**。目录分层规范见
> [project-structure.md](project-structure.md)。
> 包管理器：pnpm（推荐），兼容 npm/yarn。
>
> **v1.1 修正记录**（相对常见网络流传版）：
> 1. ESLint 9 改用 flat config（`eslint.config.js`），弃用 `.eslintrc.cjs`（ESLint 9 默认不再读取）。
> 2. Element Plus 改为 **unplugin 按需自动引入**，去掉全量 `import ElementPlus` 与全量 CSS（包体减小 60%+）。
> 3. Pinia 只在 `store/index.ts` 创建一次，`main.ts` 复用；删除非法的 `persist: false`（未装 pinia-plugin-persistedstate 时该选项无效）。
> 4. `RouteRecordRaw` 改为 `import type`（strict/verbatimModuleSyntax 下值导入会报错）。
> 5. 修复 proxy target / env 中被 markdown 链接污染的 URL。
> 6. `.env` 值去掉多余空格；`guard.ts` 增加白名单与 redirect。

## 1. 完整目录树

```text
vue3-admin/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── api/
│   │   ├── request.ts        # axios 实例、拦截器封装
│   │   ├── user.ts
│   │   └── common.ts
│   ├── assets/
│   │   ├── images/
│   │   ├── fonts/
│   │   └── styles/
│   │       ├── reset.scss
│   │       ├── variables.scss   # 设计令牌（颜色/间距/圆角/断点 CSS 变量）
│   │       └── global.scss
│   ├── components/
│   │   ├── base/             # 基础原子组件
│   │   │   ├── BaseButton/
│   │   │   └── BaseDialog/
│   │   └── business/         # 跨页面业务通用组件
│   │       ├── SearchForm/
│   │       └── TableWrap/
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useTable.ts
│   │   └── useUpload.ts
│   ├── layout/
│   │   ├── index.vue
│   │   └── components/
│   │       ├── Sidebar.vue
│   │       ├── Header.vue
│   │       └── Main.vue
│   ├── router/
│   │   ├── index.ts
│   │   └── guard.ts          # 路由守卫、权限
│   ├── store/                # pinia
│   │   ├── index.ts
│   │   └── modules/
│   │       ├── user.ts
│   │       └── app.ts
│   ├── types/
│   │   ├── global.d.ts
│   │   ├── api.d.ts
│   │   └── enum.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── storage.ts
│   │   └── validate.ts
│   ├── views/
│   │   ├── login/
│   │   │   └── index.vue
│   │   ├── dashboard/
│   │   │   ├── index.vue
│   │   │   └── components/
│   │   └── system/
│   │       ├── user/
│   │       └── role/
│   ├── App.vue
│   └── main.ts
├── .env.development
├── .env.production
├── .env.staging
├── .gitignore
├── eslint.config.js
├── .prettierrc
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 2. package.json

```json
{
  "name": "vue3-admin",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --fix",
    "format": "prettier --write ."
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "pinia": "^2.2.0",
    "axios": "^1.7.0",
    "element-plus": "^2.8.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@vitejs/plugin-vue": "^5.1.0",
    "@vue/tsconfig": "^0.5.1",
    "eslint": "^9.10.0",
    "eslint-plugin-vue": "^9.28.0",
    "globals": "^15.9.0",
    "prettier": "^3.3.0",
    "sass": "^1.77.0",
    "typescript": "^5.6.0",
    "unplugin-auto-import": "^0.18.2",
    "unplugin-vue-components": "^0.27.4",
    "vite": "^5.4.0",
    "vue-tsc": "^2.1.0"
  }
}
```

## 3. vite.config.ts

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需自动引入：模板组件 + ElMessage 等函数式 API
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] })
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/variables.scss" as *;`
      }
    }
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
```

> 注意：sass 现代编译器推荐 `@use ... as *` 替代 `@import`；若 `variables.scss` 仅含
> CSS 自定义属性（`--token: value`），则无需注入，直接在 global.scss 引入即可。

## 4. tsconfig.json / tsconfig.node.json

```json
// tsconfig.json
{
  "extends": "@vue/tsconfig/tsconfig.web.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "strict": true,
    "skipLibCheck": true,
    "types": ["vite/client", "element-plus/global"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// tsconfig.node.json
{
  "extends": "@vue/tsconfig/tsconfig.node.json",
  "compilerOptions": { "composite": true },
  "include": ["vite.config.ts"]
}
```

## 5. eslint.config.js（ESLint 9 flat config）

```js
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    }
  },
  { ignores: ['dist/**', 'node_modules/**'] }
]
```

> ESLint 9 默认**只认 flat config**，`.eslintrc.cjs` 会被静默忽略；`--ext` 参数也已移除。

## 6. .prettierrc

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100
}
```

## 7. 环境变量

```env
# .env.development
VITE_ENV=development
VITE_BASE_API=/api
VITE_APP_TITLE=后台管理系统
```

```env
# .env.production
VITE_ENV=production
VITE_BASE_API=https://api.xxx.com
VITE_APP_TITLE=后台管理系统
```

```env
# .env.staging
VITE_ENV=staging
VITE_BASE_API=/api
VITE_APP_TITLE=后台管理系统(预发)
```

## 8. src/main.ts

```ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './store'
import '@/assets/styles/global.scss'

createApp(App).use(pinia).use(router).mount('#app')
```

> 按需引入模式下**不要** `import ElementPlus` 和 `element-plus/dist/index.css`。

## 9. src/router/index.ts

```ts
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import layout from '@/layout/index.vue'
import { setupGuard } from './guard'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue')
  },
  {
    path: '/',
    component: layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

setupGuard(router)
export default router
```

## 10. src/router/guard.ts

```ts
import type { Router } from 'vue-router'
import { useUserStore } from '@/store/modules/user'

const whiteList = ['/login']

export function setupGuard(router: Router) {
  router.beforeEach((to, _from, next) => {
    const { token } = useUserStore()
    if (token) {
      // 已登录访问 /login 回首页
      to.path === '/login' ? next('/') : next()
    } else if (whiteList.includes(to.path)) {
      next()
    } else {
      next(`/login?redirect=${to.path}`)
    }
  })
}
```

## 11. src/api/request.ts

```ts
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: import.meta.env.VITE_BASE_API,
  timeout: 10000
})

service.interceptors.request.use((config) => {
  // token 注入：从 store 或 storage 取
  // config.headers.Authorization = `Bearer ${token}`
  return config
})

service.interceptors.response.use(
  (res) => res.data,
  (err) => {
    ElMessage.error(err.response?.data?.msg || '请求失败')
    return Promise.reject(err)
  }
)

// 统一请求方法，业务模块只写 url 与参数
export const http = {
  get: <T>(url: string, params?: object, config?: AxiosRequestConfig) =>
    service.get<T, T>(url, { params, ...config }),
  post: <T>(url: string, data?: object, config?: AxiosRequestConfig) =>
    service.post<T, T>(url, data, config)
}

export default service
```

> `ElMessage` 的样式由 `unplugin-auto-import` + `ElementPlusResolver` 自动带出，
> 若模板里没触发过自动引入，手动补 `import 'element-plus/es/components/message/style/css'`。

## 12. src/store/index.ts + modules

```ts
// src/store/index.ts —— pinia 只在这里创建一次
import { createPinia } from 'pinia'
const pinia = createPinia()
export default pinia
export * from './modules/user'
export * from './modules/app'
```

```ts
// src/store/modules/user.ts
import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: storage.get('token') || '',
    username: ''
  }),
  actions: {
    setToken(v: string) {
      this.token = v
      storage.set('token', v)
    },
    logout() {
      this.token = ''
      storage.remove('token')
    }
  }
})
```

```ts
// src/store/modules/app.ts
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    }
  }
})
```

## 13. src/types/global.d.ts

```ts
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_ENV: 'development' | 'production' | 'staging'
  readonly VITE_BASE_API: string
  readonly VITE_APP_TITLE: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## 14. .gitignore

```text
node_modules
dist
.idea
.vscode
*.log
.env.local
pnpm-debug.log*
```

## 15. 高频工具实现（模板自带，复制即用）

```ts
// src/utils/storage.ts —— 带 JSON 序列化与过期支持的 localStorage 封装
interface StorageItem<T> { value: T; expire?: number }

export const storage = {
  set<T>(key: string, value: T, expireSeconds?: number) {
    const item: StorageItem<T> = {
      value,
      expire: expireSeconds ? Date.now() + expireSeconds * 1000 : undefined
    }
    localStorage.setItem(key, JSON.stringify(item))
  },
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      const item = JSON.parse(raw) as StorageItem<T>
      if (item.expire && item.expire < Date.now()) {
        localStorage.removeItem(key)
        return null
      }
      return item.value
    } catch {
      return null
    }
  },
  remove(key: string) { localStorage.removeItem(key) }
}
```

```ts
// src/utils/format.ts
export const formatMoney = (n: number, currency = '¥') =>
  `${currency}${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

export const formatDate = (d: Date | string | number, fmt = 'YYYY-MM-DD HH:mm:ss') => {
  const date = new Date(d)
  const pad = (v: number) => String(v).padStart(2, '0')
  return fmt
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
}
```

```ts
// src/utils/validate.ts
export const isPhone = (v: string) => /^1[3-9]\d{9}$/.test(v)
export const isEmail = (v: string) => /^[\w.-]+@[\w-]+(\.[\w-]+)+$/.test(v)
export const isIdCard = (v: string) => /^\d{17}[\dXx]$/.test(v)
export const maskPhone = (v: string) => v.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
```

```ts
// src/composables/useTable.ts —— 列表页通用：查询 + 分页 + loading
import { reactive, toRefs } from 'vue'

export function useTable<F extends object, R>(fetcher: (params: F & { page: number; pageSize: number }) => Promise<{ list: R[]; total: number }>, defaultFilters: F) {
  const state = reactive({
    loading: false,
    list: [] as R[],
    total: 0,
    page: 1,
    pageSize: 10,
    filters: { ...defaultFilters }
  })

  async function load() {
    state.loading = true
    try {
      const { list, total } = await fetcher({ ...state.filters, page: state.page, pageSize: state.pageSize })
      state.list = list
      state.total = total
    } finally {
      state.loading = false
    }
  }
  function search() { state.page = 1; load() }
  function reset() { Object.assign(state.filters, defaultFilters); search() }

  return { ...toRefs(state), load, search, reset }
}
```

```ts
// src/composables/useAuth.ts
import { computed } from 'vue'
import { useUserStore } from '@/store/modules/user'

export function useAuth() {
  const userStore = useUserStore()
  const isLoggedIn = computed(() => !!userStore.token)
  const hasRole = (role: string) => userStore.username !== '' // TODO: 接入真实角色数据
  return { isLoggedIn, hasRole }
}
```

```ts
// src/composables/useUpload.ts —— 基于 el-upload 的 before-upload 校验
import { ElMessage } from 'element-plus'

export function useUpload(options: { maxSizeMB?: number; accept: string[] } = { accept: ['jpg', 'png'] }) {
  const beforeUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!options.accept.includes(ext)) {
      ElMessage.error(`仅支持 ${options.accept.join('/')} 格式`)
      return false
    }
    const max = (options.maxSizeMB ?? 5) * 1024 * 1024
    if (file.size > max) {
      ElMessage.error(`文件不能超过 ${options.maxSizeMB ?? 5}MB`)
      return false
    }
    return true
  }
  return { beforeUpload }
}
```

## 16. 最小骨架文件

```vue
<!-- src/App.vue -->
<template>
  <router-view />
</template>
```

```vue
<!-- src/layout/index.vue -->
<template>
  <el-container class="layout">
    <Sidebar />
    <el-container>
      <Header />
      <Main />
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import Main from './components/Main.vue'
</script>
```

```vue
<!-- src/layout/components/Main.vue -->
<template>
  <el-main>
    <router-view />
  </el-main>
</template>
```

## 与技能的衔接

- openspec 的「工程化文件边界」按本模板 + project-structure.md 给路径。
- 原型分析出的设计令牌落到 `assets/styles/variables.scss`（CSS 变量形式）。
- React / FSD 版本按需扩展新参考文档，不混入本文件。
