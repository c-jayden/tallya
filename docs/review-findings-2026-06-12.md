# 项目 Review 结论与待修任务（2026-06-12）

> 本文档来自一次全量 code review，聚焦两块：① 全局问题修复进度；② AI 配置 / Provider 链路的兼容性深查。
> 「已修复」是本次顺手改掉的；「交给 Codex」的每个任务自包含，可直接复制给 Codex 执行。
> 注意：本次会话因工具故障未能运行 `pnpm check`，开始任何任务前先跑一次确认基线是绿的。

---

## 一、已修复（本次提交内）

1. **跨午夜「今天」失效**：`today` 原是模块级常量，托盘常驻数天后新记录会落到旧日期。
   新增 [use-today-date.ts](../src/features/work-memory/hooks/use-today-date.ts)（focus/visibility + 每分钟刷新），
   [work-memory-home.tsx](../src/features/work-memory/work-memory-home.tsx) 改用 hook，且翻日时若用户正停留在旧「今天」会自动跟到新「今天」。
2. **本地网关默认关闭**：原默认 `enabled: true` 且指向 `localhost:8080`，任何撞端口、`/v1/models` 返回 JSON 的服务都会收到用户工作内容。现默认 `false`（[app-settings-repository.ts](../src/features/work-memory/services/app-settings-repository.ts)）。
3. **旧数据复活防护**：`migrateDailyMemoriesToEntries` 原以「entries 为空」为触发条件，用户手动删光条目后重启会把旧 daily_memories 再迁一遍。现在用 `app_settings` 里的标记键 `internal.dailyMemoriesMigratedToEntries.v1` 保证只跑一次（[migrations.ts](../src/features/work-memory/services/database/migrations.ts)）。
4. **备份不再泄露 API Key**：导出时 `openAICompatible.apiKey` 置空；导入时若备份里 key 为空，保留本机已配置的 key 不被抹掉（[backup-service.ts](../src/features/work-memory/services/backup-service.ts)）。
5. **预设切换 / 空模型陷阱**：
   - 切换服务商预设时不再把上一家的模型名带过去（火山方舟等 `defaultModel: ''` 的预设会清空模型字段让用户填接入点 ID）。
   - settings normalize 不再把用户有意清空的模型名偷偷还原成 `gpt-5.4-mini`（那会向火山/硅基发一个必然不存在的模型）。留空模型在调用时会得到明确的「请填写模型名称」。
   改动：[ai-settings-section.tsx](../src/features/work-memory/components/settings/ai-settings-section.tsx)、[app-settings-repository.ts](../src/features/work-memory/services/app-settings-repository.ts)。

---

## 二、交给 Codex 的任务

### 任务 1（最高优先级）：备份纳入 entries / clarifications / threads

**现状**：[backup-service.ts](../src/features/work-memory/services/backup-service.ts) 的 `BackupPayload` 只含 `dailyMemories / reports / reportSources / appSettings`。自条目模型（M1）起核心数据在 `entries`、`entry_clarifications`、`threads` 三张表，全部不在备份里。用户现在导出的备份**不含任何真实记录**，导入也恢复不出来——但 UI 会提示成功。

**要做**：
1. 给三个仓储补全量读写方法（双实现：LocalStorage + SQLite，与现有风格一致）：
   - [entry-repository.ts](../src/features/work-memory/services/entry-repository.ts)：`listAll(): Promise<Entry[]>`、`replaceAll(entries: Entry[]): Promise<void>`
   - [clarification-repository.ts](../src/features/work-memory/services/clarification-repository.ts)：`listAll()`、`replaceAll()`
   - [thread-repository.ts](../src/features/work-memory/services/thread-repository.ts)：`listAll()`（已有 `list()` 可复用）、`replaceAll()`
   - SQLite 的 `replaceAll` = `DELETE FROM x` + 逐行 INSERT（与 report-repository.replaceAll 同模式）。
2. `BackupPayload` 升 `version: 2`，data 增加 `entries / clarifications / threads`；`validateBackupFile` 同时接受 v1（缺的三个数组按 `[]` 处理）与 v2。
3. `restoreBackupPayload` 恢复三张新表；注意恢复 v1 备份时**不要**依赖启动时的 daily_memories 迁移（它已被一次性标记拦住），应在恢复流程里显式把 dailyMemories 转成 entries（可抽取 migrations.ts 里的转换逻辑复用）。
4. 更新 [backup-service.test.ts](../src/features/work-memory/services/__tests__/backup-service.test.ts)：v2 导出含三类数据、v1 导入兼容、恢复后 entries 可读。
5. 保持本次已加的「导出剔除 apiKey / 导入保留本机 key」行为不回退。

**验证**：`pnpm typecheck && pnpm lint && pnpm test`；真机里导出 → 清除数据 → 导入 → 条目/补充/线索完整回来。

---

### 任务 2：macOS 打包后找不到 `codex`（AI 开箱即坏）

**现状**：[codex.rs](../src-tauri/src/codex.rs) `get_command_candidates` 直接 `Command::new("codex")`。从 Finder/Dock 启动的 GUI 应用 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`，homebrew（`/opt/homebrew/bin`）或 npm 全局安装的 codex 找不到，默认 provider 又是 Codex CLI，报错只有模糊的「请检查 Codex CLI 是否可用」。DESIGN.md 还禁止在 UI 暴露命令路径配置，用户没有自救通道。

**要做**（macOS / Linux）：在 `get_command_candidates` 中，当 command 不含路径分隔符时，除裸命令外追加常见安装位置候选：`/opt/homebrew/bin/{cmd}`、`/usr/local/bin/{cmd}`、`$HOME/.local/bin/{cmd}`、`$HOME/.npm-global/bin/{cmd}`、`$HOME/.volta/bin/{cmd}`、`$HOME/.bun/bin/{cmd}`。更稳的方案是启动时执行一次 `$SHELL -lc 'command -v codex'` 缓存绝对路径（注意超时与失败兜底）。两种方案二选一或叠加，保持 Windows 行为不变。

**验证**：`cargo test --manifest-path src-tauri/Cargo.toml`（已有 candidates 相关单测的话补 macOS case）；真机打包后在设置里点「检测连接」应能找到 codex。

---

### 任务 3：codex 子进程 stdout 不排空，可能死锁到 60s 超时

**现状**：[codex.rs](../src-tauri/src/codex.rs) `run_codex_prompt_generation` 用 `try_wait` 轮询，期间 `stdout/stderr` 都是 piped 但无人读取。codex exec 往 stdout 打的进度/推理一旦超过管道缓冲区（~64KB），子进程写阻塞 → 永远不退出 → 吃满 60s 超时后被 kill。

**要做**：spawn 后 `take()` stdout/stderr，各起一个线程持续读到 `Vec<u8>`（或 `std::io::copy` 到内存），主循环只负责 try_wait + 超时 kill；退出后 join 线程取输出。注意 `--output-last-message` 文件仍是首选输出来源，stdout 只是兜底。

**验证**：`cargo test`；构造一个长输出场景（或临时把 prompt 调成要求模型输出大量文本）确认不再超时。

---

### 任务 4：设置 CSP（当前为 null）

**现状**：[tauri.conf.json](../src-tauri/tauri.conf.json) `"csp": null`。AI 返回文本会进 webview，虽然 React 默认转义，CSP 是该补的纵深防御。

**要做**：设置形如 `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* http://127.0.0.1:* ipc: http://ipc.localhost` 的策略。注意：
- 本地网关探测 `probeLocalGateway` 是 webview 里 `fetch` 直连用户配置的网关地址（不止 localhost，用户可填任意地址），`connect-src` 需要覆盖（可考虑把探测也挪到 Rust `ai_http.rs`，则 connect-src 不必放开 http/https）。
- 字体走 `@fontsource` 本地打包，`font-src 'self'` 即可。
- Tauri v2 会自动注入 IPC 相关来源，但**必须在真机 dev + 打包两种模式验证**所有功能：记录、搜索、AI 检测连接、通知、备份导入导出。

---

### 任务 5：Responses API 模式的参数白名单（需查官方文档）

**现状**：[openai-compatible-provider.ts](../src/features/work-memory/services/ai/openai-compatible-provider.ts) `sendResponsesRequest` 把 `presence_penalty / frequency_penalty` 一并发给 `/v1/responses`。OpenAI 的 Responses API 不接受这两个参数（未知参数会 400）。现有测试（openai-compatible-provider.test.ts 「sends configured OpenAI-compatible request parameters in responses mode」）把该行为锁成了预期，需要一起改。

**要做**：
1. 网上核实 OpenAI `/v1/responses` 当前支持的采样参数（temperature、top_p、`max_output_tokens`；penalties 应不支持）。
2. responses 模式下只发送白名单内参数；chat-completions 模式维持现状。
3. 更新对应测试断言。

---

### 任务 6：Kimi / 各服务商参数与 JSON 模式适配核查（需联网调研）

**现状与疑点**：
- [known-openai-providers.ts](../src/features/work-memory/services/ai/known-openai-providers.ts) 给 Kimi 预设了 `temperature: 1 / topP: 0.95`，hint 说「K2.6 / K2.5 对 temperature 与 top_p 有固定值要求」——核实 Moonshot 官方对 kimi-k2 系列的推荐/强制值，以及其 API 是否有 temperature 范围缩放、`n>1` 限制等历史怪癖。
- `response_format: {type:'json_object'}` 的支持差异：智谱 glm-4-flash、DashScope、火山方舟、硅基流动各自是否支持？不支持时返回 400 还是静默忽略？当前的 400 兜底靠正则 `shouldFallbackResponseFormat` 匹配错误文案，调研后扩充正则，或改为「同一 baseUrl+model 失败一次后记忆降级，不再每次先撞一下」。
- 调研结论直接更新各预设的 `parameters` / `hint`，并把「服务商怪癖」沉淀成 preset 上的结构化字段（见任务 9 的架构建议）。

---

### 任务 7：max_tokens 不可配，长报告可能被截断

**现状**：请求从不发送 max_tokens。部分服务商对输出长度有较小的默认上限（各家不同，需调研），周报这种长 JSON 输出一旦被截断就解析失败，用户只看到「不是有效 JSON」。

**要做**：调研主要预设服务商的默认输出上限；在 `OpenAICompatibleParameters` 增加可选 `maxTokens`（chat-completions 发 `max_tokens`，responses 发 `max_output_tokens`），设置 UI 的「请求参数」加一格，留空不发送。另外在 JSON 解析失败的错误信息里提示「可能是输出被截断，尝试设置 max_tokens 或缩小报告范围」。

---

### 任务 8：Claude / Anthropic 接入（需联网调研）

**现状**：代码已能识别 Anthropic 形状的响应并提示「先通过网关转换」（`isAnthropicContentArray` / `getAnthropicFormatMessage`），但用户无法直接用 Claude。

**要做（两条路线，先调研再选）**：
1. **优先验证**：Anthropic 是否提供官方 OpenAI 兼容端点（`https://api.anthropic.com/v1/chat/completions`，Bearer 鉴权）。若可用且支持 `response_format` 或至少能稳定输出 JSON，则只需在 `openAICompatibleProviderPresets` 加一个 `claude` 预设（含正确 baseUrl、默认模型如 `claude-haiku-4-5`、hint 说明限制），成本最低。
2. 若兼容层限制太多（如不支持 json_object、忽略 system），再考虑原生 Anthropic provider：`/v1/messages`、`x-api-key` + `anthropic-version` 头、`content` 数组响应。架构上仿照 openai-compatible-provider 实现 `AIProvider` 接口即可，`ai_http.rs` 需支持自定义 header。

**调研结论（2026-06-12，官方文档）**：
- Anthropic 提供官方 OpenAI SDK 兼容层，OpenAI SDK 示例使用 `base_url="https://api.anthropic.com/v1/"`，因此 Chat Completions 请求路径是 `https://api.anthropic.com/v1/chat/completions`；header compatibility 表中 `authorization` 为 fully supported，可用 Bearer 鉴权。来源：https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk
- 兼容层定位是“测试和比较模型能力”，官方明确说明不建议作为大多数场景的长期/生产方案；要访问完整 Claude API 能力应使用原生 Claude API。来源同上。
- `system` / `developer` 消息并非按 OpenAI 语义完整保留；兼容层会把所有 system/developer messages 用 `\n` 拼接后作为开头的单个 system message，因为 Anthropic 只支持一个初始 system message。来源同上。
- 采样参数限制：`temperature` 支持 0-1，超过 1 会被 capped 到 1；`top_p` fully supported；`n` 必须为 1；`presence_penalty`、`frequency_penalty`、`logprobs`、`seed` 等字段 ignored，多数不支持字段会静默忽略。来源同上。
- `response_format` 在兼容层中是 ignored；官方写明要做 JSON output 应使用原生 Claude API 的 Structured Outputs。Structured Outputs 文档说明 JSON 输出通过原生 `/v1/messages` 的 `output_config.format` 使用，并保证返回符合 schema 的有效 JSON。来源：https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- 结论：不适合只加 OpenAI-compatible `claude` 预设。Tallya 的整理链路依赖稳定 JSON；Anthropic 兼容层会忽略 `response_format`，只能靠 prompt 约束，不能满足“稳定输出 JSON”。应走原生 Anthropic provider 路线。

---

### 任务 9：AI 兼容架构建议（做完 5-8 后顺手重构）

当前「所有服务商共用一套请求构造 + 错误正则兜底」在服务商增多后会越来越脆。建议把差异声明化，集中在 preset 上：

```ts
type OpenAICompatibleProviderPreset = {
  // ...现有字段
  capabilities?: {
    supportsJsonResponseFormat?: boolean;   // false 则直接跳过 response_format，省一次 400 往返
    parameterWhitelist?: Array<'temperature' | 'topP' | 'presencePenalty' | 'frequencyPenalty' | 'maxTokens'>;
    fixedParameters?: Partial<OpenAICompatibleParameters>; // Kimi 这类强制值，UI 置灰
  };
};
```

原则保持不变：请求侧按能力声明收窄（严出），解析侧维持现在的宽容多形状提取（宽进）。自定义服务商（custom）没有声明就走现状的探测+兜底路径。

---

### 任务 10：Codex CLI 集成的两个隐患（需联网核实）

1. **硬编码 config 覆盖**：[codex.rs](../src-tauri/src/codex.rs) `spawn_codex_cli` 固定传 `-c model_reasoning_effort="low" -c features.fast_mode=true -c service_tier="fast"`。核实这些 key 在当前及较旧 codex 版本中的行为——未知 config key 是否会导致报错退出？若有风险，改为失败后去掉 `-c` 重试一次，或先 `codex --version` 判断版本。
2. **健康检查不验登录态**：`check_codex_cli` 只跑 `--version`，而 `codex exec` 需要登录。检测显示「服务可用」但生成时才失败。建议健康检查改为（或追加）一次最小 exec（如要求输出 `{"ok":true}`，设短超时），失败时提示「Codex 已安装但可能未登录，运行 codex login」。
3. 顺手项：[known-models.ts](../src/features/work-memory/services/ai/known-models.ts) 硬编码 gpt-5.5/5.4 模型清单，确认与当前 codex 支持的模型一致；`DEFAULT_OPENAI_COMPATIBLE_MODEL`（`gpt-5.4-mini`）与 OpenAI 预设 `defaultModel`（`gpt-4o-mini`）不一致，确认意图后统一。

---

### 任务 11：工程遗留（不紧急，攒一次清理）

- **迁移版本化**：`SCHEMA_VERSION` 写入 `user_version` 但从不读取，全靠 CREATE IF NOT EXISTS 幂等。补一个「读 user_version → 跑增量迁移数组 → 写回」的小框架，后续加列才有出路。
- **事务**：`saveAppSettingsRow` 30+ 行逐条 INSERT 无事务；备份恢复同样（代码里已有 TODO）。给 `DatabaseClient` 加 `transaction(fn)` 或至少 BEGIN/COMMIT 包裹。
- **ollama 半成品**：`AIProviderId` 含 `'ollama'`、`OllamaSettings` 已存在，但 provider 未实现，settings 一旦出现该值 `getProviderForSettings` 直接 throw。要么实现（本地优先的产品叙事下很值得），要么先从类型里移除。
- **CI 加 macos-latest**：当前只跑 windows-latest，macOS 专属 Rust 路径（通知、open）平时不编译。
- **死代码**：`constants.ts` 的 `displayDate/displayWeekday/weeklySnapshot/supplementFields`（仅 `today` 曾被使用，现已无人引用整个文件可基本清空）；`report_sources` 表仍是 daily_memory 维度；旧 `daily_memories` 读路径（PLAN 已列）；`LocalStorage*Repository` 系列确认仅测试使用后考虑收缩。
- **搜索性能观察项**：FTS 不可用时 LIKE 回退每键击全表扫，数据量大后可考虑 150ms debounce。

---

## 三、AI 配置链路中做得对的地方（不要在重构中丢掉）

- 错误分流完整：401/403/404/429/5xx 友好文案 + server message 截断附带。
- chat ↔ responses 模式互相误配时能识别并给出「切换接口模式」的精确提示。
- Anthropic 形状检测并引导走网关，而不是甩生硬解析错误。
- Responses SSE 流式聚合解析（delta/done/completed/错误事件全覆盖），还兼容网关把 chat 流伪装进来的情况。
- `response_format` 400 时自动降级重试 + `stripMarkdownFence` 兜底解析。
- 诊断日志对 api key 类字段 redact、响应预览截断。
- 1-2 字 CJK 查询绕开 trigram FTS 直接 LIKE（注释里把原因写清楚了）。
- AI 全程可选、失败不阻塞记录主链路。
