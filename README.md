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

## 测试与质量门禁

常规检查：

```bash
pnpm typecheck
pnpm lint
pnpm test
```

打包前检查：

```bash
pnpm check:release
```

测试分层、Tauri API mock、SQLite 测试隔离和后续 E2E 策略见 [TESTING.md](./TESTING.md)。

## 打包

打包前先运行：

```bash
pnpm check:release
```

生成 Windows 安装包：

```bash
pnpm tauri build
```

当前 Windows 第一版优先生成 NSIS / MSI 安装包和 portable zip，产物通常位于：

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

Windows 打包机需要可用的 NSIS / `makensis`。如果 Tauri 已生成 release exe 但 bundling 失败，先安装 NSIS 后再重新运行发布检查。

如果本机缺少打包工具链，可以使用 GitHub Actions 的 `Release` workflow。它会读取 `package.json` 的 `version`，使用 `v{version}` 作为 tag；手动触发时如果 tag 不存在会自动创建 tag，然后在 Windows runner 上运行检查、构建 NSIS 安装包，并创建 draft GitHub Release。

常规提交和 PR 会运行 `CI` workflow，覆盖 typecheck、lint、Vitest、Rust test/check 和前端 build。发布时手动触发 `Release` workflow 即可，安装包会直接上传到 GitHub Releases，Release 页面会提供 Windows exe / msi / portable zip；workflow artifact 仅用于调试，不是最终分发入口。当前 Windows 安装包未配置代码签名，Windows 可能提示未知发布者。

发布前按 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) 做安装、覆盖安装、托盘、通知、Codex CLI、SQLite 数据保留和备份恢复检查。

Tallya 当前 AI 生成依赖本机 Codex CLI。SQLite 数据库使用 Tauri SQL 插件保存到应用数据目录，配置为 `sqlite:tallya.db`；覆盖安装不应清空工作记忆、报告或设置。

## AI 服务

Tallya 当前支持两种用户可见 AI 服务：

- Codex CLI：适合本机已安装并登录 Codex CLI 的用户，生成通过本机 Codex CLI 执行。
- OpenAI Compatible：适合使用 API Key、OpenAI API 兼容服务、中转服务、DeepSeek、Kimi 或 OpenRouter 的用户。

使用 OpenAI Compatible 时，需要在设置页填写 Base URL、API Key 和模型。生成所需的工作记录内容会发送到用户配置的 API 服务；API Key 和设置保存在本机，不会用于云同步。Mock Provider 仅用于测试和开发，不会在用户界面中暴露。

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

## 诊断日志

Tallya 会把关键错误和脱敏诊断信息写入 Tauri 应用数据目录下的 `logs/` 目录。日志按天保存，自动保留最近 7 个日志文件。日志用于排查 AI Provider、SQLite、备份恢复、通知和托盘等问题，不会自动上传。

用户可以在 设置 → 数据管理 中打开日志目录，或导出最近诊断日志后手动发给开发者。日志会脱敏 API Key、Authorization header、Bearer token，并且只保留截断后的响应片段；使用远程 AI Provider 时，不会记录完整工作内容或完整 prompt。

## License

暂未指定。
