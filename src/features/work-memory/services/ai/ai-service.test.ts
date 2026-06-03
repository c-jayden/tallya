import { describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../app-settings-repository';
import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';
import { createAIService } from './ai-service';
import type { AIProvider } from './ai-provider';

const input: GenerateDailyMemoryInput = {
  date: '2026-06-03',
  rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
  supplements: {},
};

const generated: GeneratedDailyMemory = {
  summary: '整理需求讨论并同步后续计划。',
  completedItems: ['整理需求讨论内容', '确认优先处理范围', '同步后续计划'],
};

const settings: AppSettings = {
  aiProviderId: 'ai-codex-cli',
  codexCommand: 'C:\\Tools\\codex.cmd',
  openAICompatible: {
    baseUrl: '',
    apiKey: '',
    model: '',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: '',
  },
  dailyReminderEnabled: false,
  dailyReminderTime: '18:00',
  dailyReminderMessage: '可以花一分钟沉淀一下今天的工作。',
  weeklyReminderEnabled: false,
  weeklyReminderWeekday: 'friday',
  weeklyReminderTime: '18:30',
  weeklyReminderMessage: '可以整理一下这周的工作脉络了。',
  theme: 'system',
  launchAtStartup: false,
  closeToTray: true,
  startMinimized: false,
};

describe('createAIService', () => {
  it('reads the saved Codex command before generating a daily memory', async () => {
    const generateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(settings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory,
      },
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);
    expect(generateDailyMemory).toHaveBeenCalledWith(input, {
      codexCommand: 'C:\\Tools\\codex.cmd',
    });
  });

  it('checks health through the selected provider with saved settings', async () => {
    const checkHealth = vi.fn<NonNullable<AIProvider['checkHealth']>>().mockResolvedValue({
      status: 'available',
      message: '可用',
      detail: 'codex 1.2.3',
    });
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(settings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        checkHealth,
      },
    });

    await expect(service.checkHealth()).resolves.toEqual({
      status: 'available',
      message: '可用',
      detail: 'codex 1.2.3',
    });
    expect(checkHealth).toHaveBeenCalledWith({
      codexCommand: 'C:\\Tools\\codex.cmd',
    });
  });
});
