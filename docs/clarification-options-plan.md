# 补充选项化（clarification 预设选项）✅ 已实现

> 2026-06-18 由 Claude 直接实现（非 Codex），typecheck + lint + 454 测试 + cargo check/test 全过；
> 真机验证仍待做（见末尾「验证」）。下文保留为设计记录与改动清单。
> 原为可交给 Codex 的自包含任务文档；来自 thread-continuation-plan.md「暂缓」里认可的方向。

## 目标（一句话）

补充信息时，对**枚举型**追问，让 AI 额外给 1–4 个预设选项（每行最多两个）+ 始终保留自由输入框；
**开放型**追问不给预设。点选项 = 把该选项文本作为答案保存（等价于手填后回车）。

## 硬约束（别破）

- **不污染记忆真实性**：预设只给「答案空间有限、能从真实/常识枚举出来」的问题——时长区间
  （如「半天/1-2天/一周以上」）、是非、从**已知线索名/协作对象**里选之类。**开放型问题
  （难点、原因、思路）一律不给预设**，逼着用户如实写，避免「选个差不多对的」污染。
- **永远保留自由输入**：选项只是省力，不是唯一路径。无选项时行为与现在**完全一致**。
- **不改数据模型**：`Clarification` 仍是 question+answer 两个字符串。选项纯属 UI 与 AI 输出层，
  选中后 answer = 选项文本，`onAdd(question, answer)` 调用不变（见
  [entry-supplement-panel.tsx](../src/features/work-memory/components/entry-supplement-panel.tsx) `submitAnswer`）。
- **向后兼容**：`options` 字段可选；AI 不给或给空就退化成今天的纯问题。
- **fail-open / fail-silent 不变**：AI 失败仍走「纯手动」兜底（panel 的 `unavailable` 态）。

## 数据结构（新增）

[types.ts](../src/features/work-memory/types.ts)（`SuggestClarificationsInput` 附近，line ~76）新增：

```ts
export type ClarificationPrompt = {
  question: string;
  // 0 个 = 开放型（只给自由输入）；1–4 个 = 枚举型预设。来自真实/有限答案空间，不得编造。
  options: string[];
};
```

把 `suggestClarifications` 的返回从 `string[]` 全链路改成 `ClarificationPrompt[]`。

## 改动点（按层，含 file:line 锚点）

### 1. AI 接口与服务
- [ai-provider.ts:80](../src/features/work-memory/services/ai/ai-provider.ts) `suggestClarifications?` 返回
  `Promise<ClarificationPrompt[]>`（import 新类型）。
- [ai-service.ts:223](../src/features/work-memory/services/ai/ai-service.ts) `suggestClarifications`
  返回类型同步改 `Promise<ClarificationPrompt[]>`（透传，无逻辑变化）。

### 2. OpenAI Compatible（含 prompt/parser，是各 provider 共用的 prompt 源）
- [openai-format.ts:90](../src/features/work-memory/services/ai/openai-format.ts) `buildClarificationsPrompt`：
  - JSON 形状改为 `{ questions: [{ question: string, options?: string[] }] }`。
  - 加要求：「**只有枚举型问题**（时长区间、是否、从给定线索名/协作对象里选等）才给 1–4 个 `options`，
    每个≤8字、互斥、来自真实或常识可枚举的答案空间；**开放型问题 options 必须为空数组**；
    选项不是为了凑数，宁缺毋滥；不得编造具体事实当选项。」
- [openai-format.ts:105](../src/features/work-memory/services/ai/openai-format.ts) `parseSuggestedClarifications`
  → 返回 `ClarificationPrompt[]`：每项取 `question`（非空 trim）、`options`（normalizeStringList +
  去空去重 + `.slice(0, MAX_CLARIFICATION_OPTIONS)`）。问题数仍 `.slice(0, MAX_CLARIFICATION_QUESTIONS)`。
  新增 `const MAX_CLARIFICATION_OPTIONS = 4;`（line 20 旁）。
- [openai-compatible-provider.ts:529](../src/features/work-memory/services/ai/openai-compatible-provider.ts)：
  签名靠 parser 自动带出，通常无需改（确认类型推断通过）。

### 3. Anthropic（结构化输出 schema）
- [anthropic-provider.ts:102](../src/features/work-memory/services/ai/anthropic-provider.ts) `clarificationsSchema`：
  `questions` 从 `stringArraySchema` 改为「对象数组」——每项 `{ question: string, options: string[] }`。
  看 `objectSchema` / `stringArraySchema` 的现有定义，若没有「对象数组」helper 就照它们的写法加一个
  （`{ type: 'array', items: objectSchema({ question:{type:'string'}, options: stringArraySchema }, ['question']) }`）。
  required 里 `question` 必填、`options` 可选。
- 解析仍复用 `parseSuggestedClarifications`（line 297），改完 parser 即自动适配。

### 4. Codex CLI（Rust + TS 桥）
- [codex.rs:128](../src-tauri/src/codex.rs) `SuggestedClarifications`：`questions: Vec<String>` 改为
  `Vec<ClarificationPrompt>`，新增 `struct ClarificationPrompt { question: String, #[serde(default)] options: Vec<String> }`
  （`#[serde(rename_all = "camelCase")]`，与 TS 对齐）。
- [codex.rs:1098](../src-tauri/src/codex.rs) `build_codex_clarifications_prompt`：同步 §2 的 prompt 文案与 JSON 形状。
- [codex.rs:1889](../src-tauri/src/codex.rs) `parse_suggested_clarifications` → 返回
  `Vec<ClarificationPrompt>`：trim 问题、clamp options 到 4、丢空、问题数 clamp 2。
- `run_codex_clarifications`（line 432）与命令 `suggest_clarifications_with_codex`（line 341）返回类型
  改 `Vec<ClarificationPrompt>`。
- [codex-cli-provider.ts](../src/features/work-memory/services/ai/codex-cli-provider.ts) 里 `suggestClarifications`
  把 invoke 结果映射为 `ClarificationPrompt[]`（字段名 camelCase 已对齐，注意 options 缺省给 `[]`）。

### 5. UI 与控制器
- [use-entries-controller.ts:389](../src/features/work-memory/hooks/use-entries-controller.ts) `suggestQuestions`
  返回 `Promise<ClarificationPrompt[]>`（透传）。
- [entry-supplement-panel.tsx](../src/features/work-memory/components/entry-supplement-panel.tsx)：
  - `onSuggest` 改 `(content: string) => Promise<ClarificationPrompt[]>`，`questions` state 改
    `ClarificationPrompt[]`。
  - 每个问题渲染：问题文案下方，若 `options.length > 0` 渲染选项 chips（**每行最多两个**，
    用 grid `grid-cols-2`），点 chip 即 `onAdd(question, optionText)` 并从列表移除该问题（复用
    `submitAnswer` 的成功后移除逻辑）；chips 下方仍保留自由输入 textarea（现有交互不变）。
  - 选项按钮样式参照仓库现有 Button `size="xs"` / ghost；保持克制、不抢眼。
- 上游透传链 [work-memory-home.tsx](../src/features/work-memory/work-memory-home.tsx)
  `onSuggestQuestions={entries.suggestQuestions}` → EntryFeed → entry-feed-item → panel，类型自然流过，
  通常只需类型对齐。

### 6. 测试
- [openai-format] clarifications parser 测试：补「带 options / options 超 4 截断 / 开放型 options 为空 /
  非法 JSON 抛错」用例。
- [codex.rs] `parse_suggested_clarifications_trims_caps_and_tolerates_empty`（line 1427）：更新为新结构，
  补 options 用例。
- ai-service / 其他用到 `suggestClarifications` 返回值的测试：把 `string[]` 期望改成 `ClarificationPrompt[]`。
- panel 若有测试则更新；可加一条「点选项即以选项文本保存」。

## 验证

```bash
fnm use 22
pnpm typecheck && pnpm lint && pnpm test
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

真机（Codex 不便跑，留给用户）：配好 AI → 记一条含「卡了一阵/和谁协作」类的记录 → 点「补充」→
枚举型问题出现 1–4 个选项（每行≤2）、点一下即存为该 entry 的 clarification；开放型问题只有自由输入；
无 AI 时 panel 退化为纯手动，不报错。

## 范围外（别做）

- 不动 `Clarification` 表 / 持久化结构。
- 不给开放型问题硬塞选项。
- 不引入「多选」；点一个选项 = 一条答案（要多条就多次点/手填）。
