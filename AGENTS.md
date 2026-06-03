用户偏好：

- 当用户要求“提交代码”时，默认提交当前项目里的所有改动文件。
- 提交信息先参考对应项目既有提交信息格式；用户偏好简短提交信息，不写详细正文，除非用户明确要求。
- 提交代码时按照当前项目之前的提交信息格式来提交。

项目规则：

- 不要运行 `pnpm tauri dev`。
- 开发前先阅读 `DESIGN.md`。
- 修改 UI 时必须遵守 `DESIGN.md`。
- 不要未经要求大改首页布局。
- 不要新增 Tauri 新窗口，除非用户明确要求。
- 版本号必须跟随 `package.json`，不要在 UI 中写死版本号。

产品方向：

- Tallya / 职迹 是本地优先的 AI 工作记忆工具。
- 不要把它做成后台管理系统、SaaS 官网、普通日报生成器或项目管理系统。
- 首页必须保持聚焦：今天做了什么？

文案规则：

- 修改用户可见文案时，必须遵守 `DESIGN.md` 中的产品性格和文案语气规则。
- 默认提醒、空状态、错误提示、按钮文案都要保持克制、温和、清楚。
- 避免催促式、老板式、鸡血式、卖萌式文案。
- 不要使用“日报”作为核心产品心智，优先使用“工作记忆”“沉淀”“整理”等词。

UI 约束：

- 所有可点击元素必须有 `cursor-pointer`，disabled 状态使用 `cursor-not-allowed`。
- Tailwind 4 能用 canonical class 的地方优先不用任意 px class。
- TSX 文件不要堆太多代码；组件变长时按职责拆分为更小的组件文件。
- 不要做未经要求的大型布局重构。
- 不要随意重设计首页。
- 搜索使用 Spotlight / Command Palette 风格。
- 预览和确认使用轻量 Dialog。
- 没有可执行价值的按钮不要展示，不要用 disabled 按钮做占位。
- 设置页保持轻量分组：左侧分组菜单 + 右侧内容，不使用顶部横向 Tabs，不做后台 sidebar。

代码组织规则：

- 不要把多个大型 TSX 组件写进一个文件。
- Dialog、Panel、List、ListItem、Settings Section 应拆分为独立组件。
- UI 组件不要直接调用 `localStorage`、Tauri command、shell、AI provider。
- 本地存储走 repository。
- AI 调用走 service / provider。
- service / repository / provider 逻辑不得写死在 UI 组件中。
- 新增设置项时要考虑未来扩展。
- `components/ui` 只放 shadcn 基础组件，不放业务组件。
- 业务组件放到 `src/features/work-memory/components`。
- AI 逻辑放到 `src/features/work-memory/services/ai`。
- 设置存储逻辑放到 `app-settings-repository`。
- 记忆存储逻辑放到 `daily-memory-repository`。

Provider 规则：

- 不要向用户暴露 Mock Provider。
- Mock Provider 只用于测试和开发。
- 当前用户可见 AI 服务是 Codex CLI。
- Provider 结构要为 OpenAI Compatible 和 Ollama 预留扩展。
- 不要把未来 Provider 假设写死进 UI。

目录边界：

- `src/features/work-memory/components`：放业务 UI 组件。
- `src/features/work-memory/components/settings`：放设置页相关组件。
- `src/features/work-memory/hooks`：放页面状态和交互 hooks。
- `src/features/work-memory/services`：放业务服务、repository、AI provider、窗口能力。
- `src/features/work-memory/services/ai`：放 AI Provider、AI Service、Codex CLI Provider、Mock Provider、相关测试。
- `src/components/ui`：只放 shadcn 基础组件，不放业务组件。

验证约束：

- 不启动新的 dev server；如需查看网页或做浏览器验证，访问用户已运行的 `http://localhost:1420`。
- 常规验证只运行 `cargo check`、前端 lint 和 type-check。
- 修改前端逻辑后至少跑 type-check 和 lint。
