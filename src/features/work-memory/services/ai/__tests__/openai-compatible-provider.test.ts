import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateDailyMemoryInput, GenerateRangeReportInput } from '../../../types';
import { AIProviderError, type AIProviderOptions } from '../ai-provider';
import {
  createOpenAICompatibleProvider,
  normalizeOpenAICompatibleBaseUrl,
} from '../openai-compatible-provider';

const dailyInput: GenerateDailyMemoryInput = {
  date: '2026-06-08',
  rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
  supplements: {},
};

const reportInput: GenerateRangeReportInput = {
  reportType: 'custom',
  startDate: '2026-06-01',
  endDate: '2026-06-07',
  reportLength: 'brief',
  reportTone: 'formal',
  reportFocus: 'risks',
  memories: [
    {
      id: 'daily-memory-2026-06-01',
      date: '2026-06-01',
      rawContent: '完成 SQLite 迁移。',
      supplements: {},
      generated: {
        summary: '完成 SQLite 迁移。',
        completedItems: ['迁移本地存储到 SQLite'],
      },
      status: 'generated',
      createdAt: '2026-06-01T01:00:00.000Z',
      updatedAt: '2026-06-01T02:00:00.000Z',
    },
  ],
};

const options: AIProviderOptions = {
  codexCommand: 'codex',
  codexModel: 'gpt-5.4-mini',
  openAICompatible: {
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'secret-api-key',
    model: 'gpt-test',
  },
};

describe('OpenAI Compatible Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['https://api.openai.com', 'https://api.openai.com/v1'],
    ['https://api.openai.com/', 'https://api.openai.com/v1'],
    ['https://api.openai.com/v1', 'https://api.openai.com/v1'],
    ['https://api.openai.com/v1/', 'https://api.openai.com/v1'],
    ['https://example.com', 'https://example.com/v1'],
    ['https://example.com/', 'https://example.com/v1'],
    ['https://example.com/v1', 'https://example.com/v1'],
    ['https://example.com/v1/', 'https://example.com/v1'],
  ])('normalizes Base URL %s to %s', (input, expected) => {
    expect(normalizeOpenAICompatibleBaseUrl(input)).toBe(expected);
  });

  it.each([
    ['https://api.example.com', 'https://api.example.com/v1/chat/completions'],
    ['https://api.example.com/', 'https://api.example.com/v1/chat/completions'],
    ['https://api.example.com/v1', 'https://api.example.com/v1/chat/completions'],
    ['https://api.example.com/v1/', 'https://api.example.com/v1/chat/completions'],
  ])('sends chat completions requests to the normalized URL', async (baseUrl, expectedUrl) => {
    const fetch = vi.fn().mockResolvedValue(chatResponse(dailyMemoryPayload()));
    const provider = createOpenAICompatibleProvider(fetch);

    await provider.generateDailyMemory(dailyInput, {
      ...options,
      openAICompatible: { ...options.openAICompatible!, baseUrl },
    });

    expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
  });

  it('requires Base URL, API Key, and model before sending requests', async () => {
    const provider = createOpenAICompatibleProvider(vi.fn());

    await expect(
      provider.generateDailyMemory(dailyInput, {
        ...options,
        openAICompatible: { ...options.openAICompatible!, baseUrl: '' },
      }),
    ).rejects.toMatchObject({ message: '请填写 Base URL。' } satisfies Partial<AIProviderError>);

    await expect(
      provider.generateDailyMemory(dailyInput, {
        ...options,
        openAICompatible: { ...options.openAICompatible!, apiKey: '' },
      }),
    ).rejects.toMatchObject({ message: '请填写 API Key。' } satisfies Partial<AIProviderError>);

    await expect(
      provider.generateDailyMemory(dailyInput, {
        ...options,
        openAICompatible: { ...options.openAICompatible!, model: '' },
      }),
    ).rejects.toMatchObject({ message: '请填写模型名称。' } satisfies Partial<AIProviderError>);
  });

  it('parses choices[0].message.content from standard Chat Completions responses', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse(dailyMemoryPayload()));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
      completedItems: ['整理需求讨论', '同步后续计划'],
    });
  });

  it('parses choices[0].text from compatible completion-like responses', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ text: JSON.stringify(dailyMemoryPayload()) }],
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });
  });

  it('parses output_text from Responses API style payloads', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify(dailyMemoryPayload()),
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });
  });

  it('parses output content text from Responses API style payloads', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        output: [
          {
            content: [{ type: 'output_text', text: JSON.stringify(dailyMemoryPayload()) }],
          },
        ],
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });
  });

  it('reports Anthropic message payloads as unsupported by OpenAI Compatible', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify(dailyMemoryPayload()) }],
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message:
        '当前服务可能是 Anthropic / Claude 格式，暂不适用于 OpenAI Compatible。请切换到 OpenAI Compatible 网关，或等待后续支持 Anthropic Compatible。',
    } satisfies Partial<AIProviderError>);
  });

  it('retries once without response_format when the service rejects strict JSON mode', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              message: 'unsupported parameter: response_format json_object',
            },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(chatResponse(dailyMemoryPayload()));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      response_format: { type: 'json_object' },
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).not.toHaveProperty(
      'response_format',
    );
  });

  it('uses response_format fallback at most once', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'response_format unsupported' } }, 400),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'response_format unsupported' } }, 400),
      );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: expect.stringContaining('请求参数可能不被当前服务支持'),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, 'API Key 无效或没有权限，请检查密钥。'],
    [403, 'API Key 无效或没有权限，请检查密钥。'],
    [404, '接口地址或模型可能不正确，请检查 Base URL 和模型名称。'],
    [429, '请求过于频繁或额度不足，请稍后再试。'],
    [500, 'AI 服务暂时不可用，请稍后再试。'],
  ])('maps HTTP %s to a specific user message', async (status, message) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'server says no' } }, status));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: `${message} 服务返回：server says no`,
      providerId: 'openai-compatible',
    } satisfies Partial<AIProviderError>);
  });

  it('truncates server error messages before showing them to users', async () => {
    const longMessage = 'x'.repeat(220);
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ message: longMessage }, 404));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: `接口地址或模型可能不正确，请检查 Base URL 和模型名称。 服务返回：${'x'.repeat(160)}`,
    });
  });

  it('rejects non-JSON model output with a specific friendly error', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse('not json'));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: '服务返回内容不是有效 JSON，请尝试更换模型或关闭严格 JSON 模式。',
    } satisfies Partial<AIProviderError>);
  });

  it('writes redacted diagnostics without API Key, authorization header, or full user content', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: 'bad key' }, echo: dailyInput.rawContent }, 401),
      );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toBeInstanceOf(
      AIProviderError,
    );

    const logs = debug.mock.calls.map((call) => JSON.stringify(call)).join('\n');
    expect(logs).toContain('openai-compatible');
    expect(logs).toContain('https://api.example.com/v1');
    expect(logs).toContain('gpt-test');
    expect(logs).not.toContain('secret-api-key');
    expect(logs).not.toContain('Authorization');
    expect(logs).not.toContain(dailyInput.rawContent);
  });

  it('checks provider health with a lightweight JSON request', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse({ ok: true }));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.checkHealth?.(options)).resolves.toEqual({
      status: 'available',
      message: '服务可用',
    });
  });

  it('returns a specific health detail when the service returns non-JSON text', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse('ok'));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.checkHealth?.(options)).resolves.toEqual({
      status: 'unavailable',
      message: '检测失败',
      detail: '服务可访问，但未返回预期 JSON，生成时可能失败。',
    });
  });

  it('returns a specific health detail when the response is not OpenAI Compatible', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.checkHealth?.(options)).resolves.toEqual({
      status: 'unavailable',
      message: '检测失败',
      detail: '服务可访问，但返回格式不像 OpenAI Compatible。',
    });
  });

  it('builds range report prompts with date range and preferences', async () => {
    const fetch = vi.fn().mockResolvedValue(
      chatResponse({
        title: '2026年6月1日-6月7日工作总结',
        summary: '完成 SQLite 迁移。',
        highlights: ['完成存储迁移'],
        completedItems: ['迁移到 SQLite'],
        markdown: '# 2026年6月1日-6月7日工作总结\n\n完成 SQLite 迁移。',
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateRangeReport(reportInput, options)).resolves.toMatchObject({
      title: '2026年6月1日-6月7日工作总结',
      summary: '完成 SQLite 迁移。',
    });

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as {
      model: string;
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages[1]?.content ?? '';

    expect(prompt).toContain('2026-06-01');
    expect(prompt).toContain('2026-06-07');
    expect(prompt).toContain('报告详略：精简');
    expect(prompt).toContain('报告语气：正式');
    expect(prompt).toContain('报告重点：问题风险优先');
    expect(body.model).toBe('gpt-test');
  });
});

function dailyMemoryPayload() {
  return {
    summary: '整理需求并同步计划。',
    completedItems: ['整理需求讨论', '同步后续计划'],
  };
}

function chatResponse(content: unknown, status = 200) {
  return jsonResponse(
    {
      choices: [
        {
          message: {
            content: typeof content === 'string' ? content : JSON.stringify(content),
          },
        },
      ],
    },
    status,
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
