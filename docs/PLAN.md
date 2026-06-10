# Tallya 改造计划：从"一天一条 + AI 网关"到"条目流 + 强检索"

> 主线计划与进度。与 DESIGN.md / AGENTS.md 的**核心定位与边界**冲突时，以本文为准。
> 最近更新：2026-06-10。当前分支：`feat/entry-model`。

## 核心定位（已与用户对齐）

> **本地工作记忆库 = 低摩擦记录 + 强检索。** 日报/周报是顺手导出，AI 是可选增强，先验证留存不碰商业化。

设计主线（贯穿所有里程碑）：
- **记录零结构**：一条 entry = 一句话 + 时间戳，无必填、无强制归类、无 AI 网关。
- **结构事后涌现**：补充(clarification)、难度/工时、跨天线索都是事后可选，AI 建议 + 一键确认，绝不手动维护关联树。
- **AI 只做追问，不做无中生有**：把"写一段"的成本降成"答一两句"，且答案真实。
- **坚决不做**：记录时选项目、手动连线、任务状态机/子任务/截止日期、tags 与 threads 并存（只用 threads）。

---

## 进度总览

| # | 里程碑 | 状态 |
| --- | --- | --- |
| M1 | 核心模型：entry 多条捕获 + FTS5 搜索 + 解绑 AI + 报告降级 | ✅ 已完成并提交（commit `389f420`） |
| M2 | AI 追问式补全：clarification 表 + 手动/AI 补充 + 搜索纳入 | ✅ 代码完成，待提交 |
| M3 | 跨天线索关联：threads + AI 建议归并 + 线索视图 | ⏳ 未开始 |
| M4 | 提醒可靠性：开机自启 + 重排逻辑 | ⏳ 未开始 |
| M5 | 报告重接 entry：周报按线索聚合 + 缺口补全 | ⏳ 未开始 |
| — | 清理：删除旧 daily_memories 读路径 / drop 旧表 | ⏳ 留到验证稳定后 |

---

## 已完成（M1 + M2）当前形态

- **数据**：`entries`（含预留 `thread_id/difficulty/effort`，恒 null）、`entries_fts`（trigram + 触发器）、`entry_clarifications`。`SCHEMA_VERSION = 5`。旧 `daily_memories` 一次性迁成 entry 后保留为归档。
- **仓储**：[entry-repository.ts](../src/features/work-memory/services/entry-repository.ts)、[clarification-repository.ts](../src/features/work-memory/services/clarification-repository.ts)（均内存+SQLite+单例）。
- **检索**：[memory-search-service.ts](../src/features/work-memory/services/memory-search-service.ts) 合并 entry 命中 + clarification 命中的父 entry。FTS5 出错回退 LIKE。点击搜索结果会跳到该 entry 所在日并短暂高亮+滚动定位。
- **主屏**：[work-memory-home.tsx](../src/features/work-memory/work-memory-home.tsx) = composer + 当天 feed。记录全程不调用 AI。
- **补充**：feed item 的「补充」入口 → [entry-supplement-panel.tsx](../src/features/work-memory/components/entry-supplement-panel.tsx)。打开即后台拉 AI 追问（1-2 个问题），始终有手动输入兜底；空输入失焦自动收起。补充以子条目展示在 entry 下，可删、可搜。
- **AI**：`suggestClarifications` 贯通 ai-provider / codex(lib.rs) / openai-compatible / ai-service。AI 未配置时补充退化为纯手动。
- **报告**：周报/范围报告入口与"报告偏好"设置项已隐藏（代码保留，待 M5 重接 entry）。

---

## 下一步（M3 起，回来从这里继续）

### M3：跨天线索关联
- 建 `threads` 表（id, title, status, created_at, updated_at），启用 `entries.thread_id`。
- 仓储：thread-repository（参照现有双实现模式）。
- AI：检测新 entry 与历史 entry 是否同一件事 → 建议归并；用户一键确认/忽略（绝不手动维护关联树）。
- UI：线索视图——点开 thread 看跨天故事线（周报展开素材）。
- 同期可启用难度/工时一键标记 UI（列已预留）。

### M4：提醒可靠性
- 接入 `tauri-plugin-autostart`，设置加"开机自启"开关。
- 核实并补齐 [reminder-service.ts](../src/features/work-memory/services/reminder-service.ts) 重排（启动时 / 设置变更 / 窗口重新可见各一次）。
- 验收：关窗到托盘 + 跨日 + 重启（开自启后）提醒仍按时弹。

### M5：报告重接 entry + 周报缺口补全
- 报告数据源从 daily_memories 切到 entries / threads / clarifications。
- 周报流程：按 thread 聚合本周 → 标出"重点但信息不足"的线索 → 集中追问几句 → 再生成。
- 重新放出报告入口与偏好设置。

---

## 开发须知（重要，回来先看）

- **跑测试必须用 Node 22**：本机默认 Node 20.19 缺全局 `navigator`，测试会在 setup 阶段挂。先 `fnm use 22`（CI 用的也是 22）。
- 常规验证：`pnpm typecheck && pnpm lint && pnpm test`。改了 Rust 跑 `cargo test --manifest-path src-tauri/Cargo.toml`。
- **不要** `pnpm tauri dev`；浏览器验证用已运行的 `http://localhost:1420`（但注意 dev server 里 SQL 插件不可用，持久化/FTS 只能在真机 Tauri 应用里验）。
- 仓储/AI/window 能力不要在 UI 组件里直接调；走 repository / service / provider。
- 提交信息：参照仓库既有格式，**简短 subject、不写正文**（见 AGENTS.md）。

## 待验证 / 已知风险

- **FTS trigram 中文搜索**：需 SQLite ≥ 3.34。真机里若日志出现 `entry.search_fts_fallback`，说明 trigram 不可用、已退回 LIKE，要换分词方案。
- **真机验证项**：无 AI 配置下记录→搜索→补充全流程；旧 daily_memories 迁移；补充面板交互；搜索点击定位高亮。
- 旧 `daily_memories` 表与相关读路径仍在，留到 entry 模型验证稳定后再清理（早期数据不重要）。
