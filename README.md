# frontend-spec-engineer

前端设计规格工程师 —— 将 HTML/HTM 原型、SPA 构建产物、远程页面 URL 或页面截图，转换为**可核验的设计规格（OpenSpec）+ 可直接交给 Codex / Claude Code / WorkBuddy 的工程化 Prompt**，并内置标准工程目录落位规范与 Vite + Vue3 + TS 工程模板基线。

## 特性

- **证据驱动**：观察证据与推断严格分离，原型中不存在的 API、权限、业务规则一律不伪造
- **六维提取**：Layout / Components / Tokens / Assets / Interactions / Accessibility
- **零依赖脚本**：`analyze_html`（HTML/CSS 证据提取，Node/Python 双版本）、`pixel_sample`（像素级取色，从截图提取设计令牌）
- **降级链路**：SPA / 反爬 / 截图输入 → 浏览器渲染 → 像素采样 → WebFetch 文案补足，证据来源全程标注
- **三种输出**：`openspec` / `prompt` / `both`，规格与 Prompt 共享同一份证据与 token 命名
- **工程落位**：标准前端目录规范（components/base+business、views/<route>/components、composables/hooks、api、store、types、utils、assets）
- **模板基线**：Vite + Vue3 + TS + Element Plus 按需引入完整模板（ESLint 9 flat config、axios 封装、pinia、路由守卫、storage/format/validate、useTable/useAuth/useUpload）
- **布局还原校验**：骨架 / 品牌色 / 表单字段 / 卡片质感 / 响应式逐项核对

## 安装

将本目录复制到技能目录即可（WorkBuddy：`~/.workbuddy/skills/frontend-spec-engineer`；Claude Code / Codex 同理放入对应 skills 目录）。

## 使用

```
@skill:frontend-spec-engineer <html_path> [--framework react|vue|solid] [--ui-lib element-plus|vuetify|...] [--output-format prompt|openspec|both]
```

默认：`vue + element-plus + both`。

## 目录结构

```text
frontend-spec-engineer/
├── SKILL.md                          # 技能主文档（工作流、输入契约、自检清单）
├── agents/openai.yaml                # Agent 接口配置
├── references/
│   ├── framework-matrix.md           # React/Vue/Solid × UI 库映射
│   ├── project-structure.md          # 标准前端工程目录与落位规则
│   ├── vue3-template.md              # Vue3 管理后台工程模板（v1.1 修正版）
│   └── ui-ux-pro-max-install.md      # UI/UX Pro Max 设计智能增强（可选）
└── scripts/
    ├── analyze_html.mjs / .py        # 只读 HTML/CSS 证据提取器（零依赖）
    └── pixel_sample.mjs / .py        # 像素级设计令牌采样器（零依赖）
```

## License

MIT
