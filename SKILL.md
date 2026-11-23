---
name: frontend-spec-engineer
description: 分析 HTML/HTM 原型、SPA 构建产物或页面截图（含远程 URL），提取 DOM 语义、布局、组件、设计令牌、资源和交互线索，输出面向 React、Vue 或 Solid 与指定 UI 库的结构化设计规格（OpenSpec）和可执行工程化 Prompt；内置标准前端工程目录落位规范与 Vite+Vue3+TS 工程模板基线（含按需引入 ESLint9/axios/pinia/useTable 等），并配 Node.js 零依赖提取/像素采样脚本，支持"全屏背景+登录卡"等复杂布局还原。Use when a user provides an HTML prototype file/folder/URL or a page screenshot for frontend reconstruction, framework migration, component standardization, project scaffolding, or AI-assisted production-code generation.
---

# 前端设计规格工程师（原型 → OpenSpec + 工程化 Prompt + 工程模板）

## 基本信息

- **Skill Name:** 前端设计规格工程师（frontend-spec-engineer）
- **Author:** Codex（WorkBuddy 增强版 v1.3.2）
- **Version:** 1.3.2
- **Category:** Frontend / Productivity

## 目标

将静态 HTML 原型（或 SPA 构建产物、页面截图、远程页面）转换为"可核验的设计规格 + 可直接交给 Codex/Claude Code 的工程化 Prompt"。证据与推断必须分开：原型中不存在的业务规则、接口、权限和数据不得伪造。

## 输入契约

从用户请求或上下文读取以下参数；缺省值必须按表处理：

| 参数 | 允许值 | 默认值 |
| --- | --- | --- |
| `html_path` | 单个 `.html/.htm` 文件、文件夹、**http(s) URL** 或**截图图片** | 必填 |
| `framework` | `react`、`vue`、`solid` | `vue` |
| `ui_lib` | `element-plus`、`vuetify`、`primevue`、`tdesign`、`antd`、`shadcn`、`none` | `element-plus` |
| `output_format` | `prompt`、`openspec`、`both` | `both` |

如果参数不合法，先报告具体错误并停止，不静默替换用户选择。文件夹输入递归扫描 `.html` 和 `.htm`，按相对路径排序。

### 输入类型判定（v1.1 新增）

| 输入形态 | 判定 | 证据策略 |
| --- | --- | --- |
| 本地 `.html/.htm` 文件或文件夹 | 静态原型 | 直接静态提取 |
| 本地 HTML 但 body 只有 `<div id="root">` 且有大段内联 script | **SPA 构建产物** | 静态提取只能拿骨架；需浏览器渲染或截图采样补足视觉证据 |
| http(s) URL | 远程页面 | 先用 curl/WebFetch 拿标题/文案；若 JS 渲染则用浏览器渲染 |
| 截图图片（png/jpg） | 视觉参考 | 无法解析 DOM，只能用**像素采样**提取令牌 + 人工推断布局 |

## 工作流

### 1. 读取与建立证据边界

1. 解析 `html_path` 的真实路径；拒绝不存在、不可读或超出用户指定范围的路径。URL 输入先下载到本地临时文件或直接抓取文本。
2. 对 HTML 片段按文档片段解析；无需改写源文件。若缺少 `html/head/body`，在分析模型中视为位于 `body`，并记录 `source_kind: fragment`。
3. 读取同目录下可解析的本地 `<link rel="stylesheet">` 文件、内联 `<style>` 和 `style` 属性。远程 URL 只记录地址，不下载、不执行。
4. 记录每条结论的来源文件、选择器/标签和行号（无法精确定位时标记 `line: unknown`）。
5. **识别 SPA 构建产物**：若 `<body>` 内只有挂载节点（`#root`/`#app`）且样式内联在 script 中，标记 `source_kind: spa_bundle`，并明确告知用户"静态提取只能提供骨架证据，视觉细节需浏览器渲染或截图补充"。

### 2. 执行静态提取

优先运行内置脚本（JS 版，Node >= 18，零依赖；Python 版为备选）：

```bash
# JS（首选）
node scripts/analyze_html.mjs --input <html_path>

# Python（备选，需 Python 3）
python scripts/analyze_html.py --input <html_path>
```

脚本输出 JSON，包含每个页面的结构与所有页面的聚合令牌。脚本不可用时，使用等价的静态分析，但保持相同字段和证据/推断规则。禁止执行 HTML 中的 JavaScript、事件处理器或外链资源。

### 2.1 环境与降级路径（v1.2.1 新增）

脚本是**证据增强工具，不是硬依赖**。按可用环境选择：

| 环境 | 可用方案 |
| --- | --- |
| 有 Node >= 18 | 全部 JS 脚本（零依赖，首选） |
| 只有 Python 3 | `analyze_html.py`（标准库即可）；`pixel_sample.py` 需 `pip install pillow` |
| 两者都没有 | **不运行脚本**，直接由 AI 读文件/截图做等价静态分析，保持相同输出字段与证据/推断规则 |
| 仅浏览器（无本地运行时） | 用 WebFetch/浏览器渲染抓取文本与截图，配合像素采样思路人工取色 |

降级原则：无论用哪种路径，输出契约（Layout/Components/Tokens/Assets/Interactions/Accessibility + openspec/prompt 结构）必须一致；缺脚本只影响证据获取效率，不影响规格完整度。

必须提取：

- **Layout**：语义地标、DOM 层级、Flex/Grid 规则、定位方式、宽高约束、滚动区域和 `@media` 断点。
- **Components**：可见组件清单、重复结构、组件变体、禁用/错误/空状态线索；说明组件由哪些标签、类名和属性支持。
- **Tokens**：颜色、CSS 自定义属性、字体族/字号/字重/行高、间距值、圆角、边框、阴影、断点；去重并统计出现次数，生成 CSS Variables 建议。
- **Assets**：图片、SVG、字体、图标和外链资源的原始路径、类型、`alt`/尺寸线索及工程化引入建议。
- **Interactions**：按钮、链接、表单控件、表单提交、`onclick`/`data-*`/ARIA 线索、焦点/悬浮类名；将"观察到的交互线索"和"建议的状态机"分栏。
- **Accessibility**：标题层级、landmark、表单 label、键盘焦点、图片替代文本、颜色对比风险和语义缺失。

### 2.5 视觉证据补充（v1.1 新增：SPA/截图场景）

静态提取不足时按顺序尝试以下手段，**每一条证据都要标注来源**：

#### a) 浏览器渲染（agent-browser / playwright）

```powershell
# 注意：agent-browser 可能受系统代理影响，必要时 NO_PROXY 后重试
NO_PROXY=example.com no_proxy=example.com agent-browser open "<url>"
agent-browser wait --load networkidle
agent-browser snapshot        # 拿渲染后的可见文本与结构
agent-browser screenshot      # 拿视觉截图
agent-browser close
```

- 渲染后 `document.body.innerHTML.length === 0` 说明被**反爬拦截**，此时不要反复重试浏览器，改用下面 b) 方案。
- 截图保存后，用 PIL 确认分辨率与内容有效性。

#### b) 像素级颜色采样（无 CSS 时的设计令牌）

当拿不到 CSS（SPA/反爬/截图输入）时，用内置脚本从截图采样真实颜色，作为**观察证据**而非推断：

```bash
# JS（首选，零依赖，PNG 专用；Node >= 18）
node scripts/pixel_sample.mjs --image <screenshot.png> --points-ratio "card_bg:0.78,0.45;input_bg:0.68,0.40;btn_bg:0.68,0.55;brand_blue:0.05,0.03;page_bg:0.02,0.05"
node scripts/pixel_sample.mjs --image <screenshot.png> --grid 4   # 可选：4x4 网格粗略看色彩分布

# Python（备选，支持 JPEG；需 Python 3 + Pillow）
python scripts/pixel_sample.py --image <screenshot.png> --points-ratio "card_bg:0.78,0.45;input_bg:0.68,0.40;btn_bg:0.68,0.55;brand_blue:0.05,0.03;page_bg:0.02,0.05"
```

采样要点（来自真实案例经验）：
- 品牌主色：采样顶部 logo 文字区域（通常是页面最醒目的非中性色）。
- 卡片背景：采样卡片中心与边缘各 1-2 点（半透明卡片采到的是叠加后的颜色）。
- 输入框/按钮：采样控件中心与边框各 1 点。
- **页面底色**：采样角落纯背景处。
- 半透明毛玻璃：记录采样色后注明"半透明叠加"字样，工程化时用 `rgba()` 模拟。
- 采样得到的色值直接进入设计令牌表，标注 `source: pixel@(x,y)`。
- 注意：JS 版像素采样仅支持 8-bit 非隔行 PNG；JPEG 输入请先转 PNG（`ffmpeg -i in.jpg out.png`）或用 Python 版。

#### c) 文本与产品定位补足（WebFetch + WebSearch）

当页面反爬或渲染为空时：
- 用 WebFetch 抓取 `<title>`、meta、可见文案（登录/注册链接文案、协议链接等）。
- 用 WebSearch 搜索产品名称 + "登录 界面 设计"，获取第三方教程/评测里对界面结构的文字描述。
- **明确标注**：这些属于"外部推断"，不是页面本身的观察证据，Prompt 中必须注明待核验。

### 3. 进行受控推断

- 可以推断布局职责、组件边界、响应式折叠策略和状态命名；每条推断以"推断"标记并引用依据。
- 不得推断真实 API 路径、数据库字段、权限规则、业务计算、用户身份或后端状态。
- 相同颜色/间距只有在数值或语义一致时才合并为一个 token；冲突值保留为变体。
- `display: flex/grid` 只表示布局证据，不自动把任意 `div` 命名为业务组件。
- 远程图片、字体和图标只给出适配建议，不声称资源已下载或可用。
- **版权约束（v1.1）**：真实页面的演示图片/品牌素材受版权保护时，不得直接复制资源文件；在工程化输出中使用 CSS 渐变、SVG 图形或免费可商用素材作为**占位视觉**，并在页面或 Prompt 中明确标注"占位视觉 · 原图为 XXX 截图"。

### 4. 生成输出

根据 `output_format` 输出：

#### `openspec`

生成结构化设计规格，至少包含：

1. 项目摘要与输入文件清单（含输入类型：静态/SPA/截图/URL）。
2. 页面/路由清单与页面级布局树。
3. 组件清单（职责、输入、输出、变体、状态、证据）。
4. 设计令牌表与 CSS Variables（每条注明来源：选择器/像素坐标）。
5. 资源映射表。
6. 交互与状态矩阵（观察到/推断/待确认）。
7. 响应式与无障碍要求。
8. 工程化文件边界、依赖建议和验收清单（建议路径按 project-structure.md 的标准目录落位）。
9. 风险、缺失信息和明确不实现项。

#### `prompt`

生成一个可复制的 Prompt，必须包含以下标题并填入实际分析结果：

```markdown
# Role
# Source Evidence
# Goal and Non-goals
# Target Stack
# Page and Component Architecture
# Design Tokens
# Responsive Behavior
# Interaction and State Contracts
# Asset and API Boundaries
# Accessibility Requirements
# Implementation Deliverables
# Acceptance Criteria
```

Prompt 必须要求目标 AI：

- 先阅读现有工程并复用已有设计系统，再创建文件。
- 使用目标框架的组件化写法和目标 UI 库，不把原始 HTML 粘贴进单个巨型组件。
- 将 API、状态、计算逻辑和展示组件分离；没有真实接口时保留明确的 loading/error/empty 状态，不伪造业务数据。
- 把观测到的原型事实与待确认事项写进实现说明。
- 实现后运行项目已有测试、构建和可访问性检查。
- 原图是受版权保护素材时，用占位视觉代替并标注。

#### `both`

先输出 `openspec`，再输出 `prompt`。两部分必须共享同一份证据和 token 名称；不得在 Prompt 中引入规格中不存在的页面或字段。

### 5. 布局还原校验（v1.1 新增）

生成页面后与参考截图做对照检查，重点核对：

1. **布局骨架**：全屏背景 vs 卡片、顶部 vs 居中、左右栏占比——先看大结构是否一致。
2. **品牌主色**：顶部 logo / 主按钮是否接近采样到的品牌色（用 PIL 生成缩略图对比，或用色差估算）。
3. **表单字段**：字段数量、占位文案、是否有验证码/邀请码/协议勾选，位置（按钮上/下方）。
4. **卡片质感**：毛玻璃/实色/圆角尺寸是否还原。
5. **响应式**：移动端是否折叠为合理形态（如全屏卡片居中）。
6. 差异项逐条列出，能改则改，改不了（如缺版权素材）明确告知用户并提供替代方案。

### 6. 关联设计能力（v1.3 新增：UI/UX Pro Max）

当目标项目需要**更强的设计决策智能**（风格、配色、字体、图表、行业规则）时，可建议安装 UI/UX Pro Max 设计技能，让 AI 助手按产品类型自动生成完整设计系统：

- 安装方式与完整命令见 [ui-ux-pro-max-install.md](references/ui-ux-pro-max-install.md)（CLI / Marketplace / 手动 / 前置条件 / 使用方式 / 设计系统生成器）。
- 推荐时机：生成 openspec 或 prompt 时发现目标页属于明确行业（SaaS、金融、医疗、电商、服务、创意等），可提示"建议目标 AI 配合 UI/UX Pro Max 获取行业专属设计决策"。
- 在生成的 Prompt 的 `# Target Stack` 或 `# Implementation Deliverables` 段落可附带一句安装建议，例如：

```markdown
（可选增强）若需要行业级设计决策，可先安装 UI/UX Pro Max：
npm install -g ui-ux-pro-max-cli && cd <project> && uipro init --ai <claude|cursor|...>
```

- 注意：本技能输出的是"证据驱动的规格与 Prompt"；UI/UX Pro Max 是**可选的设计智能增强**，两者不冲突——规格中的观察值（原型实际颜色/布局）始终优先，风格推荐仅作为辅助推断。

## 工程化输出规则

- 默认只生成规格和 Prompt，不直接修改用户项目；只有用户明确要求"按 Prompt 实现"时才进入代码修改流程。
- 目标框架/UI 库的命名、文件边界和组件映射参照 [framework-matrix.md](references/framework-matrix.md)；Vue 项目默认优先使用 Element Plus。
- 复杂页面必须拆为页面容器、布局区块、可复用组件、状态/数据层和资源层；建议路径按 [project-structure.md](references/project-structure.md) 的标准工程目录落位（components/base 与 business、views/<route>/components、composables、api、store、types、utils、assets），不强行套用不存在的仓库结构。
- 生成的 Prompt 必须给出可验收的文件清单、组件接口和测试场景，而不是泛泛描述"实现页面"。
- 代码行数、响应式和无障碍验收以目标项目现有规范为准；不存在规范时采用框架默认最佳实践并明确说明。
- HTML 中的 `onclick` 等内联脚本只作为交互线索，Prompt 应要求迁移为事件处理器，不得原样执行。

## 自检清单

输出前逐项检查：

- [ ] 所有输入文件均列出，文件夹扫描结果有相对路径；URL/截图输入已标注证据获取方式。
- [ ] Layout、Components、Tokens、Assets、Interactions、Accessibility 均有内容或明确写"未发现"。
- [ ] 每个关键结论都能追溯到标签、选择器、**像素坐标**或浏览器渲染证据；推断单独标记。
- [ ] SPA 输入已明确标注"视觉证据来自浏览器渲染/像素采样"，未把骨架当完整证据。
- [ ] 反爬/空白页场景已用 WebFetch/WebSearch 补足文本与产品定位，并注明为外部推断。
- [ ] 颜色、字号、间距、圆角和阴影没有混淆观察值与建议值。
- [ ] 未编造 API、权限、数据、接口响应或业务规则。
- [ ] 版权素材已用占位视觉替代并标注，未直接复制受保护资源。
- [ ] 布局还原校验通过或差异项已列出（布局骨架/品牌色/表单字段/卡片质感/响应式）。
- [ ] Prompt 明确目标框架、UI 库、文件边界、状态和验收标准。
- [ ] `output_format` 语义正确；`both` 的规格与 Prompt 一致。
- [ ] 外部资源、缺失字体、不可解析 CSS 和无障碍风险已列入风险项。
- [ ] 已按可用环境选择执行路径（Node/Python/无运行时），降级时输出契约保持一致。
- [ ] （可选增强）行业明确时已在 Prompt 中附带 UI/UX Pro Max 安装建议，且规格观察值优先于风格推荐。

## 资源

- `scripts/analyze_html.mjs`：只读、无网络的 HTML/CSS 静态提取器（JS，Node >= 18，零依赖）。
- `scripts/analyze_html.py`：同上（Python 备选）。
- `scripts/pixel_sample.mjs`：像素级颜色采样器（JS，零依赖 PNG 解码），从截图提取设计令牌，支持点采样/比例采样/NxN 网格。
- `scripts/pixel_sample.py`：同上（Python 备选，支持 JPEG）。
- `references/framework-matrix.md`：React/Vue/Solid 与 Vuetify/PrimeVue/TDesign/Antd/shadcn/none 的工程化映射（含安装命令与官方文档地址）。
- `references/project-structure.md`：标准前端工程目录结构与落位规则（components/base+business、views/<route>/components、composables/hooks、api、store、types、utils、assets），生成文件清单时的默认路径映射表。
- `references/vue3-template.md`：Vite + Vue3 + TS + Element Plus 按需引入的完整工程模板（vite.config、eslint 9 flat config、tsconfig、env、axios 封装、pinia、guard、storage/format/validate、useTable/useAuth/useUpload），新工程脚手架与 Prompt 交付物的基线。
- `references/ui-ux-pro-max-install.md`：关联设计能力 UI/UX Pro Max 的完整安装与使用指南（CLI/Marketplace/手动/前置条件/设计系统生成器）。
