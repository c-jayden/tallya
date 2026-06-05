import { describe, expect, it, vi } from 'vitest';
import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  GenerateDailyMemoryInput,
  GenerateWeeklyReportInput,
} from '../../types';
import { AIProviderError } from './ai-provider';
import { createCodexCliProvider, createCodexCliTools } from './codex-cli-provider';

const input: GenerateDailyMemoryInput = {
  date: '2026-06-03',
  rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
  supplements: {},
};

const generated: GeneratedDailyMemory = {
  summary: '整理需求讨论并同步后续计划。',
  completedItems: ['整理需求讨论内容', '确认优先处理范围', '同步后续计划'],
};

const weeklyInput: GenerateWeeklyReportInput = {
  startDate: '2026-06-01',
  endDate: '2026-06-07',
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

const weeklyGenerated: GeneratedReportContent = {
  title: '本周周报',
  summary: '本周完成 SQLite 存储迁移。',
  highlights: ['完成 SQLite 存储迁移'],
  completedItems: ['迁移本地存储'],
  problems: '',
  nextWeekPlan: '',
  markdown: '# 本周周报\n\n本周完成 SQLite 存储迁移。',
};

describe('createCodexCliProvider', () => {
  it('passes the configured command to the Tauri generation command', async () => {
    const invoke = vi.fn().mockResolvedValue(generated);
    const provider = createCodexCliProvider(invoke);

    await expect(
      provider.generateDailyMemory(input, {
        codexCommand: 'custom-codex',
        codexModel: 'gpt-5.4-mini',
      }),
    ).resolves.toEqual(generated);

    expect(invoke).toHaveBeenCalledWith('generate_daily_memory_with_codex', {
      input,
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
    });
  });

  it('wraps generation failures in a friendly provider error', async () => {
    const provider = createCodexCliProvider(vi.fn().mockRejectedValue('raw spawn failure'));

    await expect(
      provider.generateDailyMemory(input, { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' }),
    ).rejects.toMatchObject({
      cause: 'raw spawn failure',
      message: 'raw spawn failure',
      name: 'AIProviderError',
      providerId: 'ai-codex-cli',
    } satisfies AIProviderError & { cause: string });
  });

  it('passes weekly report input to the Tauri Codex command', async () => {
    const invoke = vi.fn().mockResolvedValue(weeklyGenerated);
    const provider = createCodexCliProvider(invoke);

    await expect(
      provider.generateWeeklyReport(weeklyInput, {
        codexCommand: 'custom-codex',
        codexModel: 'gpt-5.4-mini',
      }),
    ).resolves.toEqual(weeklyGenerated);

    expect(invoke).toHaveBeenCalledWith('generate_weekly_report_with_codex', {
      input: weeklyInput,
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
    });
  });

  it('wraps weekly report failures in a friendly provider error', async () => {
    const provider = createCodexCliProvider(
      vi.fn().mockRejectedValue('AI 返回内容不是合法 JSON，请重试。'),
    );

    await expect(
      provider.generateWeeklyReport(weeklyInput, {
        codexCommand: 'codex',
        codexModel: 'gpt-5.4-mini',
      }),
    ).rejects.toMatchObject({
      cause: 'AI 返回内容不是合法 JSON，请重试。',
      message: 'AI 返回内容不是合法 JSON，请重试。',
      name: 'AIProviderError',
      providerId: 'ai-codex-cli',
    } satisfies AIProviderError & { cause: string });
  });

  it('checks command availability for health', async () => {
    const invoke = vi.fn().mockResolvedValueOnce('codex-cli 1.2.3');
    const provider = createCodexCliProvider(invoke);

    await expect(
      provider.checkHealth?.({ codexCommand: 'codex', codexModel: 'gpt-5.4-mini' }),
    ).resolves.toEqual({
      status: 'available',
      message: '服务可用',
      detail: 'codex-cli 1.2.3',
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('check_codex_cli', { command: 'codex' });
  });

  it('returns unavailable health with a friendly message when command check fails', async () => {
    const invoke = vi.fn().mockRejectedValueOnce('not found');
    const provider = createCodexCliProvider(invoke);

    await expect(
      provider.checkHealth?.({ codexCommand: 'codex', codexModel: 'gpt-5.4-mini' }),
    ).resolves.toEqual({
      status: 'unavailable',
      message: '检测失败',
      detail: 'not found',
    });
  });
});

describe('createCodexCliTools', () => {
  it('checks the configured Codex command through Tauri', async () => {
    const invoke = vi.fn().mockResolvedValue('codex-cli 1.2.3');
    const tools = createCodexCliTools(invoke);

    await expect(tools.checkCodexCli('codex-nightly')).resolves.toBe('codex-cli 1.2.3');
    expect(invoke).toHaveBeenCalledWith('check_codex_cli', { command: 'codex-nightly' });
  });
});
