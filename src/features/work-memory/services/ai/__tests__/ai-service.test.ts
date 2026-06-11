import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../app-settings-repository';
import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  GenerateDailyMemoryInput,
  RangeReportSourceInput,
  WeeklyReportSourceInput,
} from '../../../types';
import { createAIService } from '../ai-service';
import type { AIProvider } from '../ai-provider';

const input: GenerateDailyMemoryInput = {
  date: '2026-06-03',
  rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
  supplements: {},
};

const generated: GeneratedDailyMemory = {
  summary: '整理需求讨论并同步后续计划。',
  completedItems: ['整理需求讨论内容', '确认优先处理范围', '同步后续计划'],
};

const weeklyInput: WeeklyReportSourceInput = {
  startDate: '2026-06-01',
  endDate: '2026-06-07',
  entries: [
    {
      occurredOn: '2026-06-01',
      content: 'Finished SQLite migration.',
      clarifications: ['Migrated local storage to SQLite'],
      threadTitle: null,
    },
  ],
};

const customInput: RangeReportSourceInput = {
  reportType: 'custom',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  entries: weeklyInput.entries,
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

const settings: AppSettings = {
  aiProviderId: 'ai-codex-cli',
  codexCommand: 'custom-codex',
  codexModel: 'gpt-5.4-mini',
  openAICompatible: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-5.4-mini',
    apiMode: 'chat-completions',
    parameters: {
      temperature: '',
      topP: '',
      presencePenalty: '',
      frequencyPenalty: '',
    },
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: '',
  },
  localGateway: {
    enabled: false,
    baseUrl: 'http://localhost:8080',
    model: 'gpt-5',
    apiMode: 'chat-completions',
  },
  dailyReminderEnabled: false,
  dailyReminderTime: '18:00',
  dailyReminderMessage: '可以花一分钟沉淀一下今天的工作。',
  weeklyReminderEnabled: false,
  weeklyReminderWeekday: 'friday',
  weeklyReminderTime: '18:30',
  weeklyReminderMessage: '可以整理一下这周的工作脉络了。',
  reportLength: 'brief',
  reportTone: 'retrospective',
  reportFocus: 'risks',
  reportStyleHint: '请尽量用 3 条分点，最后一句说明计划。',
  reportStyleProfile: {
    enabled: true,
    summary: '偏简洁，常用分点。',
    promptHint: '保持简洁自然，使用 3-5 条分点。',
    updatedAt: '2026-06-09T10:00:00.000Z',
  },
  theme: 'system',
  launchAtStartup: false,
  closeToTray: true,
  startMinimized: false,
  diagnosticLoggingEnabled: false,
};

describe('createAIService', () => {
  const localGatewaySettings: AppSettings = {
    ...settings,
    localGateway: {
      ...settings.localGateway,
      enabled: true,
    },
  };

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
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);
    expect(generateDailyMemory).toHaveBeenCalledWith(input, {
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
      openAICompatible: settings.openAICompatible,
    });
  });

  it('checks health through the selected provider with saved settings', async () => {
    const checkHealth = vi.fn<NonNullable<AIProvider['checkHealth']>>().mockResolvedValue({
      status: 'available',
      message: '服务可用',
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
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
        checkHealth,
      },
    });

    await expect(service.checkHealth()).resolves.toEqual({
      status: 'available',
      message: '服务可用',
      detail: 'codex 1.2.3',
    });
    expect(checkHealth).toHaveBeenCalledWith({
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
      openAICompatible: settings.openAICompatible,
    });
  });

  it('reads saved settings before generating a weekly report', async () => {
    const generateRangeReport = vi
      .fn<AIProvider['generateRangeReport']>()
      .mockResolvedValue(weeklyGenerated);
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(settings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        generateWeeklyReport: vi.fn(),
        generateRangeReport,
      },
    });

    await expect(service.generateWeeklyReport(weeklyInput)).resolves.toEqual(weeklyGenerated);
    expect(generateRangeReport).toHaveBeenCalledWith(
      {
        reportType: 'weekly',
        ...weeklyInput,
        reportLength: 'brief',
        reportTone: 'retrospective',
        reportFocus: 'risks',
        reportStyleHint: '请尽量用 3 条分点，最后一句说明计划。',
        reportStyleProfile: DEFAULT_APP_SETTINGS.reportStyleProfile,
      },
      {
        codexCommand: 'custom-codex',
        codexModel: 'gpt-5.4-mini',
        openAICompatible: settings.openAICompatible,
      },
    );
  });

  it('reads saved report preferences before generating a custom range report', async () => {
    const generateRangeReport = vi
      .fn<AIProvider['generateRangeReport']>()
      .mockResolvedValue(weeklyGenerated);
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(settings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        generateWeeklyReport: vi.fn(),
        generateRangeReport,
      },
    });

    await expect(service.generateRangeReport(customInput)).resolves.toEqual(weeklyGenerated);
    expect(generateRangeReport).toHaveBeenCalledWith(
      {
        ...customInput,
        reportLength: 'brief',
        reportTone: 'retrospective',
        reportFocus: 'risks',
        reportStyleHint: '请尽量用 3 条分点，最后一句说明计划。',
        reportStyleProfile: DEFAULT_APP_SETTINGS.reportStyleProfile,
      },
      {
        codexCommand: 'custom-codex',
        codexModel: 'gpt-5.4-mini',
        openAICompatible: settings.openAICompatible,
      },
    );
  });

  it('uses the OpenAI Compatible provider when selected in settings', async () => {
    const generateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const openAICompatibleProvider: AIProvider = {
      id: 'openai-compatible',
      name: 'OpenAI Compatible',
      generateDailyMemory,
      generateWeeklyReport: vi.fn(),
      generateRangeReport: vi.fn(),
    };
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue({
          ...settings,
          aiProviderId: 'openai-compatible',
          openAICompatible: {
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'secret',
            model: 'gpt-test',
            apiMode: 'responses',
          },
        }),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      openAICompatibleProvider,
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);
    expect(generateDailyMemory).toHaveBeenCalledWith(input, {
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
      openAICompatible: {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'secret',
        model: 'gpt-test',
        apiMode: 'responses',
      },
    });
  });

  it('routes daily memory generation through the local gateway when the probe succeeds', async () => {
    const codexGenerateDailyMemory = vi.fn<AIProvider['generateDailyMemory']>();
    const openAIGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const localGatewayProbe = vi.fn().mockResolvedValue({ reachable: true });
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(localGatewaySettings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: codexGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      openAICompatibleProvider: {
        id: 'openai-compatible',
        name: 'OpenAI Compatible',
        generateDailyMemory: openAIGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      localGatewayProbe,
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);

    expect(localGatewayProbe).toHaveBeenCalledWith('http://localhost:8080');
    expect(openAIGenerateDailyMemory).toHaveBeenCalledWith(input, {
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
      openAICompatible: {
        baseUrl: 'http://localhost:8080',
        apiKey: 'local-gateway',
        model: 'gpt-5',
        apiMode: 'chat-completions',
      },
    });
    expect(codexGenerateDailyMemory).not.toHaveBeenCalled();
  });

  it('falls back to the selected provider when the local gateway is unavailable', async () => {
    const codexGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const openAIGenerateDailyMemory = vi.fn<AIProvider['generateDailyMemory']>();
    const localGatewayProbe = vi.fn().mockResolvedValue({ reachable: false });
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(localGatewaySettings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: codexGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      openAICompatibleProvider: {
        id: 'openai-compatible',
        name: 'OpenAI Compatible',
        generateDailyMemory: openAIGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      localGatewayProbe,
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);

    expect(codexGenerateDailyMemory).toHaveBeenCalledWith(input, {
      codexCommand: 'custom-codex',
      codexModel: 'gpt-5.4-mini',
      openAICompatible: settings.openAICompatible,
    });
    expect(openAIGenerateDailyMemory).not.toHaveBeenCalled();
  });

  it('does not probe when local gateway mode is disabled', async () => {
    const codexGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const localGatewayProbe = vi.fn();
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue({
          ...settings,
          localGateway: {
            ...settings.localGateway,
            enabled: false,
          },
        }),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: codexGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      localGatewayProbe,
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);

    expect(localGatewayProbe).not.toHaveBeenCalled();
    expect(codexGenerateDailyMemory).toHaveBeenCalledTimes(1);
  });

  it('silently retries the selected provider when a reachable gateway fails at runtime', async () => {
    const codexGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const openAIGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockRejectedValue(new Error('gateway down'));
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(localGatewaySettings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: codexGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      openAICompatibleProvider: {
        id: 'openai-compatible',
        name: 'OpenAI Compatible',
        generateDailyMemory: openAIGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      localGatewayProbe: vi.fn().mockResolvedValue({ reachable: true }),
    });

    await expect(service.generateDailyMemory(input)).resolves.toEqual(generated);

    expect(openAIGenerateDailyMemory).toHaveBeenCalledTimes(1);
    expect(codexGenerateDailyMemory).toHaveBeenCalledTimes(1);
  });

  it('caches successful local gateway probes for 60 seconds', async () => {
    let now = 1_000;
    const localGatewayProbe = vi.fn().mockResolvedValue({ reachable: true });
    const openAIGenerateDailyMemory = vi
      .fn<AIProvider['generateDailyMemory']>()
      .mockResolvedValue(generated);
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(localGatewaySettings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      openAICompatibleProvider: {
        id: 'openai-compatible',
        name: 'OpenAI Compatible',
        generateDailyMemory: openAIGenerateDailyMemory,
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
      },
      localGatewayProbe,
      now: () => now,
    });

    await service.generateDailyMemory(input);
    now += 59_000;
    await service.generateDailyMemory(input);
    now += 1_001;
    await service.generateDailyMemory(input);

    expect(localGatewayProbe).toHaveBeenCalledTimes(2);
    expect(openAIGenerateDailyMemory).toHaveBeenCalledTimes(3);
  });

  it('analyzes report style with the selected provider', async () => {
    const analyzeReportStyle = vi.fn<NonNullable<AIProvider['analyzeReportStyle']>>()
      .mockResolvedValue({
        summary: '偏简洁，常用分点。',
        promptHint: '生成报告时保持简洁自然。',
      });
    const service = createAIService({
      settingsRepository: {
        getSettings: vi.fn().mockResolvedValue(settings),
      },
      codexProvider: {
        id: 'ai-codex-cli',
        name: 'Codex CLI',
        generateDailyMemory: vi.fn(),
        generateWeeklyReport: vi.fn(),
        generateRangeReport: vi.fn(),
        analyzeReportStyle,
      },
    });

    await expect(service.analyzeReportStyle({ sampleText: '今日完成：整理需求。' })).resolves.toEqual({
      summary: '偏简洁，常用分点。',
      promptHint: '生成报告时保持简洁自然。',
    });
    expect(analyzeReportStyle).toHaveBeenCalledWith(
      { sampleText: '今日完成：整理需求。' },
      {
        codexCommand: 'custom-codex',
        codexModel: 'gpt-5.4-mini',
        openAICompatible: settings.openAICompatible,
      },
    );
  });
});
