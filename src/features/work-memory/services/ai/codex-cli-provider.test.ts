import { describe, expect, it, vi } from 'vitest';
import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';
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

describe('createCodexCliProvider', () => {
  it('passes the configured command to the Tauri generation command', async () => {
    const invoke = vi.fn().mockResolvedValue(generated);
    const provider = createCodexCliProvider(invoke);

    await expect(
      provider.generateDailyMemory(input, { codexCommand: 'C:\\Tools\\codex.cmd' }),
    ).resolves.toEqual(generated);

    expect(invoke).toHaveBeenCalledWith('generate_daily_memory_with_codex', {
      input,
      codexCommand: 'C:\\Tools\\codex.cmd',
    });
  });

  it('wraps generation failures in a friendly provider error', async () => {
    const provider = createCodexCliProvider(vi.fn().mockRejectedValue('raw spawn failure'));

    await expect(
      provider.generateDailyMemory(input, { codexCommand: 'codex' }),
    ).rejects.toMatchObject({
      cause: 'raw spawn failure',
      message: 'raw spawn failure',
      name: 'AIProviderError',
      providerId: 'ai-codex-cli',
    } satisfies AIProviderError & { cause: string });
  });

  it('checks command availability and lightweight generation for health', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce('codex-cli 1.2.3')
      .mockResolvedValueOnce(generated);
    const provider = createCodexCliProvider(invoke);

    await expect(provider.checkHealth?.({ codexCommand: 'codex' })).resolves.toEqual({
      status: 'available',
      message: '可用',
      detail: 'codex-cli 1.2.3',
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'check_codex_cli', { command: 'codex' });
    expect(invoke).toHaveBeenNthCalledWith(2, 'generate_daily_memory_with_codex', {
      input: {
        date: '2026-06-03',
        rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
        supplements: {},
      },
      codexCommand: 'codex',
    });
  });

  it('returns unavailable health with a friendly message when generation check fails', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce('codex-cli 1.2.3')
      .mockRejectedValueOnce('not logged in');
    const provider = createCodexCliProvider(invoke);

    await expect(provider.checkHealth?.({ codexCommand: 'codex' })).resolves.toEqual({
      status: 'unavailable',
      message: '检测失败',
      detail: 'not logged in',
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
