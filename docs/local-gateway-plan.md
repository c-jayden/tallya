# 实现规格：本地 AI 网关模式（cc-switch / codex-proxy 兼容）

> 给实现者（Codex）的精确规格。**严格按本文做，不要扩大范围。** 不清楚的先做"第 0 步验证"，不要靠猜写死。

## 背景（为什么做）

Tallya 现在默认用本机 Codex CLI（spawn 子进程）做 AI 生成，冷启动慢。用户希望：装了本地 AI 网关（cc-switch 默认 `http://localhost:8080`，或 codex-proxy 默认 `http://localhost:8787`）时走 HTTP（快、复用 ChatGPT 订阅、绕开 Cloudflare），**没装时继续走 Codex CLI spawn**，自动区分。

**网关把脏活（Cloudflare 指纹、token 刷新、Responses↔ChatCompletions 转换）都扛了**，所以 Tallya 这边只是"把现有的 OpenAI Compatible provider 指向本地网关"，**纯前端改动**。

## 第 0 步：必须先验证（不要跳过）

本机起一个网关（cc-switch 开本地代理，或 `codex-proxy serve`），用 curl 确认它到底接受什么：

```bash
curl -s http://localhost:8080/v1/models            # cc-switch 默认端口
curl -s http://localhost:8787/v1/models            # codex-proxy 默认端口
curl -s http://localhost:<port>/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"<model>","messages":[{"role":"user","content":"只回 ok"}]}'
```

- 确认：哪个端口、是否接受 OpenAI **Chat Completions**(`/v1/chat/completions`)、`/v1/models` 是否可用、是否要 API key。
- **codex-proxy 已知是 OpenAI 兼容的；cc-switch 的 :8080 若不接受任意 chat/completions，就以 codex-proxy 为准、并在文案里写清"推荐 codex-proxy 或 cc-switch 开放兼容端点"。**
- 把验证结论写进 PR 描述。**探测实现要匹配实际可用的那个端点，不要照搬本文示例路径。**

## 设计决策（实现契约）

1. **复用现有 `openai-compatible` provider**，不要新增 provider 类型、不要碰 Rust、不要直接请求 `chatgpt.com` 后端。
2. 新增一个**「本地网关」开关**（默认开启），含可配置 `baseUrl`(默认 `http://localhost:8080`)、`apiMode`、`model`。
3. **路由行为**：开关开启时，启动/设置变更时探测网关；
   - 探测**成功** → 所有 AI 调用改走 `openAICompatibleProvider` + 网关配置（apiKey 用占位串，如 `local-gateway`，网关会忽略）。
   - 探测**失败**（没装/没开/超时）→ **回退到用户当前选择的 provider**（默认 Codex CLI spawn），行为与现状完全一致。
   - 开关关闭 → 完全现状，永不探测。
4. 探测结果**缓存**（建议 60s 或直到设置变更/手动重测），不要每次 AI 调用都探测。
5. 失败回退要**静默**（不弹错误 toast）；仅在设置页的"检测"按钮里显示明确状态。

## 不要做（护栏）

- ❌ 不直接请求 `https://chatgpt.com/backend-api/codex/responses`（CF 墙 + 要冒充官方指纹，已否决）。
- ❌ 不新增 Rust 命令、不改 `src-tauri`。本功能纯前端。
- ❌ 不删除/破坏现有 Codex CLI spawn 路径，它是回退。
- ❌ 不新增 AI provider id；复用 `openai-compatible`。
- ❌ 不联网上报、不动记录/检索/报告主线。
- ❌ 探测不要只看"端口通不通"，要校验返回像 OpenAI 兼容(2xx + JSON)，避免把无关服务误判成网关。

## 具体实现步骤（按文件）

### 1. 设置类型与默认值
`src/features/work-memory/services/app-settings-repository.ts`：在 `AppSettings` 加
```ts
localGateway: {
  enabled: boolean;        // 默认 true
  baseUrl: string;         // 默认 'http://localhost:8080'
  apiMode: OpenAICompatibleApiMode; // 默认 'chat-completions'，按第 0 步结论定
  model: string;           // 默认 ''，用户填（cc-switch/codex-proxy 的模型名）
}
```
在 `DEFAULT_APP_SETTINGS` 给默认值；确保读取旧设置时缺该字段能合并默认（现有 settings 合并逻辑照搬）。

### 2. 探测服务（新文件）
`src/features/work-memory/services/ai/local-gateway.ts`：
```ts
export type GatewayProbeResult = { reachable: boolean; detail?: string };
// 用可注入的 fetchImpl（便于测试）；AbortController 超时 ~1500ms。
// 探测：GET `${normalizeBaseUrl(baseUrl)}/models`（复用 normalizeOpenAICompatibleBaseUrl）
//   2xx 视为 reachable；否则 false。网络错误/超时 -> false（不抛）。
export async function probeLocalGateway(baseUrl: string, fetchImpl?: typeof fetch): Promise<GatewayProbeResult>
```
（路径按第 0 步实际结论调整。）

### 3. 路由逻辑
`src/features/work-memory/services/ai/ai-service.ts`：
- 加一个内部 `resolveProvider(settings)`：若 `settings.localGateway.enabled` 且**缓存的探测结果为 reachable**，返回 `{ provider: openAICompatibleProvider, options: gatewayOptions(settings) }`；否则返回现有 `getProviderForSettings(...)` 的结果。
- `gatewayOptions(settings)` 构造 `AIProviderOptions.openAICompatible = { baseUrl: localGateway.baseUrl, apiKey: 'local-gateway', model: localGateway.model, apiMode: localGateway.apiMode }`。
- 探测缓存：模块级 `{ ts, baseUrl, reachable }`，超 60s 或 baseUrl 变化则重探。**首次调用若无缓存：先探测一次再路由。**
- 所有现有方法（generateDailyMemory / generateRangeReport / suggestClarifications / suggestThreadLink / suggestReportGaps / analyzeReportStyle / checkHealth）统一改用 `resolveProvider`。
- **运行期兜底**：网关路径抛错（连不上/4xx/5xx）时，捕获并**自动回退**到 `getProviderForSettings` 再试一次；标记缓存 unreachable。保证"网关挂了也能继续用 Codex"。

### 4. 设置页 UI
`src/features/work-memory/components/settings/ai-settings-section.tsx`（遵守 DESIGN.md 轻量风格）：
- 在 AI 配置区加一组「本地 AI 网关」：开关(Switch) + Base URL(Input) + 模型(Input) + 接口模式(沿用现有 segmented) + 「检测」按钮 + 状态行（复用 `StatusLine`/health 模式：未检测/可用/不可用）。
- 状态文案靠近按钮，明确：`检测到网关，可用`/`未检测到本地网关，将使用 Codex CLI`。
- 设置走 `onUpdateSettings`，不要在组件里直接读写存储。

### 5. 注解文案（中文，克制、清楚，遵守 DESIGN/AGENTS 文案规则）
在该组下放说明，覆盖：
- 没装网关：继续用 Codex CLI（spawn），无需任何操作。
- 装了网关(cc-switch 开本地代理 / 运行 codex-proxy)并填好 Base URL：AI 调用走 HTTP，更快、复用 ChatGPT 订阅额度。
- 一句风险提示：经本地网关复用 ChatGPT 订阅属非官方用法，可能违反对应服务条款，请自行评估（参考 docs/PLAN.md 的相关说明）。
- 不要把文案写成催促/营销口吻。

### 6. 测试
- `local-gateway.test.ts`：注入假 fetch，覆盖 2xx→reachable、超时/网络错→false、非 2xx→false。
- `ai-service` 路由测试：注入假 provider + 假探测，验证"网关可用→走 openAICompatible""不可用/关闭→走原 provider""网关抛错→回退原 provider"。
- 复用现有测试风格（vitest，依赖注入，`__tests__` 目录）。

## 验收（DoD）

- `fnm use 22 && pnpm typecheck && pnpm lint && pnpm test` 全绿（**测试必须用 Node 22**，否则 setup 阶段会挂）。
- 不动 `src-tauri`（无需 cargo）。
- 手动：开关关闭=现状；开启且本机无网关=自动回退 Codex CLI、无报错；开启且 codex-proxy 运行=AI 走 HTTP 成功。
- 设置页有开关/URL/模型/检测/状态/注解，符合 DESIGN.md 轻量风格。

## 关键不确定点（实现者必须确认，别想当然）

1. cc-switch 的 :8080 是否接受任意 OpenAI Chat Completions 请求；不确定就以 **codex-proxy(:8787)** 为主推、cc-switch 作为"若开放兼容端点则同样可用"。
2. 探测路径（`/v1/models` vs 一次最小 chat/completions）以第 0 步实测为准。
3. Tauri webview 里 renderer `fetch` 打 `localhost` 是否受 CORS 限制——现有 OpenAI Compatible provider 已用 renderer fetch 打外部 API 且能用，localhost 应同样可用；若遇 CORS，记录现象并反馈（可能需走 Rust 端 fetch，但**先不要擅自加 Rust**，回来再议）。
