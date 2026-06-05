# Tallya / 职迹

Tallya 是一个本地优先的 AI 工作记忆工具，帮助你把每天的工作记录沉淀成可搜索、可复盘、可生成报告的本地记忆。

## 当前状态

Tallya 是一个桌面端本地工具，当前处于早期开发阶段。

当前已具备：

- 今日工作记录；
- AI 整理今日记忆；
- 今日记忆预览与保存；
- 历史工作记忆列表；
- Spotlight 风格搜索；
- 本地数据存储；
- Codex CLI 生成；
- 通知提醒配置与系统通知；
- 设置页；
- 本地优先。

## 产品原则

- 本地优先；
- 低输入负担；
- 不做后台管理系统；
- 不做普通日报生成器；
- 首页始终聚焦“今天做了什么？”。

更多设计规则见 [DESIGN.md](./DESIGN.md)。

## 技术栈

- Tauri 2
- React
- TypeScript
- Vite
- shadcn/ui
- Tailwind CSS
- Codex CLI
- OverlayScrollbars

## 开发环境

安装依赖：

```bash
pnpm install
```

启动前端开发服务：

```bash
pnpm dev
```

启动 Tauri 桌面开发环境：

```bash
pnpm tauri dev
```

构建前端：

```bash
pnpm build
```

运行测试：

```bash
pnpm test
```

运行 lint：

```bash
pnpm lint
```

## Codex CLI

Tallya 当前使用本机 Codex CLI 生成工作记忆。请确保本机已安装并登录 Codex CLI。

设置页中的 AI 服务当前只展示 Codex CLI。Mock Provider 仅用于测试和开发，不会在用户界面中暴露。

## 项目结构

`src/components/ui`

shadcn 基础组件。

`src/features/work-memory/components`

工作记忆相关 UI 组件。

`src/features/work-memory/components/settings`

设置页相关组件。

`src/features/work-memory/hooks`

页面状态和交互 hooks。

`src/features/work-memory/services`

业务服务、repository、AI provider、通知调度等。

`src/features/work-memory/services/ai`

AI Provider 与 Codex CLI 相关逻辑。

`src/lib`

通用工具。

`src/styles`

全局样式。

`src-tauri`

Tauri 后端。

## 开发约定

- 开发前阅读 [AGENTS.md](./AGENTS.md) 和 [DESIGN.md](./DESIGN.md)；
- 不要把 UI、存储、AI 调用混在一个组件里；
- 不要把业务组件放进 `components/ui`；
- 不要暴露 Mock Provider 给用户；
- 版本号跟随 `package.json`；
- 新功能优先保持本地优先。

## 数据与隐私

- 工作记录默认保存在本机；
- 当前不依赖云同步；
- AI 生成通过用户本机配置的 AI 服务进行；
- 使用 Codex CLI 时，实际数据处理行为取决于本机 Codex 配置。

SQLite 使用 Tauri SQL 插件，当前数据库配置为 `sqlite:tallya.db`。该路径相对 Tauri `BaseDirectory::App`，也就是应用数据目录，不是项目根目录，也不是 `~/.tallya`。Windows 通常位于 `AppData/Roaming/<bundle identifier>/tallya.db`，macOS / Linux 根据 Tauri 应用数据目录规则存放。

## License

暂未指定。
