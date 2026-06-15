# Tallya 改造计划：从"一天一条 + AI 网关"到"条目流 + 强检索"

> 主线计划与进度。与 DESIGN.md / AGENTS.md 的**核心定位与边界**冲突时，以本文为准。
> 最近更新：2026-06-15。entry 模型已合并进 `master` 并随 v0.2.3 发布。

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
| M2 | AI 追问式补全：clarification 表 + 手动/AI 补充 + 搜索纳入 | ✅ 已完成并提交（commit `7d60d44`） |
| M3 | 跨天线索关联：threads + AI 建议归并 + 线索视图 | ✅ 已完成并提交（commit `bcfa92e`） |
| M4 | 提醒可靠性：开机自启 + 重排逻辑 + 修每日提醒数据源 | ✅ 已完成并提交 |
| M5a | 报告重接 entry：数据源/AI 输入切到 entries + 重放入口与偏好 | ✅ 已完成并提交（日报/周报/范围报告均上线） |
| M5b | 周报缺口补全：标信息不足的线索 + 集中追问再生成 | ✅ 已完成并提交 |
| — | 清理：删除旧 daily-memory 读路径 | ✅ 已删除 `daily-memory-repository`（commit `c4e59ab`）；`daily_memories` 表与一次性迁移保留兼容旧数据 |

---

## 已完成（M1 + M2 + M3）当前形态

- **数据**：`entries`（含预留 `difficulty/effort`，仍 null；`thread_id` 自 M3 起启用）、`entries_fts`（trigram + 触发器）、`entry_clarifications`、`threads`。`SCHEMA_VERSION = 7`。旧 `daily_memories` 一次性迁成 entry 后保留为归档（读路径已删，仅表与迁移留存）。
- **仓储**：[entry-repository.ts](../src/features/work-memory/services/entry-repository.ts)、[clarification-repository.ts](../src/features/work-memory/services/clarification-repository.ts)、[thread-repository.ts](../src/features/work-memory/services/thread-repository.ts)（均内存+SQLite+单例）。entry-repository 新增 `setThread / listByThread / listRecent`。
- **检索**：[memory-search-service.ts](../src/features/work-memory/services/memory-search-service.ts) 合并 entry 命中 + clarification 命中的父 entry。FTS5 出错回退 LIKE。点击搜索结果会跳到该 entry 所在日并短暂高亮+滚动定位。
- **主屏**：[work-memory-home.tsx](../src/features/work-memory/work-memory-home.tsx) = composer + 当天 feed。记录全程不调用 AI。
- **补充**：feed item 的「补充」入口 → [entry-supplement-panel.tsx](../src/features/work-memory/components/entry-supplement-panel.tsx)。打开即后台拉 AI 追问（1-2 个问题），始终有手动输入兜底；空输入失焦自动收起。补充以子条目展示在 entry 下，可删、可搜。
- **线索（M3）**：[thread-service.ts](../src/features/work-memory/services/thread-service.ts) = 线索摘要/故事线/归并。记一条 entry 后后台静默调 `suggestThreadLink` 比对最近 ~20 条；命中就在该条下方弹建议卡（归并/忽略，见 [entry-feed-item.tsx](../src/features/work-memory/components/entry-feed-item.tsx)）。线索视图是**独立面板** [threads-panel.tsx](../src/features/work-memory/components/threads-panel.tsx)（工具栏 ListTree 按钮入口，见 [use-threads-panel.ts](../src/features/work-memory/hooks/use-threads-panel.ts)）：线索列表 → 点开看跨天故事线 → 点 entry 跳到对应天。搜索面板保持纯记录搜索。建议为会话内临时态，忽略不持久化。
- **AI**：`suggestClarifications` + `suggestThreadLink` 贯通 ai-provider / codex(lib.rs) / openai-compatible / anthropic / ai-service。用户可见 provider 现为 Codex CLI、OpenAI Compatible、Claude / Anthropic（Ollama 因未完成已移除）。AI 未配置时补充退化为纯手动、归并建议后台静默跳过。
- **报告（M5a）**：数据源从 daily_memories 切到 entries——[report-service.ts](../src/features/work-memory/services/report-service.ts) 的 `buildReportEntries` 从 entryRepository.listRange + clarifications + threads 组装 `ReportSourceEntry[]`（按天升序、带补充与线索名）。AI 报告输入 `memories`→`entries` 贯通 types/ai-service/openai/codex/lib.rs，prompt 要求按线索聚合脉络。入口重新放出：工具栏 FileText「报告」按钮 → 生成/预览/保存/历史（4 个对话框 + [use-weekly-report-flow.ts](../src/features/work-memory/hooks/use-weekly-report-flow.ts) 重新挂载于主屏，与搜索/线索/设置互斥）。设置"报告偏好"分组重新可见。简化：不再写 report_sources（报告随时可重新生成）。缺口补全留 M5b。
- **周报缺口补全（M5b）**：点"生成"先静默调 `suggestReportGaps`（[report-service.ts](../src/features/work-memory/services/report-service.ts) `getReportGaps`，fail-open）让 AI 挑 ≤3 条"重点但信息不足"的线索并各给一句追问；命中则弹 [report-gap-dialog.tsx](../src/features/work-memory/components/report-gap-dialog.tsx)（可逐条答、可整体跳过）；答案经 `saveGapAnswers` 存为对应 entry 的 clarification，再 `runGenerate` 生成（buildReportEntries 自动带上）。无 AI/无缺口/失败都直接生成。AI 能力贯通 ai-provider/ai-service/openai/codex/lib.rs。
- **提醒（M4）**：每日提醒判定改用 entries——[reminder-service.ts](../src/features/work-memory/services/reminder-service.ts) `handleDailyReminder` 查当天 `entryRepository.listByDate`，"今天一条都没记"才提醒（修了 entry 模型下恒弹的 bug）。开机自启经 `tauri-plugin-autostart` 真正接上（[window-service.ts](../src/features/work-memory/services/window-service.ts) `syncLaunchAtStartup`，按 `launchAtStartup` enable/disable）。重排时机：启动 + 设置变更 + **窗口重新可见**（[reminder-bootstrap.tsx](../src/features/work-memory/components/settings/reminder-bootstrap.tsx) 监听 visibilitychange/focus），兜住休眠/隐藏导致的 setTimeout 漂移。

---

## 下一步（核心里程碑 M1–M5b 已全部完成）

剩余可选清理 / 增强：
- 旧 `daily-memory-repository` 读路径已删除（commit `c4e59ab`）；如确认无旧数据需迁移，可进一步 drop `daily_memories` 表与迁移代码。
- 可选：report_sources 重新启用为 entry 维度的 staleness（当前不写、报告随时可重新生成）。
- 可选：把缺口检测/归并建议改走 HTTP 网关以提速（Codex 冷启动慢，见 [local-gateway-plan.md](./local-gateway-plan.md)）。

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
- **M3 真机验证项**：配好 AI 后跨天记两条同一件事→第二条下方出现归并建议→「归并」后搜索面板（空关键词）能看到线索→点开看到跨天故事线→点 entry 跳到对应天高亮；AI 未配置时记录无建议卡、不报错；「忽略」后建议卡消失。
- 旧 `daily_memories` 读路径已删除；表与一次性迁移仍保留以兼容旧数据，如确认无需可再 drop。
