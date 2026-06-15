import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import type { GenerateDailyMemoryInput, GenerateRangeReportInput } from '../../../types';
import { AIProviderError, type AIProviderOptions } from '../ai-provider';
import { createAnthropicProvider, normalizeAnthropicBaseUrl } from '../anthropic-provider';

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
  reportStyleHint: '请保持简洁，用 3 条分点。',
  entries: [
    {
      occurredOn: '2026-06-01',
      content: '完成 SQLite 迁移。',
      clarifications: ['迁移本地存储到 SQLite'],
      threadTitle: null,
    },
  ],
};

const options: AIProviderOptions = {
  codexCommand: 'codex',
  codexModel: 'gpt-5.4-mini',
  openAICompatible: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-5.4-mini',
    apiMode: 'chat-completions',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: 'anthropic-key',
    model: 'claude-haiku-4-5',
    parameters: {
      temperature: '0.7',
      topP: '0.9',
      maxTokens: '4096',
    },
  },
};

describe('Anthropic Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['https://api.anthropic.com', 'https://api.anthropic.com/v1'],
    ['https://api.anthropic.com/', 'https://api.anthropic.com/v1'],
    ['https://api.anthropic.com/v1', 'https://api.anthropic.com/v1'],
    ['https://api.anthropic.com/v1/', 'https://api.anthropic.com/v1'],
  ])('normalizes Base URL %s to %s', (input, expected) => {
    expect(normalizeAnthropicBaseUrl(input)).toBe(expected);
  });

  it('sends native Messages API requests with Anthropic headers and structured output', async () => {
    const fetch = vi.fn().mockResolvedValue(anthropicResponse(dailyMemoryPayload()));
    const provider = createAnthropicProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });

    expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'anthropic-key',
        'anthropic-version': '2023-06-01',
      },
      body: expect.any(String),
    });
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.9,
      output_config: {
        format: {
          type: 'json_schema',
          schema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              summary: { type: 'string' },
            }),
          }),
        },
      },
    });
    expect(body).not.toHaveProperty('response_format');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({ role: 'user' });
    expect(body.messages[0].content).toContain('只输出合法 JSON');
  });

  it('uses default max_tokens when the Anthropic maxTokens setting is blank', async () => {
    const fetch = vi.fn().mockResolvedValue(anthropicResponse(dailyMemoryPayload()));
    const provider = createAnthropicProvider(fetch);

    await provider.generateDailyMemory(dailyInput, {
      ...options,
      anthropic: {
        ...options.anthropic!,
        parameters: {
          temperature: '',
          topP: '',
          maxTokens: '',
        },
      },
    });

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ max_tokens: 4096 });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
  });

  it('uses the Tauri HTTP command by default so custom Anthropic headers are sent outside the webview', async () => {
    tauriMocks.invoke.mockResolvedValue({
      status: 200,
      contentType: 'application/json',
      bodyText: JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(dailyMemoryPayload()) }],
      }),
    });
    const provider = createAnthropicProvider();

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toMatchObject({
      summary: '整理需求并同步计划。',
    });

    expect(tauriMocks.invoke).toHaveBeenCalledWith('send_ai_http_request', {
      url: 'https://api.anthropic.com/v1/messages',
      bodyText: expect.stringContaining('"model":"claude-haiku-4-5"'),
      timeoutMs: 45_000,
      headers: [
        { name: 'x-api-key', value: 'anthropic-key' },
        { name: 'anthropic-version', value: '2023-06-01' },
      ],
    });
  });

  it('parses content array text when generating range reports', async () => {
    const fetch = vi.fn().mockResolvedValue(
      anthropicResponse({
        title: '本周回顾',
        summary: '完成 SQLite 迁移。',
        highlights: ['完成 SQLite 迁移'],
        completedItems: ['迁移本地存储'],
        markdown: '# 本周回顾\n\n完成 SQLite 迁移。',
      }),
    );
    const provider = createAnthropicProvider(fetch);

    await expect(provider.generateRangeReport(reportInput, options)).resolves.toMatchObject({
      title: '本周回顾',
      summary: '完成 SQLite 迁移。',
      markdown: '# 本周回顾\n\n完成 SQLite 迁移。',
    });
  });

  it('reports Anthropic API errors with server detail', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'invalid model',
          },
        },
        400,
      ),
    );
    const provider = createAnthropicProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: expect.stringContaining('invalid model'),
    } satisfies Partial<AIProviderError>);
  });

  it('validates required Anthropic settings before sending requests', async () => {
    const provider = createAnthropicProvider(vi.fn());

    await expect(
      provider.generateDailyMemory(dailyInput, {
        ...options,
        anthropic: { ...options.anthropic!, apiKey: '' },
      }),
    ).rejects.toMatchObject({ message: '请填写 Anthropic API Key。' });
  });
});

function anthropicResponse(payload: unknown) {
  return jsonResponse({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    stop_reason: 'end_turn',
  });
}

function jsonResponse(payload: unknown, status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    text: async () => JSON.stringify(payload),
  } as Response;
}

function dailyMemoryPayload() {
  return {
    summary: '整理需求并同步计划。',
    completedItems: ['整理需求讨论内容', '确认优先处理范围'],
    keyOutcome: '明确优先处理范围',
    dailyReportText: '今天整理了需求讨论内容，确认了优先处理范围，并同步后续计划。',
  };
}
