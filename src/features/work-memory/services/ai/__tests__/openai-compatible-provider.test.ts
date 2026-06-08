import { describe, expect, it, vi } from 'vitest';
import type { GenerateDailyMemoryInput, GenerateRangeReportInput } from '../../../types';
import { AIProviderError, type AIProviderOptions } from '../ai-provider';
import { createOpenAICompatibleProvider } from '../openai-compatible-provider';

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

describe('createOpenAICompatibleProvider', () => {
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
    ).rejects.toMatchObject({ message: '请填写模型。' } satisfies Partial<AIProviderError>);
  });

  it('maps auth failures to friendly errors without exposing the API Key', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: 'API Key 无效或没有权限。',
      providerId: 'openai-compatible',
    } satisfies Partial<AIProviderError>);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.not.toThrow(
      'secret-api-key',
    );
  });

  it('parses valid JSON daily memory responses', async () => {
    const fetch = vi.fn().mockResolvedValue(
      chatResponse({
        summary: '整理需求并同步计划。',
        completedItems: ['整理需求讨论', '同步后续计划'],
      }),
    );
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).resolves.toEqual({
      summary: '整理需求并同步计划。',
      completedItems: ['整理需求讨论', '同步后续计划'],
      keyOutcome: undefined,
      problems: undefined,
      tomorrowPlan: undefined,
      extraNote: undefined,
    });
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-api-key',
      },
      body: expect.any(String),
    });
  });

  it('rejects non-JSON model output with a friendly error', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse('not json'));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.generateDailyMemory(dailyInput, options)).rejects.toMatchObject({
      message: 'AI 返回内容格式不正确，请稍后重试。',
    } satisfies Partial<AIProviderError>);
  });

  it('checks provider health with a lightweight JSON request', async () => {
    const fetch = vi.fn().mockResolvedValue(chatResponse({ ok: true }));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.checkHealth?.(options)).resolves.toEqual({
      status: 'available',
      message: '服务可用',
    });
  });

  it('returns unavailable health when the service rejects the request', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}, 403));
    const provider = createOpenAICompatibleProvider(fetch);

    await expect(provider.checkHealth?.(options)).resolves.toEqual({
      status: 'unavailable',
      message: '检测失败',
      detail: 'API Key 无效或没有权限。',
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
