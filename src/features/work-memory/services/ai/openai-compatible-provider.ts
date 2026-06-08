import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  GenerateDailyMemoryInput,
  GenerateRangeReportInput,
} from '../../types';
import { normalizeReportText } from '../report-text';
import { AIProviderError, type AIProvider, type AIProviderOptions } from './ai-provider';

const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible';
const CHAT_COMPLETIONS_PATH = '/chat/completions';

type FetchLike = typeof fetch;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export function createOpenAICompatibleProvider(fetchImpl: FetchLike = fetch): AIProvider {
  async function requestJSON<T>(
    options: AIProviderOptions,
    prompt: string,
    parseOutput: (rawOutput: string) => T,
  ) {
    const config = getOpenAICompatibleConfig(options);
    const response = await fetchImpl(toChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
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
      }),
    }).catch((error: unknown) => {
      throw new AIProviderError(
        '无法连接到 AI 服务，请检查 Base URL 或网络状态。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    });

    if (!response.ok) {
      throw new AIProviderError(
        getFriendlyHTTPError(response.status),
        OPENAI_COMPATIBLE_PROVIDER_ID,
      );
    }

    let payload: ChatCompletionResponse;

    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      throw new AIProviderError(
        'AI 服务返回内容格式不正确，请稍后重试。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
        error,
      );
    }

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AIProviderError(
        'AI 没有返回有效内容，请稍后重试。',
        OPENAI_COMPATIBLE_PROVIDER_ID,
      );
    }

    try {
      return parseOutput(content);
    } catch (error) {
      throw new AIProviderError(
        error instanceof Error ? error.message : 'AI 返回内容格式不正确，请稍后重试。',
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
    async checkHealth(options) {
      try {
        await requestJSON(options, '请只返回 JSON：{"ok":true}', (rawOutput) => {
          const parsed = parseStrictJSON<{ ok?: boolean }>(rawOutput);

          if (parsed.ok !== true) {
            throw new Error('AI 服务返回内容格式不正确，请稍后重试。');
          }

          return parsed;
        });

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
              ? error.message
              : '无法连接到 AI 服务，请检查当前配置。',
        };
      }
    },
  };
}

export const openAICompatibleProvider = createOpenAICompatibleProvider();

function getOpenAICompatibleConfig(options: AIProviderOptions) {
  const config = options.openAICompatible;
  const baseUrl = config?.baseUrl.trim() ?? '';
  const apiKey = config?.apiKey.trim() ?? '';
  const model = config?.model.trim() ?? '';

  if (!baseUrl) {
    throw new AIProviderError('请填写 Base URL。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  if (!apiKey) {
    throw new AIProviderError('请填写 API Key。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  if (!model) {
    throw new AIProviderError('请填写模型。', OPENAI_COMPATIBLE_PROVIDER_ID);
  }

  return { baseUrl, apiKey, model };
}

function toChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, '')}${CHAT_COMPLETIONS_PATH}`;
}

function getFriendlyHTTPError(status: number) {
  if (status === 401 || status === 403) {
    return 'API Key 无效或没有权限。';
  }

  if (status === 404) {
    return '接口地址或模型可能不正确。';
  }

  if (status === 429) {
    return '请求过于频繁或额度不足。';
  }

  return 'AI 服务请求失败，请稍后重试。';
}

function buildDailyMemoryPrompt(input: GenerateDailyMemoryInput) {
  return [
    '把输入整理为中文工作记忆。',
    '只输出合法 JSON，不要 markdown、解释、代码块或工具调用。',
    'JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string.',
    '不要编造输入中不存在的事实；可以做温和归纳和合并。',
    `输入：${JSON.stringify(input)}`,
  ].join('\n');
}

function buildRangeReportPrompt(input: GenerateRangeReportInput) {
  const reportName = input.reportType === 'custom' ? '自定义范围工作总结' : '周报';

  return [
    `请根据输入中的 daily memories 整理一份中文${reportName}。`,
    '只输出合法 JSON，不要 markdown code fence、解释、代码块或工具调用。',
    'JSON keys: title:string, summary:string, highlights:string[], completedItems:string[], problems?:string, nextWeekPlan?:string, markdown:string.',
    '不要编造 daily memories 中不存在的事实；可以做归纳、合并和润色。',
    reportLengthInstruction(input.reportLength, input.memories.length),
    reportToneInstruction(input.reportTone),
    reportFocusInstruction(input.reportFocus),
    'markdown 是可直接复制的报告文本；不要包含多余空行，section 之间最多一个空行，不要输出空 section。',
    `输入：${JSON.stringify(input)}`,
  ].join('\n');
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

function parseStrictJSON<T>(rawOutput: string): T {
  const normalized = stripMarkdownFence(rawOutput.trim());

  if (!normalized) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new Error('AI 返回内容格式不正确，请稍后重试。');
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
