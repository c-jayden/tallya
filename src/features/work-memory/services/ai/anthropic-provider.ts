import { invoke } from '@tauri-apps/api/core';
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
  type AnthropicParameters,
} from './ai-provider';

const ANTHROPIC_PROVIDER_ID = 'anthropic';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_REQUEST_TIMEOUT_MS = 300_000;
const ANTHROPIC_DEFAULT_MAX_TOKENS = 4096;
const API_VERSION_PATH = '/v1';
const MESSAGES_PATH = '/messages';
const SERVER_MESSAGE_LIMIT = 160;
const STRICT_JSON_SYSTEM_PROMPT =
  '你是 Tallya 的工作记忆整理助手。只输出合法 JSON，不要输出 markdown code fence、解释或额外文字。';

type FetchLike = typeof fetch;

type AnthropicTransportRequest = {
  url: string;
  apiKey: string;
  bodyText: string;
  timeoutMs: number;
};

type AnthropicTransportResponse = {
  status: number;
  contentType: string;
  bodyText: string;
};

type AnthropicTransport = (
  request: AnthropicTransportRequest,
) => Promise<AnthropicTransportResponse>;

type AnthropicConfig = {
  baseUrl: string;
  normalizedBaseUrl: string;
  apiKey: string;
  model: string;
  parameters?: AnthropicParameters;
};

type JSONSchema = Record<string, unknown>;

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
};

const dailyMemorySchema = objectSchema(
  {
    summary: { type: 'string' },
    completedItems: stringArraySchema,
    keyOutcome: { type: 'string' },
    problems: { type: 'string' },
    tomorrowPlan: { type: 'string' },
    extraNote: { type: 'string' },
    dailyReportText: { type: 'string' },
  },
  ['summary', 'completedItems'],
);

const rangeReportSchema = objectSchema(
  {
    title: { type: 'string' },
    summary: { type: 'string' },
    highlights: stringArraySchema,
    completedItems: stringArraySchema,
    problems: { type: 'string' },
    nextWeekPlan: { type: 'string' },
  },
  ['title', 'summary', 'highlights', 'completedItems'],
);

const reportStyleSchema = objectSchema(
  {
    summary: { type: 'string' },
    promptHint: { type: 'string' },
  },
  ['summary', 'promptHint'],
);

const clarificationPromptSchema = objectSchema(
  {
    question: { type: 'string' },
    options: stringArraySchema,
  },
  ['question'],
);

const clarificationsSchema = objectSchema(
  {
    questions: {
      type: 'array',
      items: clarificationPromptSchema,
    },
  },
  ['questions'],
);

const threadLinkSchema = objectSchema(
  {
    relatedEntryId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    threadTitle: { type: 'string' },
  },
  ['relatedEntryId', 'threadTitle'],
);

const reportGapsSchema = objectSchema(
  {
    gaps: {
      type: 'array',
      items: objectSchema(
        {
          entryId: { type: 'string' },
          threadTitle: { type: 'string' },
          question: { type: 'string' },
        },
        ['entryId', 'threadTitle', 'question'],
      ),
    },
  },
  ['gaps'],
);

const healthCheckSchema = objectSchema(
  {
    ok: { type: 'boolean' },
  },
  ['ok'],
);

export function normalizeAnthropicBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');

  if (!normalized) {
    return '';
  }

  return /\/v\d+$/i.test(normalized) ? normalized : `${normalized}${API_VERSION_PATH}`;
}

export function createAnthropicProvider(fetchImpl?: FetchLike): AIProvider {
  const transport = fetchImpl ? createFetchAnthropicTransport(fetchImpl) : invokeAnthropicRequest;

  async function requestJSON<T>(
    options: AIProviderOptions,
    prompt: string,
    schema: JSONSchema,
    parseOutput: (rawOutput: string) => T,
  ) {
    const config = getAnthropicConfig(options);
    const content = await requestModelText(config, prompt, schema);

    try {
      return parseOutput(content);
    } catch (error) {
      logger.error('ai', 'anthropic.json_parse_failed', 'Anthropic output JSON parse failed', {
        provider: ANTHROPIC_PROVIDER_ID,
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
          : '服务返回内容不是有效 JSON，可能是输出被截断；可尝试设置 max_tokens 或缩小报告范围。',
        ANTHROPIC_PROVIDER_ID,
        error,
      );
    }
  }

  async function requestModelText(
    config: AnthropicConfig,
    prompt: string,
    schema: JSONSchema,
  ): Promise<string> {
    const response = await sendMessagesRequest(config, prompt, schema);

    return parseMessagesResponse(response, config);
  }

  async function sendMessagesRequest(config: AnthropicConfig, prompt: string, schema: JSONSchema) {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      max_tokens: getMaxTokens(config.parameters),
      system: STRICT_JSON_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      // Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
      output_config: {
        format: {
          type: 'json_schema',
          schema,
        },
      },
      ...buildAnthropicRequestParameters(config.parameters),
    };

    try {
      logger.debug('ai', 'anthropic.request_start', 'Anthropic request started', {
        provider: ANTHROPIC_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        hasApiKey: Boolean(config.apiKey),
      });

      return await transport({
        url: toMessagesUrl(config.normalizedBaseUrl),
        apiKey: config.apiKey,
        bodyText: JSON.stringify(requestBody),
        timeoutMs: ANTHROPIC_REQUEST_TIMEOUT_MS,
      });
    } catch (error) {
      logger.error('ai', 'anthropic.network_failed', 'Anthropic request failed', {
        provider: ANTHROPIC_PROVIDER_ID,
        normalizedBaseUrl: config.normalizedBaseUrl,
        model: config.model,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw new AIProviderError(
        isTimeoutError(error)
          ? 'AI 服务响应超时，请检查网络或稍后再试。'
          : '无法连接到 Anthropic 服务，请检查服务地址或网络。',
        ANTHROPIC_PROVIDER_ID,
        error,
      );
    }
  }

  return {
    id: ANTHROPIC_PROVIDER_ID,
    name: 'Claude / Anthropic',
    async generateDailyMemory(input, options) {
      return requestJSON(options, buildDailyMemoryPrompt(input), dailyMemorySchema, (rawOutput) =>
        parseGeneratedDailyMemory(rawOutput, input),
      );
    },
    async generateWeeklyReport(input, options) {
      const reportInput = {
        reportType: 'weekly' as const,
        ...input,
      };

      return requestJSON(options, buildRangeReportPrompt(reportInput), rangeReportSchema, (rawOutput) =>
        parseGeneratedRangeReport(rawOutput, reportInput),
      );
    },
    async generateRangeReport(input, options) {
      return requestJSON(options, buildRangeReportPrompt(input), rangeReportSchema, (rawOutput) =>
        parseGeneratedRangeReport(rawOutput, input),
      );
    },
    async analyzeReportStyle(input, options) {
      try {
        return await requestJSON(
          options,
          buildReportStyleAnalysisPrompt(input),
          reportStyleSchema,
          parseAnalyzedReportStyle,
        );
      } catch (error) {
        await logger.error('ai', 'anthropic.style_analysis_failed', 'Anthropic style analysis failed', {
          provider: ANTHROPIC_PROVIDER_ID,
          model: options.anthropic?.model,
          sampleTextLength: input.sampleText.trim().length,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },
    async suggestClarifications(input, options) {
      return requestJSON(
        options,
        buildClarificationsPrompt(input),
        clarificationsSchema,
        parseSuggestedClarifications,
      );
    },
    async suggestThreadLink(input, options) {
      return requestJSON(options, buildThreadLinkPrompt(input), threadLinkSchema, (rawOutput) =>
        parseThreadLinkSuggestion(rawOutput, input),
      );
    },
    async suggestReportGaps(input, options) {
      return requestJSON(options, buildReportGapsPrompt(input), reportGapsSchema, (rawOutput) =>
        parseReportGaps(rawOutput, input),
      );
    },
    async checkHealth(options) {
      try {
        const config = getAnthropicConfig(options);
        const output = await requestModelText(config, '只输出 JSON：{"ok":true}', healthCheckSchema);
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
              : '无法连接到 Anthropic 服务，请检查当前配置。',
        };
      }
    },
  };
}

export const anthropicProvider = createAnthropicProvider();

function invokeAnthropicRequest(request: AnthropicTransportRequest) {
  return invoke<AnthropicTransportResponse>('send_ai_http_request', {
    url: request.url,
    bodyText: request.bodyText,
    timeoutMs: request.timeoutMs,
    headers: [
      { name: 'x-api-key', value: request.apiKey },
      { name: 'anthropic-version', value: ANTHROPIC_VERSION },
    ],
  });
}

function createFetchAnthropicTransport(fetchImpl: FetchLike): AnthropicTransport {
  return async (request) => {
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: request.bodyText,
    });

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      bodyText: await response.text(),
    };
  };
}

function getAnthropicConfig(options: AIProviderOptions): AnthropicConfig {
  const config = options.anthropic;
  const baseUrl = config?.baseUrl.trim() ?? '';
  const apiKey = config?.apiKey.trim() ?? '';
  const model = config?.model.trim() ?? '';
  const normalizedBaseUrl = normalizeAnthropicBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new AIProviderError('请填写 Anthropic 服务地址。', ANTHROPIC_PROVIDER_ID);
  }

  if (!apiKey) {
    throw new AIProviderError('请填写 Anthropic API Key。', ANTHROPIC_PROVIDER_ID);
  }

  if (!model) {
    throw new AIProviderError('请填写 Claude 模型名称。', ANTHROPIC_PROVIDER_ID);
  }

  return {
    baseUrl,
    normalizedBaseUrl,
    apiKey,
    model,
    parameters: config?.parameters,
  };
}

function toMessagesUrl(normalizedBaseUrl: string) {
  return `${normalizedBaseUrl}${MESSAGES_PATH}`;
}

function buildAnthropicRequestParameters(parameters?: AnthropicParameters) {
  const requestParameters: Record<string, number> = {};

  setOptionalNumber(requestParameters, 'temperature', parameters?.temperature);
  setOptionalNumber(requestParameters, 'top_p', parameters?.topP);

  return requestParameters;
}

function getMaxTokens(parameters?: AnthropicParameters) {
  const configured = toOptionalNumber(parameters?.maxTokens);

  return configured && configured > 0 ? configured : ANTHROPIC_DEFAULT_MAX_TOKENS;
}

function setOptionalNumber(
  target: Record<string, number>,
  key: string,
  value: string | undefined,
) {
  const numberValue = toOptionalNumber(value);

  if (numberValue !== undefined) {
    target[key] = numberValue;
  }
}

function toOptionalNumber(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseMessagesResponse(response: AnthropicTransportResponse, config: AnthropicConfig) {
  const serverMessage = extractServerMessage(response.bodyText);

  if (response.status < 200 || response.status >= 300) {
    logger.error('ai', 'anthropic.server_error', 'Anthropic server returned an error', {
      provider: ANTHROPIC_PROVIDER_ID,
      normalizedBaseUrl: config.normalizedBaseUrl,
      model: config.model,
      httpStatus: response.status,
      contentType: response.contentType,
      errorMessage: serverMessage,
    });

    throw new AIProviderError(
      buildFriendlyHTTPError(response.status, serverMessage),
      ANTHROPIC_PROVIDER_ID,
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(response.bodyText);
  } catch (error) {
    throw new AIProviderError(
      'Anthropic 服务响应不是有效 JSON，请稍后重试。',
      ANTHROPIC_PROVIDER_ID,
      error,
    );
  }

  const text = extractAnthropicText(payload);

  if (!text) {
    throw new AIProviderError(
      'Anthropic 服务没有返回文本内容，请稍后重试。',
      ANTHROPIC_PROVIDER_ID,
    );
  }

  return text;
}

function extractAnthropicText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    return '';
  }

  return payload.content
    .filter((item): item is { type: string; text: string } => {
      return isRecord(item) && item.type === 'text' && typeof item.text === 'string';
    })
    .map((item) => item.text)
    .join('')
    .trim();
}

function extractServerMessage(bodyText: string) {
  try {
    const payload = JSON.parse(bodyText) as unknown;

    if (!isRecord(payload)) {
      return undefined;
    }

    if (typeof payload.message === 'string') {
      return payload.message;
    }

    if (isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function buildFriendlyHTTPError(status: number, serverMessage: string | undefined) {
  const baseMessage = getFriendlyHTTPError(status);
  const trimmedServerMessage = truncate(serverMessage?.trim() ?? '', SERVER_MESSAGE_LIMIT);

  return trimmedServerMessage ? `${baseMessage} 服务返回：${trimmedServerMessage}` : baseMessage;
}

function getFriendlyHTTPError(status: number) {
  if (status === 400) {
    return '请求参数可能不被 Anthropic 支持，请检查模型或参数。';
  }

  if (status === 401 || status === 403) {
    return 'Anthropic API Key 无效或没有权限，请检查密钥。';
  }

  if (status === 404) {
    return 'Anthropic 服务地址或模型可能不正确，请检查配置。';
  }

  if (status === 429) {
    return '请求过于频繁或额度不足，请稍后再试。';
  }

  if (status >= 500 && status <= 599) {
    return 'Anthropic 服务暂时不可用，请稍后再试。';
  }

  return 'Anthropic 请求失败，请检查当前配置。';
}

function normalizeHealthErrorMessage(message: string) {
  if (message.length <= SERVER_MESSAGE_LIMIT) {
    return message;
  }

  return `${message.slice(0, SERVER_MESSAGE_LIMIT)}...`;
}

function truncate(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && /timeout|timed out|超时/i.test(error.message);
}

function objectSchema(properties: Record<string, unknown>, required: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
