import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';
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

export const currentProviderId = 'ai-codex-cli';

export function createAIService({
  settingsRepository = appSettingsRepository,
  codexProvider = codexCliProvider,
}: CreateAIServiceOptions = {}) {
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
      });
    },

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
    throw new Error('当前 AI 服务配置异常，请重新选择服务。');
  }

  return provider;
}
