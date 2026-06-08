import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  GenerateDailyMemoryInput,
  RangeReportSourceInput,
  WeeklyReportSourceInput,
} from '../../types';
import { appSettingsRepository, type AppSettings } from '../app-settings-repository';
import { type AIProvider, type ProviderHealth } from './ai-provider';
import { codexCliProvider } from './codex-cli-provider';
import { mockProvider } from './mock-provider';

type SettingsRepository = {
  getSettings: typeof appSettingsRepository.getSettings;
};

type CreateAIServiceOptions = {
  settingsRepository?: SettingsRepository;
  codexProvider?: AIProvider;
};

const providers = [codexCliProvider, mockProvider];
const providersById = new Map<string, AIProvider>(
  providers.map((provider) => [provider.id, provider]),
);

// User-facing settings expose only real providers; Mock stays registered for tests and local dev.
export const currentProviderId = 'ai-codex-cli';

export function createAIService({
  settingsRepository = appSettingsRepository,
  codexProvider = codexCliProvider,
}: CreateAIServiceOptions = {}) {
  async function generateRangeReport(input: RangeReportSourceInput): Promise<GeneratedReportContent> {
    const settings = await settingsRepository.getSettings();
    const provider = getProviderForSettings(settings, codexProvider);

    return provider.generateRangeReport(
      {
        ...input,
        reportLength: settings.reportLength,
        reportTone: settings.reportTone,
        reportFocus: settings.reportFocus,
      },
      {
        codexCommand: settings.codexCommand,
        codexModel: settings.codexModel,
      },
    );
  }

  return {
    getCurrentProvider(): AIProvider {
      return codexProvider;
    },

    getProviderById(providerId: string): AIProvider {
      const provider =
        providerId === currentProviderId ? codexProvider : providersById.get(providerId);

      if (!provider) {
        throw new Error(`AI Provider "${providerId}" is not registered.`);
      }

      return provider;
    },

    async generateDailyMemory(input: GenerateDailyMemoryInput): Promise<GeneratedDailyMemory> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, codexProvider);

      return provider.generateDailyMemory(input, {
        codexCommand: settings.codexCommand,
        codexModel: settings.codexModel,
      });
    },

    async generateWeeklyReport(input: WeeklyReportSourceInput): Promise<GeneratedReportContent> {
      return generateRangeReport({
        reportType: 'weekly',
        ...input,
      });
    },

    generateRangeReport,

    async checkHealth(): Promise<ProviderHealth> {
      const settings = await settingsRepository.getSettings();
      const provider = getProviderForSettings(settings, codexProvider);

      if (!provider.checkHealth) {
        return {
          status: 'unavailable',
          message: '配置异常',
          detail: '当前 AI 服务暂不可用。',
        };
      }

      return provider.checkHealth({
        codexCommand: settings.codexCommand,
        codexModel: settings.codexModel,
      });
    },
  };
}

export const aiService = createAIService();

function getProviderForSettings(settings: AppSettings, codexProvider: AIProvider) {
  if (settings.aiProviderId === currentProviderId) {
    return codexProvider;
  }

  const provider = providersById.get(settings.aiProviderId);

  if (!provider || provider.id === 'mock') {
    // Never silently fall back to Mock for user data; failures should be visible and recoverable.
    throw new Error('当前 AI 服务配置异常，请重新选择服务。');
  }

  return provider;
}
