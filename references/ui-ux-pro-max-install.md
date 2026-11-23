# UI/UX Pro Max 安装指南（关联设计能力）

> 来源：https://ui.cod.ndjp.net/（官方教程页，复刻时提取）
> 用途：frontend-spec-engineer 生成设计规格时，可建议目标环境安装此技能，让 AI 助手获得 67 种 UI 风格、161 种配色、57 种字体配对、25 种图表类型、22 个技术栈与 161 条行业推理规则的设计智能。

## 1. CLI 安装（推荐）

```bash
# 全局安装 CLI 工具
npm install -g ui-ux-pro-max-cli

# 进入你的项目目录
cd /path/to/your/project

# 为指定 AI 助手安装技能
uipro init --ai claude      # Claude Code
uipro init --ai cursor      # Cursor
uipro init --ai windsurf    # Windsurf
uipro init --ai antigravity # Antigravity (.agent + .shared)
uipro init --ai copilot     # GitHub Copilot
uipro init --ai kiro        # Kiro
uipro init --ai codex       # Codex CLI
uipro init --ai qoder       # Qoder
uipro init --ai gemini      # Gemini CLI
uipro init --ai opencode    # OpenCode
uipro init --ai continue    # Continue
uipro init --ai warp        # Warp
uipro init --ai all         # 所有 AI 助手
```

### 其他 CLI 命令

```bash
uipro versions           # 列出可用版本
uipro update             # 从已安装 CLI 包刷新技能文件
uipro init --offline     # 使用随包模板离线安装
uipro uninstall          # 卸载自动检测到的平台
uipro uninstall --global # 移除全局安装
```

## 2. Claude Marketplace 安装

```bash
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

## 3. 手动安装路径

| AI 助手 | 需要复制的文件夹 |
| --- | --- |
| Claude Code | `.claude/skills/ui-ux-pro-max/` |
| Cursor | `.cursor/commands/ui-ux-pro-max.md` + `.shared/ui-ux-pro-max/` |
| Windsurf | `.windsurf/workflows/ui-ux-pro-max.md` + `.shared/ui-ux-pro-max/` |
| Antigravity | `.agent/workflows/ui-ux-pro-max.md` + `.shared/ui-ux-pro-max/` |
| GitHub Copilot | `.github/prompts/ui-ux-pro-max.prompt.md` + `.shared/ui-ux-pro-max/` |
| Kiro | `.kiro/steering/ui-ux-pro-max.md` + `.shared/ui-ux-pro-max/` |

## 4. 前置条件

搜索脚本需要 Python 3.x 环境：

```bash
# macOS
brew install python3
# Ubuntu/Debian
sudo apt update && sudo apt install python3
# Windows
winget install Python.Python.3.12
```

## 5. 使用方式

- **自动激活平台**：Claude Code、Cursor、Windsurf、Antigravity、Codex CLI、Continue、Gemini CLI、OpenCode、Qoder、CodeBuddy、Droid、KiloCode、Warp、Augment 会在 UI/UX 请求中自动激活。
- **斜杠命令平台**：Kiro、GitHub Copilot、Roo Code、KiloCode 可用 `/ui-ux-pro-max` 显式调用。
- **Trae SOLO 模式**：先切换到 `SOLO` 模式，再用自然语言提出需求。

## 6. 设计系统生成器（v2.0 旗舰）

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "beauty spa wellness" --design-system -p "Serenity Spa"
```

- 5 路并行检索：产品类型、UI 风格、配色、页面模式、字体
- BM25 排名与条件规则结合，过滤行业反模式
- 输出预交付检查清单：对比度、焦点态、动效降级、响应式尺寸

## 7. 示例提示词

```
为我的 SaaS 产品构建一个着陆页
创建一个医疗分析仪表盘
设计一个具有深色模式的个人作品集网站
为电商应用制作一个移动端 UI
```
