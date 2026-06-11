import { logger } from '../logger/logger';
import {
  buildClarificationsPrompt,
  buildDailyMemoryPrompt,
  buildRangeReportPrompt,
  buildReportGapsPrompt,
  buildReportStyleAnalysisPrompt,
  buildThreadLinkPrompt,
  parseAnalyzedReportStyle,
  parseGeneratedDailyMemory,
  parseGeneratedRangeReport,
  parseReportGaps,
  parseStrictJSON,
  parseSuggestedClarifications,
  parseThreadLinkSuggestion,
} from './openai-format';
import {
  AIProviderError,
  type AIProvider,
  type AIProviderOptions,
  type OpenAICompatibleApiMode,
} from './ai-provider';

const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible';
const OPENAI_COMPATIBLE_REQUEST_TIMEOUT_MS = 45_000;
const API_VERSION_PATH = '/v1';
const CHAT_COMPLETIONS_PATH = '/chat/completions';
const RESPONSES_PATH = '/responses';
const RESPONSE_BODY_PREVIEW_LIMIT = 500;
const SERVER_MESSAGE_LIMIT = 160;
const STRICT_JSON_SYSTEM_PROMPT =
  '你是 Tallya 的工作记忆整理助手。只输出合法 JSON，不要输出 markdown code fence、解释或额外文字。';

type FetchLike = typeof fetch;

type OpenAICompatibleConfig = {
  baseUrl: string;
  normalizedBaseUrl: string;
  apiKey: string;
  model: string;
  apiMode: OpenAICompatibleApiMode;
};

type ChatRequestOptions = {
  strictJsonMode: boolean;
};

export function normalizeOpenAICompatibleBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');

  if (!normalized) {
    return '';
  }

  // Only append /v1 when the URL has no version segment yet. Providers like
  // Zhipu (/api/paas/v4) or Volcengine (/api/v3) already carry their version.
  return /\/v\d+$/i.test(normalized) ? normalized : `${normalized}${API_VERSION_PATH}`;
}

export function createOpenAICompatibleProvider(fetchImpl: FetchLike = fetch): AIProvider {
  async function requestJSON<T>(
    options: AIProviderOptions,
    prompt: string,
    parseOutput: (rawOutput: string) => T,
  ) {
    const config = getOpenAICompatibleConfig(options);
    const content = await requestModelText(config, prompt, { strictJsonMode: true });

    try {
      return parseOutput(content);
    } catch (error) {
      logger.error('ai', 'openai-compatible.json_parse_failed', 'AI output JSON parse failed', {
        provider: OPENAI_COMPATIBLE_PROVIDER_ID,
        model: config.model,
        outputPreview: content,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(
        error instanceof Error
          ? error.message
          : '服务返回内容不是有效 JSON，请尝试更换模型或关闭严格 JSON 模式。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }
  }

  async function requestModelText(
    config: OpenAICompatibleConfig,
    prompt: string,
    requestOptions: ChatRequestOptions,
  ): Promise<string> {
    if (config.apiMode === 'responses') {
      const attempt = await sendResponsesRequest(config, prompt);

      return parseResponsesAttempt(attempt, config);
    }

    const firstAttempt = await sendChatCompletion(config, prompt, requestOptions);

    if (
      firstAttempt.status === 400 &&
      requestOptions.strictJsonMode &&
      !isChatModeResponsesOnlyError(firstAttempt.serverMessage ?? firstAttempt.bodyText) &&
      shouldFallbackResponseFormat(firstAttempt.serverMessage ?? firstAttempt.bodyText)
    ) {
      logOpenAIDiagnostic('openai-compatible.response_format_fallback', {
        config,
        httpStatus: firstAttempt.status,
        contentType: firstAttempt.contentType,
        errorMessage: firstAttempt.serverMessage,
        responseBody: firstAttempt.bodyText,
        responseFormatFallbackUsed: true,
      });

      const fallbackAttempt = await sendChatCompletion(config, prompt, {
        strictJsonMode: false,
      });

      return parseChatCompletionAttempt(fallbackAttempt, config, {
        responseFormatFallbackUsed: true,
      });
    }

    return parseChatCompletionAttempt(firstAttempt, config, {
      responseFormatFallbackUsed: false,
    });
  }

  async function sendChatCompletion(
    config: OpenAICompatibleConfig,
    prompt: string,
    requestOptions: ChatRequestOptions,
  ) {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: STRICT_JSON_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    };

    if (requestOptions.strictJsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    let response: Response;

    try {
      logger.debug('ai', 'openai-compatible.request_start', 'OpenAI Compatible request started', {
        provider: OPENAI_COMPATIBLE_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        apiMode: config.apiMode,
        strictJsonMode: requestOptions.strictJsonMode,
        hasApiKey: Boolean(config.apiKey),
      });
      response = await fetchWithTimeout(toChatCompletionsUrl(config.normalizedBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      logger.error('ai', 'openai-compatible.network_failed', 'OpenAI Compatible request failed', {
        provider: OPENAI_COMPATIBLE_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        apiMode: config.apiMode,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      logOpenAIDiagnostic('openai-compatible.network_failed', {
        config,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw new AIProviderError(
        isAbortError(error)
          ? 'AI 服务响应超时，请检查网关或稍后再试。'
          : '无法连接到 AI 服务，请检查 Base URL 或网络。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }

    const bodyText = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    const serverMessage = extractServerErrorMessage(bodyText);

    logger.debug('ai', 'openai-compatible.response_received', 'OpenAI Compatible response received', {
      provider: OPENAI_COMPATIBLE_PROVIDER_ID,
      normalizedBaseUrl: config.normalizedBaseUrl,
      model: config.model,
      apiMode: config.apiMode,
      status: response.status,
      contentType,
      bodyPreview: buildSafeResponsePreview(bodyText),
      responseFormatFallbackUsed: !requestOptions.strictJsonMode,
    });

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      bodyText,
      serverMessage,
    };
  }

  async function sendResponsesRequest(config: OpenAICompatibleConfig, prompt: string) {
    const requestBody = {
      model: config.model,
      input: buildResponsesInput(prompt),
      temperature: 0.2,
    };

    let response: Response;

    try {
      logger.debug('ai', 'openai-compatible.request_start', 'OpenAI Compatible request started', {
        provider: OPENAI_COMPATIBLE_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        apiMode: config.apiMode,
        hasApiKey: Boolean(config.apiKey),
      });
      response = await fetchWithTimeout(toResponsesUrl(config.normalizedBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      logger.error('ai', 'openai-compatible.network_failed', 'OpenAI Compatible request failed', {
        provider: OPENAI_COMPATIBLE_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        apiMode: config.apiMode,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      logOpenAIDiagnostic('openai-compatible.network_failed', {
        config,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw new AIProviderError(
        isAbortError(error)
          ? 'AI 服务响应超时，请检查网关或稍后再试。'
          : '无法连接到 AI 服务，请检查 Base URL 或网络。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }

    const bodyText = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    const serverMessage = extractServerErrorMessage(bodyText);

    logger.debug('ai', 'openai-compatible.response_received', 'OpenAI Compatible response received', {
      provider: OPENAI_COMPATIBLE_PROVIDER_ID,
      normalizedBaseUrl: config.normalizedBaseUrl,
      model: config.model,
      apiMode: config.apiMode,
      status: response.status,
      contentType,
      bodyPreview: buildSafeResponsePreview(bodyText),
    });

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      bodyText,
      serverMessage,
    };
  }

  async function fetchWithTimeout(url: string, init: RequestInit) {
    const abortController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      abortController.abort();
    }, OPENAI_COMPATIBLE_REQUEST_TIMEOUT_MS);

    try {
      return await fetchImpl(url, {
        ...init,
        signal: abortController.signal,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  function parseChatCompletionAttempt(
    attempt: Awaited<ReturnType<typeof sendChatCompletion>>,
    config: OpenAICompatibleConfig,
    diagnosticOptions: { responseFormatFallbackUsed: boolean },
  ) {
    if (!attempt.ok) {
      logOpenAIDiagnostic('openai-compatible.server_error', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: attempt.serverMessage,
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: diagnosticOptions.responseFormatFallbackUsed,
      });

      throw new AIProviderError(
        buildFriendlyHTTPError(attempt.status, attempt.serverMessage, config.apiMode),
        OPENAI_COMPATIBLE_PROVIDER_ID,
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(attempt.bodyText);
    } catch (error) {
      logOpenAIDiagnostic('openai-compatible.response_parse_failed', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: diagnosticOptions.responseFormatFallbackUsed,
        detectedShape: 'unknown',
      });

      throw new AIProviderError(
        'AI 服务响应不是有效 JSON，请检查服务是否兼容 OpenAI Chat Completions。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }

    try {
      return extractModelText(payload);
    } catch (error) {
      logOpenAIDiagnostic('openai-compatible.response_parse_failed', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: diagnosticOptions.responseFormatFallbackUsed,
        detectedShape: detectResponseShape(payload),
      });

      throw error instanceof AIProviderError
        ? error
        : new AIProviderError(
            '返回格式不像 OpenAI Compatible，请检查服务类型。',
            OPENAI_COMPATIBLE_PROVIDER_ID,
            error,
          );
    }
  }

  function parseResponsesAttempt(
    attempt: Awaited<ReturnType<typeof sendResponsesRequest>>,
    config: OpenAICompatibleConfig,
  ) {
    if (!attempt.ok) {
      logOpenAIDiagnostic('openai-compatible.server_error', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: attempt.serverMessage,
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: false,
      });

      throw new AIProviderError(
        buildFriendlyHTTPError(attempt.status, attempt.serverMessage, config.apiMode),
        OPENAI_COMPATIBLE_PROVIDER_ID,
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(attempt.bodyText);
    } catch (error) {
      logOpenAIDiagnostic('openai-compatible.response_parse_failed', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: false,
        detectedShape: 'unknown',
      });

      throw new AIProviderError(
        'AI 服务响应不是有效 JSON，请检查服务是否兼容 Responses API。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }

    try {
      return extractResponsesModelText(payload);
    } catch (error) {
      logOpenAIDiagnostic('openai-compatible.response_parse_failed', {
        config,
        httpStatus: attempt.status,
        contentType: attempt.contentType,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseBody: attempt.bodyText,
        responseFormatFallbackUsed: false,
        detectedShape: detectResponseShape(payload),
      });

      throw error instanceof AIProviderError
        ? error
        : new AIProviderError(
            '当前服务返回格式不符合 Responses API，请检查接口模式或模型。',
            OPENAI_COMPATIBLE_PROVIDER_ID,
            error,
          );
    }
  }

  return {
    id: OPENAI_COMPATIBLE_PROVIDER_ID,
    name: 'OpenAI Compatible',
    async generateDailyMemory(input, options) {
      return requestJSON(options, buildDailyMemoryPrompt(input), (rawOutput) =>
        parseGeneratedDailyMemory(rawOutput, input),
      );
    },
    async generateWeeklyReport(input, options) {
      return requestJSON(
        options,
        buildRangeReportPrompt({
          reportType: 'weekly',
          ...input,
        }),
        (rawOutput) =>
          parseGeneratedRangeReport(rawOutput, {
            reportType: 'weekly',
            ...input,
          }),
      );
    },
    async generateRangeReport(input, options) {
      return requestJSON(options, buildRangeReportPrompt(input), (rawOutput) =>
        parseGeneratedRangeReport(rawOutput, input),
      );
    },
    async analyzeReportStyle(input, options) {
      try {
        return await requestJSON(options, buildReportStyleAnalysisPrompt(input), parseAnalyzedReportStyle);
      } catch (error) {
        await logger.error(
          'ai',
          'openai-compatible.style_analysis_failed',
          'OpenAI Compatible style analysis failed',
          {
            provider: OPENAI_COMPATIBLE_PROVIDER_ID,
            model: options.openAICompatible?.model,
            sampleTextLength: input.sampleText.trim().length,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        );

        throw error;
      }
    },
    async suggestClarifications(input, options) {
      return requestJSON(options, buildClarificationsPrompt(input), parseSuggestedClarifications);
    },
    async suggestThreadLink(input, options) {
      return requestJSON(options, buildThreadLinkPrompt(input), (rawOutput) =>
        parseThreadLinkSuggestion(rawOutput, input),
      );
    },
    async suggestReportGaps(input, options) {
      return requestJSON(options, buildReportGapsPrompt(input), (rawOutput) =>
        parseReportGaps(rawOutput, input),
      );
    },
    async checkHealth(options) {
      try {
        const config = getOpenAICompatibleConfig(options);
        const output = await requestModelText(config, '只输出 JSON：{"ok":true}', {
          strictJsonMode: true,
        });
        const parsed = parseStrictJSON<{ ok?: boolean }>(
          output,
          '服务可访问，但未返回预期 JSON，生成时可能失败。',
        );

        if (parsed.ok !== true) {
          throw new Error('服务可访问，但未返回预期 JSON，生成时可能失败。');
        }

        return {
          status: 'available',
          message: '服务可用',
        };
      } catch (error) {
        return {
          status: 'unavailable',
          message: '检测失败',
          detail:
            error instanceof Error
              ? normalizeHealthErrorMessage(error.message)
              : '无法连接到 AI 服务，请检查当前配置。',
        };
      }
    },
  };
}

export const openAICompatibleProvider = createOpenAICompatibleProvider();

function getOpenAICompatibleConfig(options: AIProviderOptions): OpenAICompatibleConfig {
  const config = options.openAICompatible;
  const baseUrl = config?.baseUrl.trim() ?? '';
  const apiKey = config?.apiKey.trim() ?? '';
  const model = config?.model.trim() ?? '';
  const apiMode = getOpenAICompatibleApiMode(config?.apiMode);
  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl);

  if (!baseUrl) {
    throw new AIProviderError('请填写 Base URL。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  if (!apiKey) {
    throw new AIProviderError('请填写 API Key。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  if (!model) {
    throw new AIProviderError('请填写模型名称。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  return { baseUrl, normalizedBaseUrl, apiKey, model, apiMode };
}

function getOpenAICompatibleApiMode(value: unknown): OpenAICompatibleApiMode {
  return value === 'responses' || value === 'chat-completions' ? value : 'chat-completions';
}

function toChatCompletionsUrl(normalizedBaseUrl: string) {
  return `${normalizedBaseUrl}${CHAT_COMPLETIONS_PATH}`;
}

function toResponsesUrl(normalizedBaseUrl: string) {
  return `${normalizedBaseUrl}${RESPONSES_PATH}`;
}

function buildResponsesInput(prompt: string) {
  return [
    STRICT_JSON_SYSTEM_PROMPT,
    '只输出 JSON，不要输出 Markdown，不要输出解释。',
    prompt,
  ].join('\n');
}

function extractModelText(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new AIProviderError(
      '返回格式不像 OpenAI Compatible，请检查服务类型。',
      OPENAI_COMPATIBLE_PROVIDER_ID,
    );
  }

  if (isAnthropicContentArray(payload.content)) {
    throw new AIProviderError(getAnthropicFormatMessage(), OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  const choices = payload.choices;

  if (Array.isArray(choices)) {
    const firstChoice = choices[0];

    if (isRecord(firstChoice)) {
      const message = firstChoice.message;

      if (isRecord(message)) {
        if (typeof message.content === 'string' && message.content.trim()) {
          return message.content.trim();
        }

        if (isAnthropicContentArray(message.content)) {
          throw new AIProviderError(getAnthropicFormatMessage(), OPENAI_COMPATIBLE_PROVIDER_ID);
        }
      }

      if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
        return firstChoice.text.trim();
      }
    }
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputText = extractResponsesOutputText(payload.output);

  if (outputText) {
    return outputText;
  }

  if ('output' in payload) {
    throw new AIProviderError(
      '当前服务返回格式更像 Responses API，不是 Chat Completions 格式。',
      OPENAI_COMPATIBLE_PROVIDER_ID,
    );
  }

  throw new AIProviderError(
    '返回格式不像 OpenAI Compatible，请检查服务类型。',
    OPENAI_COMPATIBLE_PROVIDER_ID,
  );
}

function extractResponsesModelText(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new AIProviderError(
      '当前服务返回格式不符合 Responses API，请检查接口模式或模型。',
      OPENAI_COMPATIBLE_PROVIDER_ID,
    );
  }

  if (isAnthropicContentArray(payload.content)) {
    throw new AIProviderError(getAnthropicFormatMessage(), OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputText = extractResponsesOutputText(payload.output);

  if (outputText) {
    return outputText;
  }

  const chatText = extractChatCompletionText(payload);

  if (chatText) {
    return chatText;
  }

  throw new AIProviderError(
    '当前服务返回格式不符合 Responses API，请检查接口模式或模型。',
    OPENAI_COMPATIBLE_PROVIDER_ID,
  );
}

function extractChatCompletionText(payload: Record<string, unknown>) {
  const choices = payload.choices;

  if (!Array.isArray(choices)) {
    return '';
  }

  const firstChoice = choices[0];

  if (!isRecord(firstChoice)) {
    return '';
  }

  const message = firstChoice.message;

  if (isRecord(message)) {
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }

    if (isAnthropicContentArray(message.content)) {
      throw new AIProviderError(getAnthropicFormatMessage(), OPENAI_COMPATIBLE_PROVIDER_ID);
    }
  }

  if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
    return firstChoice.text.trim();
  }

  return '';
}

function extractResponsesOutputText(output: unknown) {
  if (!Array.isArray(output)) {
    return '';
  }

  const textParts: string[] = [];

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (isRecord(contentItem) && typeof contentItem.text === 'string') {
        const text = contentItem.text.trim();

        if (text) {
          textParts.push(text);
        }
      }
    }
  }

  return textParts.join('\n').trim();
}

function isAnthropicContentArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.some(
      (item) =>
        isRecord(item) && item.type === 'text' && typeof item.text === 'string',
    )
  );
}

function getAnthropicFormatMessage() {
  return '当前服务可能是 Anthropic / Claude 格式，暂不适用于 OpenAI Compatible。请切换到 OpenAI Compatible 网关，或等待后续支持 Anthropic Compatible。';
}

function buildFriendlyHTTPError(
  status: number,
  serverMessage: string | undefined,
  apiMode: OpenAICompatibleApiMode,
) {
  const baseMessage = getModeSwitchMessage(apiMode, serverMessage) ?? getFriendlyHTTPError(status);
  const trimmedServerMessage = truncate(serverMessage?.trim() ?? '', SERVER_MESSAGE_LIMIT);

  return trimmedServerMessage ? `${baseMessage} 服务返回：${trimmedServerMessage}` : baseMessage;
}

function getModeSwitchMessage(apiMode: OpenAICompatibleApiMode, serverMessage?: string) {
  if (apiMode === 'chat-completions' && isChatModeResponsesOnlyError(serverMessage)) {
    return '当前服务只支持 Responses API，请在 AI 配置中将接口模式切换为 Responses API。';
  }

  if (apiMode === 'responses' && isResponsesModeChatCompletionsError(serverMessage)) {
    return '当前服务可能不支持 Responses API，请尝试切换为 Chat Completions。';
  }

  return undefined;
}

function getFriendlyHTTPError(status: number) {
  if (status === 400) {
    return '请求参数可能不被当前服务支持，请检查模型或关闭严格 JSON 模式后重试。';
  }

  if (status === 401 || status === 403) {
    return 'API Key 无效或没有权限，请检查密钥。';
  }

  if (status === 404) {
    return '接口地址或模型可能不正确，请检查 Base URL 和模型名称。';
  }

  if (status === 429) {
    return '请求过于频繁或额度不足，请稍后再试。';
  }

  if (status >= 500 && status <= 599) {
    return 'AI 服务暂时不可用，请稍后再试。';
  }

  return 'AI 服务请求失败，请检查当前配置。';
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError' || /abort/i.test(error.message);
  }

  return false;
}

function shouldFallbackResponseFormat(message: string | undefined) {
  if (!message) {
    return false;
  }

  return /response_format|json_object|unsupported|invalid parameter|not supported|不支持|无效参数/i.test(
    message,
  );
}

function isChatModeResponsesOnlyError(message: string | undefined) {
  return Boolean(
    message &&
      /(only\s+\/v1\/responses|\/v1\/responses|responses\/compact|codex channel)/i.test(
        message,
      ),
  );
}

function isResponsesModeChatCompletionsError(message: string | undefined) {
  return Boolean(message && /chat\/completions|not supported/i.test(message));
}

function extractServerErrorMessage(bodyText: string) {
  if (!bodyText.trim()) {
    return '';
  }

  try {
    const payload = JSON.parse(bodyText) as unknown;

    if (!isRecord(payload)) {
      return '';
    }

    if (isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }

    if (typeof payload.message === 'string') {
      return payload.message;
    }

    if (typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    return truncate(bodyText.trim(), SERVER_MESSAGE_LIMIT);
  }

  return '';
}

function logOpenAIDiagnostic(
  event: string,
  diagnostic: {
    config: OpenAICompatibleConfig;
    httpStatus?: number;
    contentType?: string;
    errorMessage?: string;
    responseBody?: string;
    responseFormatFallbackUsed?: boolean;
    detectedShape?: string;
  },
) {
  const metadata = {
    provider: OPENAI_COMPATIBLE_PROVIDER_ID,
    normalizedBaseUrl: diagnostic.config.normalizedBaseUrl,
    model: diagnostic.config.model,
    apiMode: diagnostic.config.apiMode,
    status: diagnostic.httpStatus,
    contentType: diagnostic.contentType,
    errorMessage: truncate(diagnostic.errorMessage ?? '', SERVER_MESSAGE_LIMIT),
    bodyPreview: buildSafeResponsePreview(diagnostic.responseBody ?? ''),
    responseFormatFallbackUsed: diagnostic.responseFormatFallbackUsed ?? false,
    detectedShape: diagnostic.detectedShape,
  };

  if (event.includes('server_error') || event.includes('parse_failed')) {
    logger.error('ai', event, 'OpenAI Compatible diagnostic event', metadata);
    return;
  }

  logger.warn('ai', event, 'OpenAI Compatible diagnostic event', metadata);
}

function detectResponseShape(payload: unknown) {
  if (!isRecord(payload)) {
    return 'unknown';
  }

  if (isAnthropicContentArray(payload.content)) {
    return 'anthropic-like';
  }

  if (Array.isArray(payload.choices)) {
    return 'chat-completions';
  }

  if ('output_text' in payload || 'output' in payload) {
    return 'responses-api';
  }

  return 'unknown';
}

function buildSafeResponsePreview(bodyText: string) {
  if (!bodyText) {
    return '';
  }

  try {
    return truncate(
      JSON.stringify(sanitizeDiagnosticValue(JSON.parse(bodyText))),
      RESPONSE_BODY_PREVIEW_LIMIT,
    );
  } catch {
    return truncate(bodyText.replace(/\s+/g, ' '), RESPONSE_BODY_PREVIEW_LIMIT);
  }
}

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return truncate(value, 24);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map(sanitizeDiagnosticValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (/api.?key|authorization|token|secret/i.test(key)) {
      sanitized[key] = '[redacted]';
    } else {
      sanitized[key] = sanitizeDiagnosticValue(item);
    }
  }

  return sanitized;
}

function normalizeHealthErrorMessage(message: string) {
  if (message === '返回格式不像 OpenAI Compatible，请检查服务类型。') {
    return '服务可访问，但返回格式不像 OpenAI Compatible。';
  }

  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
