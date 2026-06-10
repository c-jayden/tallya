import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  AnalyzeReportStyleInput,
  AnalyzedReportStyle,
  GenerateDailyMemoryInput,
  RangeReportSourceInput,
  SuggestClarificationsInput,
  SuggestThreadLinkInput,
  ThreadLinkSuggestion,
  WeeklyReportSourceInput,
} from '../../types';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../app-settings-repository';
import { type AIProvider, type ProviderHealth } from './ai-provider';
import { codexCliProvider } from './codex-cli-provider';
import { mockProvider } from './mock-provider';
import { openAICompatibleProvider } from './openai-compatible-provider';

type SettingsRepository = {
  getSettings: typeof appSettingsRepository.getSettings;
};

type CreateAIServiceOptions = {
  settingsRepository?: SettingsRepository;
  codexProvider?: AIProvider;
  openAICompatibleProvider?: AIProvider;
};

const providers = [codexCliProvider, openAICompatibleProvider, mockProvider];
const providersById = new Map<string, AIProvider>(
  providers.map((provider) => [provider.id, provider]),
);

// User-facing settings expose only real providers; Mock stays registered for tests and local dev.
export const currentProviderId = 'ai-codex-cli';

export function createAIService({
  settingsRepository = appSettingsRepository,
  codexProvider = codexCliProvider,
  openAICompatibleProvider: configuredOpenAICompatibleProvider = openAICompatibleProvider,
}: CreateAIServiceOptions = {}) {
  async function generateRangeReport(input: RangeReportSourceInput): Promise<GeneratedReportContent> {
    const settings = await settingsRepository.getSettings();
    const provider = getProviderForSettings(settings, {
      codexProvider,
      openAICompatibleProvider: configuredOpenAICompatibleProvider,
    });

    return provider.generateRangeReport(
      {
        ...input,
        reportLength: settings.reportLength,
        reportTone: settings.reportTone,
        reportFocus: settings.reportFocus,
        reportStyleHint: settings.reportStyleHint,
        reportStyleProfile: DEFAULT_APP_SETTINGS.reportStyleProfile,
      },
      getProviderOptions(settings),
    );
  }

  return {
    getCurrentProvider(): AIProvider {
      return codexProvider;
    },

    getProviderById(providerId: string): AIProvider {
      const provider =
        providerId === currentProviderId
          ? codexProvider
          : providerId === openAICompatibleProvider.id
            ? configuredOpenAICompatibleProvider
            : providersById.get(providerId);

      if (!provider) {
        throw new Error(`AI Provider "${providerId}" is not registered.`);
      }

      return provider;
    },

    async generateDailyMemory(input: GenerateDailyMemoryInput): Promise<GeneratedDailyMemory> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
      });

      return provider.generateDailyMemory(input, getProviderOptions(settings));
    },

    async generateWeeklyReport(input: WeeklyReportSourceInput): Promise<GeneratedReportContent> {
      return generateRangeReport({
        reportType: 'weekly',
        ...input,
      });
    },

    generateRangeReport,

    async analyzeReportStyle(input: AnalyzeReportStyleInput): Promise<AnalyzedReportStyle> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
      });

      if (!provider.analyzeReportStyle) {
        throw new Error('当前 AI 服务暂不支持风格分析。');
      }

      return provider.analyzeReportStyle(input, getProviderOptions(settings));
    },

    async suggestClarifications(input: SuggestClarificationsInput): Promise<string[]> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
      });

      if (!provider.suggestClarifications) {
        throw new Error('当前 AI 服务暂不支持追问。');
      }

      return provider.suggestClarifications(input, getProviderOptions(settings));
    },

    async suggestThreadLink(input: SuggestThreadLinkInput): Promise<ThreadLinkSuggestion> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
      });

      if (!provider.suggestThreadLink) {
        throw new Error('当前 AI 服务暂不支持线索归并建议。');
      }

      return provider.suggestThreadLink(input, getProviderOptions(settings));
    },

    async checkHealth(): Promise<ProviderHealth> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
      });

      if (!provider.checkHealth) {
        return {
          status: 'unavailable',
          message: '配置异常',
          detail: '当前 AI 服务暂不可用。',
        };
      }

      return provider.checkHealth(getProviderOptions(settings));
    },
  };
}

export const aiService = createAIService();

function getProviderForSettings(
  settings: AppSettings,
  providers: {
    codexProvider: AIProvider;
    openAICompatibleProvider: AIProvider;
  },
) {
  if (settings.aiProviderId === currentProviderId) {
    return providers.codexProvider;
  }

  if (settings.aiProviderId === openAICompatibleProvider.id) {
    return providers.openAICompatibleProvider;
  }

  const provider = providersById.get(settings.aiProviderId);

  if (!provider || provider.id === 'mock') {
    // Never silently fall back to Mock for user data; failures should be visible and recoverable.
    throw new Error('当前 AI 服务配置异常，请重新选择服务。');
  }

  return provider;
}

function getProviderOptions(settings: AppSettings) {
  return {
    codexCommand: settings.codexCommand,
    codexModel: settings.codexModel,
    openAICompatible: settings.openAICompatible,
  };
}
