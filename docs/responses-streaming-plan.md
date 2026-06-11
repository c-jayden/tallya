# Responses API 流式支持改造方案

> 给 Codex 的实现说明。目标：让 `openai-compatible` provider 的 **Responses 模式** 支持 `stream: true` + SSE 解析，以兼容「强制流式」的 codex 中转网关。

## 背景与根因（来自真实日志）

某网关 `https://ai.ebonyhi999.com/v1`：

1. **Chat Completions 模式** → HTTP 500，`codex channel: only /v1/responses and /v1/responses/compact are supported`。即该网关只认 `/v1/responses`，Chat 路径不可用。
2. **Responses 模式（当前非流式）** → HTTP 400，`Stream must be set to tr...`（即 `Stream must be set to true`）。即 `/responses` 强制要求 `stream: true`。

当前代码 [`src/features/work-memory/services/ai/openai-compatible-provider.ts`](../src/features/work-memory/services/ai/openai-compatible-provider.ts) 的 `sendResponsesRequest` 发送的是**非流式**请求体（无 `stream` 字段），且用 `response.text()` 一次性读完后 `JSON.parse`。两端不匹配 → 400。

**结论**：必须给 Responses 路径加流式请求 + SSE 响应解析。

## 目标与范围

- **仅改 Responses 模式**（`apiMode === 'responses'`）。Chat Completions 模式不动（该网关本就不支持 chat，加 chat 流式对本场景无意义，留作后续）。
- **不引入新的 UI 配置项**。采用「Responses 模式始终发 `stream: true`，再按响应实际形态（SSE 或 JSON）自适应解析」的策略，这样：
  - 强制流式的网关 → 走 SSE 分支；
  - 仍返回普通 JSON 的网关/官方接口 → 走原 JSON 分支（保持现有行为，不破坏现有测试）。
- 不需要逐字符实时回显（Tallya 这里是「整段 JSON 生成」批处理场景），所以**继续用 `response.text()` 一次性拿到完整 SSE 文本再重组**，无需 `ReadableStream` 增量读取，改动面最小。

## 改动清单

全部集中在 `openai-compatible-provider.ts`（生产代码）+ `__tests__/openai-compatible-provider.test.ts`（测试）。

### 1. `sendResponsesRequest`：请求体加 `stream: true`

定位 `sendResponsesRequest`（约 L225）的 `requestBody`：

```ts
// 改为：
const requestBody = {
  model: config.model,
  input: buildResponsesInput(prompt),
  temperature: 0.2,
  stream: true, // codex 中转网关强制要求；普通网关也兼容（见 parseResponsesAttempt 的自适应解析）
};
```

同时把该函数里 `request_start` 的 debug 日志 metadata 补一个 `stream: true` 字段（便于以后排查）：

```ts
logger.debug('ai', 'openai-compatible.request_start', 'OpenAI Compatible request started', {
  provider: OPENAI_COMPATIBLE_PROVIDER_ID,
  normalizedBaseUrl: config.normalizedBaseUrl,
  model: config.model,
  apiMode: config.apiMode,
  stream: true,
  hasApiKey: Boolean(config.apiKey),
});
```

> `sendResponsesRequest` 其余逻辑（`response.text()`、返回 `{ok,status,contentType,bodyText,serverMessage}`）**保持不变**。SSE 整段文本同样能被 `response.text()` 读出。

### 2. `parseResponsesAttempt`：增加 SSE 自适应分支

定位 `parseResponsesAttempt`（约 L378）。在 `!attempt.ok` 的错误分支之后、`JSON.parse(attempt.bodyText)` 之前，插入 SSE 检测分支：

```ts
function parseResponsesAttempt(
  attempt: Awaited<ReturnType<typeof sendResponsesRequest>>,
  config: OpenAICompatibleConfig,
) {
  if (!attempt.ok) {
    // ...保持原样（server_error 诊断 + 抛 AIProviderError）...
  }

  // 流式响应以 SSE 返回，先重组成纯文本再交给原有解析逻辑。
  if (isResponsesEventStream(attempt.contentType, attempt.bodyText)) {
    try {
      return parseResponsesEventStream(attempt.bodyText);
    } catch (error) {
      logOpenAIDiagnostic('openai-compatible.response_parse_failed', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: false,
        detectedShape: 'responses-sse',
      });

      throw error instanceof AIProviderError
        ? error
        : new AIProviderError(
            '当前服务返回的流式数据无法解析，请检查接口模式或模型。',
            OPENAI_COMPATIBLE_PROVIDER_ID,
            error,
          );
    }
  }

  // ...以下保持原样：JSON.parse + extractResponsesModelText...
}
```

### 3. 新增辅助函数（放在文件靠近 `extractResponsesModelText` 处）

```ts
function isResponsesEventStream(contentType: string, bodyText: string) {
  return (
    /text\/event-stream/i.test(contentType) ||
    /^\s*(event:|data:)/m.test(bodyText)
  );
}

// 把 OpenAI Responses 的 SSE 流重组成最终文本。
// 仅做整段重组（非实时回显），失败时抛 AIProviderError。
function parseResponsesEventStream(bodyText: string): string {
  const deltas: string[] = [];
  const chatDeltas: string[] = [];
  let doneText = '';
  let finalResponse: unknown = null;

  for (const rawEvent of splitSSEEvents(bodyText)) {
    const dataPayload = extractSSEData(rawEvent);

    if (!dataPayload || dataPayload === '[DONE]') {
      continue;
    }

    let evt: unknown;
    try {
      evt = JSON.parse(dataPayload);
    } catch {
      continue; // 容忍非 JSON 的心跳/注释行
    }

    if (!isRecord(evt)) {
      continue;
    }

    const type = typeof evt.type === 'string' ? evt.type : '';

    // 错误事件：直接抛出网关给的 message。
    if (type === 'error' || type === 'response.failed' || type === 'response.error' || isRecord(evt.error)) {
      const message =
        (isRecord(evt.error) && typeof evt.error.message === 'string' && evt.error.message) ||
        (isRecord(evt.response) &&
          isRecord(evt.response.error) &&
          typeof evt.response.error.message === 'string' &&
          evt.response.error.message) ||
        '流式响应返回了错误。';
      throw new AIProviderError(
        truncate(String(message), SERVER_MESSAGE_LIMIT),
        OPENAI_COMPATIBLE_PROVIDER_ID,
      );
    }

    // 标准 Responses 增量文本。
    if (type === 'response.output_text.delta' && typeof evt.delta === 'string') {
      deltas.push(evt.delta);
      continue;
    }

    // 标准 Responses 完整文本（done 事件）。
    if (type === 'response.output_text.done' && typeof evt.text === 'string') {
      doneText = evt.text;
      continue;
    }

    // 完成事件：保留完整 response 对象作为兜底。
    if ((type === 'response.completed' || type === 'response.incomplete') && isRecord(evt.response)) {
      finalResponse = evt.response;
      continue;
    }

    // 兜底：事件对象本身就是一个 Responses 结果（含 output / output_text）。
    if ('output' in evt || 'output_text' in evt) {
      finalResponse = evt;
    }

    // 代理兼容：有些中转把 chat-completions 风格的 chunk 塞进 SSE。
    const chatChunk = extractChatStreamDelta(evt);
    if (chatChunk) {
      chatDeltas.push(chatChunk);
    }
  }

  // 取最完整的一种：done 全文 > 累积增量 > 完整 response 对象 > chat 风格增量。
  if (doneText.trim()) {
    return doneText.trim();
  }
  if (deltas.length > 0) {
    return deltas.join('').trim();
  }
  if (finalResponse) {
    return extractResponsesModelText(finalResponse); // 复用已有提取逻辑
  }
  if (chatDeltas.length > 0) {
    return chatDeltas.join('').trim();
  }

  throw new AIProviderError(
    '当前服务返回的流式数据为空或不含可用文本，请检查接口模式或模型。',
    OPENAI_COMPATIBLE_PROVIDER_ID,
  );
}

// 把 SSE 文本按空行切成事件块。
function splitSSEEvents(bodyText: string): string[] {
  return bodyText.split(/\r?\n\r?\n/);
}

// 从一个事件块里取出 data: 后面的内容（可能跨多行 data:）。
function extractSSEData(rawEvent: string): string {
  const dataLines: string[] = [];
  for (const line of rawEvent.split(/\r?\n/)) {
    const match = /^data:\s?(.*)$/.exec(line);
    if (match) {
      dataLines.push(match[1]);
    }
  }
  return dataLines.join('\n').trim();
}

// 提取 chat-completions 流式 chunk 的增量文本（代理兼容用）。
function extractChatStreamDelta(evt: Record<string, unknown>): string {
  const choices = evt.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }
  const first = choices[0];
  if (!isRecord(first)) {
    return '';
  }
  if (isRecord(first.delta) && typeof first.delta.content === 'string') {
    return first.delta.content;
  }
  if (isRecord(first.message) && typeof first.message.content === 'string') {
    return first.message.content;
  }
  return '';
}
```

> 复用文件内已有的 `isRecord`、`truncate`、`SERVER_MESSAGE_LIMIT`、`extractResponsesModelText`、`AIProviderError`、`OPENAI_COMPATIBLE_PROVIDER_ID`、`logOpenAIDiagnostic`，无需新增 import。

## 测试改动（`__tests__/openai-compatible-provider.test.ts`）

### A. 新增一个 SSE Response 工厂

放到文件底部工厂区（`responsesOutputTextResponse` 旁边）：

```ts
function responsesStreamResponse(content: unknown, status = 200) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  // 把整段文本拆成两个 delta，再补一个 completed 事件，模拟真实 SSE。
  const mid = Math.ceil(text.length / 2);
  const body =
    `event: response.output_text.delta\n` +
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text.slice(0, mid) })}\n\n` +
    `event: response.output_text.delta\n` +
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text.slice(mid) })}\n\n` +
    `event: response.completed\n` +
    `data: ${JSON.stringify({ type: 'response.completed', response: { output_text: text } })}\n\n` +
    `data: [DONE]\n\n`;
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}
```

### B. 新增用例

```ts
it('reassembles streamed Responses SSE into model output', async () => {
  const fetch = vi.fn().mockResolvedValue(responsesStreamResponse(dailyMemoryPayload()));
  const provider = createOpenAICompatibleProvider(fetch);

  await expect(provider.generateDailyMemory(dailyInput, responsesOptions)).resolves.toMatchObject({
    summary: '整理需求并同步计划。',
  });
});

it('sends stream:true in responses mode', async () => {
  const fetch = vi.fn().mockResolvedValue(responsesStreamResponse(dailyMemoryPayload()));
  const provider = createOpenAICompatibleProvider(fetch);

  await provider.generateDailyMemory(dailyInput, responsesOptions);

  const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
  expect(body).toMatchObject({ stream: true });
});

it('throws a friendly error when the SSE stream carries an error event', async () => {
  const body =
    `data: ${JSON.stringify({ type: 'error', error: { message: 'quota exceeded' } })}\n\n`;
  const fetch = vi.fn().mockResolvedValue(
    new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  );
  const provider = createOpenAICompatibleProvider(fetch);

  await expect(provider.generateDailyMemory(dailyInput, responsesOptions)).rejects.toMatchObject({
    message: expect.stringContaining('quota exceeded'),
  });
});
```

### C. 现有 Responses 用例无需改

- 现有用 `responsesOutputTextResponse(...)`（`application/json`）的用例会走 **非 SSE 的 JSON 分支**，行为不变，应继续通过。
- L99 那条「sends responses requests to the normalized URL」断言用了 `toMatchObject({ model, temperature: 0.2 })`（子集匹配），加了 `stream: true` 也不影响；可顺手补一行 `expect(responsesBody).toMatchObject({ stream: true });`。

## 验证

> ⚠️ **本机 Node 必须 ≥ 22 才能跑测试**（`src/test/setup.ts` 用到全局 `navigator`，Node 20 没有）。本仓库 CI 用 Node 22。若用 fnm：`fnm use 22`（或 `eval "$(fnm env)" && fnm use 22.17.1`）。

```bash
pnpm typecheck
pnpm vitest run src/features/work-memory/services/ai/__tests__/openai-compatible-provider.test.ts
pnpm lint
pnpm test   # 跑全量确认无回归
```

## 决策记录与风险

1. **始终发 `stream: true`（不加开关）**：靠响应 `content-type`/正文形态自适应解析，对官方/普通网关无副作用（它们要么返回 SSE 能解析、要么返回 JSON 走原路）。若日后发现某些 Responses 网关既不支持流式也不返回 JSON 错误，再考虑加 provider 级 `stream` 配置。
2. **不做实时增量回显**：本场景是整段 JSON 批处理，`response.text()` 整段读取后重组即可，避免 `ReadableStream` 增量读取的复杂度。
3. **超时覆盖范围**：现有 `fetchWithTimeout` 在 fetch resolve（收到响应头）后即清除 45s 定时器，**流式 body 读取阶段不在超时保护内**。短输出可接受。可选硬化：把超时改成覆盖到 `response.text()` 读取完成（如在读取期间不 clear 定时器，或对 body 读取单独设超时）——非必须，列为后续优化。
4. **Chat 模式不动**：本网关不支持 chat。若以后遇到「chat 也强制流式」的网关，可按同样思路给 `sendChatCompletion` 加 `stream: true` + 复用 `parseResponsesEventStream` 的 chat 分支，另开任务。
5. **灰产网关风险（与本改造无关，但提醒）**：`ai.ebonyhi999.com` / `gpt-5.5` 是二手中转，用户数据经其转发，隐私与稳定性自负。改造只解决「连得上」，不背书该网关。
