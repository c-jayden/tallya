import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  AnalyzeReportStyleInput,
  AnalyzedReportStyle,
  GenerateDailyMemoryInput,
  GenerateRangeReportInput,
} from '../../types';
import { logger } from '../logger/logger';
import { normalizeReportText } from '../report-text';
import { AIProviderError, type AIProvider, type AIProviderOptions } from './ai-provider';

const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible';
const OPENAI_COMPATIBLE_REQUEST_TIMEOUT_MS = 45_000;
const API_VERSION_PATH = '/v1';
const CHAT_COMPLETIONS_PATH = '/chat/completions';
const RESPONSE_BODY_PREVIEW_LIMIT = 500;
const SERVER_MESSAGE_LIMIT = 160;

type FetchLike = typeof fetch;

type OpenAICompatibleConfig = {
  baseUrl: string;
  normalizedBaseUrl: string;
  apiKey: string;
  model: string;
};

type ChatRequestOptions = {
  strictJsonMode: boolean;
};

export function normalizeOpenAICompatibleBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');

  if (!normalized) {
    return '';
  }

  return /\/v1$/i.test(normalized) ? normalized : `${normalized}${API_VERSION_PATH}`;
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
    const firstAttempt = await sendChatCompletion(config, prompt, requestOptions);

    if (
      firstAttempt.status === 400 &&
      requestOptions.strictJsonMode &&
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
          content:
            '你是 Tallya 的工作记忆整理助手。只输出合法 JSON，不要输出 markdown code fence、解释或额外文字。',
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
      status: response.status,
      contentType,
      bodyPreview: bodyText,
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
        buildFriendlyHTTPError(attempt.status, attempt.serverMessage),
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

  return { baseUrl, normalizedBaseUrl, apiKey, model };
}

function toChatCompletionsUrl(normalizedBaseUrl: string) {
  return `${normalizedBaseUrl}${CHAT_COMPLETIONS_PATH}`;
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

function buildFriendlyHTTPError(status: number, serverMessage?: string) {
  const baseMessage = getFriendlyHTTPError(status);
  const trimmedServerMessage = truncate(serverMessage?.trim() ?? '', SERVER_MESSAGE_LIMIT);

  return trimmedServerMessage ? `${baseMessage} 服务返回：${trimmedServerMessage}` : baseMessage;
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

function buildDailyMemoryPrompt(input: GenerateDailyMemoryInput) {
  return [
    '把输入整理为中文工作记忆。',
    '只输出合法 JSON，不要 markdown、解释、代码块或工具调用。',
    'JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string, dailyReportText?:string.',
    '不要编造输入中不存在的事实；可以做温和归纳和合并。',
    'dailyReportText 是适合复制到企业微信、飞书、日报表格或公司日报系统的日报文本；基于输入和结构化结果轻度整理，不要照抄原文，不要写成周报、复盘报告或领导评价。',
    'dailyReportText 默认优先一段自然文本；信息明显分为完成事项、问题、计划时可分点，但最多 3 个分组，不要为了分点而分点。',
    'dailyReportText 总体控制在 80-300 字；不要使用 Markdown 标题符号；不要输出“本次未提及”；不要暴露 AI 分析痕迹。',
    `输入：${JSON.stringify(input)}`,
  ].join('\n');
}

function buildRangeReportPrompt(input: GenerateRangeReportInput) {
  const reportName = input.reportType === 'custom' ? '自定义范围工作总结' : '周报';
  const promptInput = {
    reportType: input.reportType,
    startDate: input.startDate,
    endDate: input.endDate,
    memories: input.memories,
    reportLength: input.reportLength,
    reportTone: input.reportTone,
    reportFocus: input.reportFocus,
    reportStyleHint: input.reportStyleHint,
  };

  return [
    `请根据输入中的 daily memories 整理一份中文${reportName}。`,
    '只输出合法 JSON，不要 markdown code fence、解释、代码块或工具调用。',
    'JSON keys: title:string, summary:string, highlights:string[], completedItems:string[], problems?:string, nextWeekPlan?:string, markdown:string.',
    '不要编造 daily memories 中不存在的事实；可以做归纳、合并和润色。',
    reportLengthInstruction(input.reportLength, input.memories.length),
    reportToneInstruction(input.reportTone),
    reportFocusInstruction(input.reportFocus),
    reportStyleInstruction(input),
    'markdown 是可直接复制的报告文本；不要包含多余空行，section 之间最多一个空行，不要输出空 section。',
    `输入：${JSON.stringify(promptInput)}`,
  ].join('\n');
}

function buildReportStyleAnalysisPrompt(input: AnalyzeReportStyleInput) {
  return [
    '请分析用户粘贴的历史日报或周报样本，只输出合法 JSON，不要输出解释或 markdown。',
    'JSON keys: summary:string, promptHint:string.',
    '分析目标：',
    '- 只分析写作风格、表达习惯、结构倾向、语气、篇幅和信息组织方式。',
    '- 不提取具体业务内容。',
    '- 不提取具体项目名、公司名、客户名、人名、系统名、模块名、任务编号。',
    '- 不要把样本中的具体业务场景、字段结构或一次性表达直接复制到 promptHint。',
    '- 不要保存原始样本文本。',
    'summary 要求：',
    '- 用一句话概括样本的写作风格。',
    '- 可以写成“风格偏简洁、克制，重视进展、原因和结果”这类分析总结。',
    'promptHint 要求：',
    '- 必须写成可直接回填到“风格偏好”输入框的长期报告写作提示。',
    '- promptHint 应适用于日报、周报和自定义范围报告，不要只适用于某一次工作进展说明。',
    '- promptHint 应描述“后续报告应该怎么写”，不要写成“你的风格是……”这类分析总结。',
    '- promptHint 只能影响表达方式、结构、语气和篇幅，不能要求模型编造事实。',
    '- promptHint 不要包含具体业务名词。',
    '- promptHint 不要绑定过细的栏目，例如“页面/交互/结果”；可以抽象成“先概括主要进展，再按事项说明动作、原因和结果”。',
    '- promptHint 建议控制在 80-160 个中文字符之间。',
    '- 使用克制、清晰、可执行的中文表达。',
    `样本文本：${input.sampleText}`,
  ].join('\n');
}

function reportStyleInstruction(input: GenerateRangeReportInput) {
  const instructions = [
    '风格提示只影响表达方式，不允许改变事实内容，也不允许加入样本里的具体业务信息。',
  ];
  const reportStyleHint = input.reportStyleHint.trim();

  if (reportStyleHint) {
    instructions.push(`用户风格偏好：${reportStyleHint}`);
  }

  return instructions.join('\n');
}

function reportLengthInstruction(reportLength: string, memoryCount: number) {
  if (reportLength === 'brief') {
    return [
      '报告详略：精简。',
      'summary 1 句话；highlights 2-3 条；completedItems 2-3 条；problems 最多 1 句话；nextWeekPlan 最多 1 句话；markdown 控制在 250-450 字。',
      memoryCount === 1
        ? '当前只有 1 条工作记忆，整体进一步压缩：highlights 最多 2 条，completedItems 最多 2 条，不要把同一条记忆拆成过多项目。'
        : '合并相近事项，不要为了凑结构强行扩写。',
    ].join('\n');
  }

  if (reportLength === 'detailed') {
    return '报告详略：详细。summary 2-3 句话；highlights 4-6 条；completedItems 5-8 条；markdown 控制在 800-1200 字。';
  }

  return '报告详略：标准。summary 1-2 句话；highlights 3-5 条；completedItems 3-6 条；markdown 控制在 500-800 字。';
}

function reportToneInstruction(reportTone: string) {
  if (reportTone === 'formal') {
    return '报告语气：正式。表达规范但不要官样化。';
  }

  if (reportTone === 'retrospective') {
    return '报告语气：复盘型。关注阶段进展、问题和下一步计划，但不要编造反思。';
  }

  return '报告语气：自然。表达清楚、克制，不要过度正式。';
}

function reportFocusInstruction(reportFocus: string) {
  if (reportFocus === 'completed-items') {
    return '报告重点：完成事项优先。优先突出具体完成事项。';
  }

  if (reportFocus === 'risks') {
    return '报告重点：问题风险优先。优先突出问题、风险、阻塞和后续跟进。';
  }

  return '报告重点：关键产出优先。优先突出关键产出和阶段进展。';
}

function parseGeneratedDailyMemory(rawOutput: string, input: GenerateDailyMemoryInput) {
  const parsed = parseStrictJSON<GeneratedDailyMemory>(rawOutput);
  const summary = parsed.summary?.trim() || summarizeRawContent(input.rawContent);

  if (!summary) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  return {
    summary,
    completedItems: normalizeStringList(parsed.completedItems),
    keyOutcome: normalizeOptionalString(parsed.keyOutcome),
    problems: normalizeOptionalString(parsed.problems),
    tomorrowPlan: normalizeOptionalString(parsed.tomorrowPlan),
    extraNote: normalizeOptionalString(parsed.extraNote),
    dailyReportText: normalizeOptionalString(parsed.dailyReportText),
  };
}

function parseGeneratedRangeReport(rawOutput: string, input: GenerateRangeReportInput) {
  const parsed = parseStrictJSON<GeneratedReportContent>(rawOutput);
  const report: GeneratedReportContent = {
    title: parsed.title?.trim() || defaultReportTitle(input),
    summary: parsed.summary?.trim() ?? '',
    highlights: normalizeStringList(parsed.highlights).slice(0, 6),
    completedItems: normalizeStringList(parsed.completedItems),
    problems: normalizeOptionalString(parsed.problems),
    nextWeekPlan: normalizeOptionalString(parsed.nextWeekPlan),
    markdown: normalizeReportText(parsed.markdown ?? ''),
  };

  if (!report.markdown) {
    report.markdown = buildRangeReportMarkdown(report);
  }

  if (
    !report.summary &&
    report.highlights.length === 0 &&
    report.completedItems.length === 0 &&
    !report.markdown
  ) {
    throw new Error('AI 没有返回有效报告内容，请稍后重试。');
  }

  return report;
}

function parseAnalyzedReportStyle(rawOutput: string): AnalyzedReportStyle {
  const parsed = parseStrictJSON<AnalyzedReportStyle>(rawOutput);
  const style = {
    summary: parsed.summary?.trim() ?? '',
    promptHint: parsed.promptHint?.trim() ?? '',
  };

  if (!style.summary && !style.promptHint) {
    throw new Error('AI 没有返回有效风格分析结果，请稍后重试。');
  }

  return style;
}

function parseStrictJSON<T>(
  rawOutput: string,
  invalidJSONMessage = '服务返回内容不是有效 JSON，请尝试更换模型或关闭严格 JSON 模式。',
): T {
  const normalized = stripMarkdownFence(rawOutput.trim());

  if (!normalized) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new Error(invalidJSONMessage);
  }
}

function stripMarkdownFence(value: string) {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return (match?.[1] ?? value).trim();
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function summarizeRawContent(rawContent: string) {
  const normalized = rawContent.split(/\s+/).filter(Boolean).join(' ');

  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 72)}...`;
}

function defaultReportTitle(input: GenerateRangeReportInput) {
  return input.reportType === 'custom'
    ? `${input.startDate}-${input.endDate}工作总结`
    : '本周周报';
}

function buildRangeReportMarkdown(report: GeneratedReportContent) {
  const sections = [`# ${report.title}`];

  if (report.summary) {
    sections.push('## 总结', report.summary);
  }

  pushMarkdownList(sections, '本周重点', report.highlights);
  pushMarkdownList(sections, '完成事项', report.completedItems);

  if (report.problems) {
    sections.push('## 问题与风险', report.problems);
  }

  if (report.nextWeekPlan) {
    sections.push('## 下一步计划', report.nextWeekPlan);
  }

  return normalizeReportText(sections.join('\n\n'));
}

function pushMarkdownList(sections: string[], title: string, items: string[]) {
  if (items.length === 0) {
    return;
  }

  sections.push(`## ${title}`, items.map((item) => `- ${item}`).join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
