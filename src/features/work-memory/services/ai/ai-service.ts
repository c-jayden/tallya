import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  AnalyzeReportStyleInput,
  AnalyzedReportStyle,
  GenerateDailyMemoryInput,
  RangeReportSourceInput,
  ReportGap,
  SuggestClarificationsInput,
  SuggestReportGapsInput,
  SuggestThreadLinkInput,
  ThreadLinkSuggestion,
  WeeklyReportSourceInput,
} from '../../types';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../app-settings-repository';
import { type AIProvider, type AIProviderOptions, type ProviderHealth } from './ai-provider';
import { anthropicProvider } from './anthropic-provider';
import { codexCliProvider } from './codex-cli-provider';
import { type GatewayProbeResult, probeLocalGateway } from './local-gateway';
import { mockProvider } from './mock-provider';
import { openAICompatibleProvider } from './openai-compatible-provider';

type SettingsRepository = {
  getSettings: typeof appSettingsRepository.getSettings;
};

type LocalGatewayProbe = (baseUrl: string) => Promise<GatewayProbeResult>;

type CreateAIServiceOptions = {
  settingsRepository?: SettingsRepository;
  codexProvider?: AIProvider;
  openAICompatibleProvider?: AIProvider;
  anthropicProvider?: AIProvider;
  localGatewayProbe?: LocalGatewayProbe;
  now?: () => number;
  localGatewayCacheTtlMs?: number;
};

type LocalGatewayProbeCache = {
  ts: number;
  baseUrl: string;
  reachable: boolean;
} | null;

type ResolvedProvider = {
  provider: AIProvider;
  options: AIProviderOptions;
  isLocalGateway: boolean;
  settings: AppSettings;
};

const providers = [codexCliProvider, openAICompatibleProvider, anthropicProvider, mockProvider];
const providersById = new Map<string, AIProvider>(
  providers.map((provider) => [provider.id, provider]),
);
const LOCAL_GATEWAY_CACHE_TTL_MS = 60_000;

// User-facing settings expose only real providers; Mock stays registered for tests and local dev.
export const currentProviderId = 'ai-codex-cli';

export function createAIService({
  settingsRepository = appSettingsRepository,
  codexProvider = codexCliProvider,
  openAICompatibleProvider: configuredOpenAICompatibleProvider = openAICompatibleProvider,
  anthropicProvider: configuredAnthropicProvider = anthropicProvider,
  localGatewayProbe = probeLocalGateway,
  now = () => Date.now(),
  localGatewayCacheTtlMs = LOCAL_GATEWAY_CACHE_TTL_MS,
}: CreateAIServiceOptions = {}) {
  let localGatewayProbeCache: LocalGatewayProbeCache = null;

  function getFallbackProvider(settings: AppSettings): ResolvedProvider {
    return {
      provider: getProviderForSettings(settings, {
        codexProvider,
        openAICompatibleProvider: configuredOpenAICompatibleProvider,
        anthropicProvider: configuredAnthropicProvider,
      }),
      options: getProviderOptions(settings),
      isLocalGateway: false,
      settings,
    };
  }

  async function getLocalGatewayReachability(settings: AppSettings) {
    const baseUrl = settings.localGateway.baseUrl;
    const cachedResult =
      localGatewayProbeCache &&
      localGatewayProbeCache.baseUrl === baseUrl &&
      now() - localGatewayProbeCache.ts < localGatewayCacheTtlMs
        ? localGatewayProbeCache
        : null;

    if (cachedResult) {
      return cachedResult.reachable;
    }

    const result = await localGatewayProbe(baseUrl);
    localGatewayProbeCache = {
      ts: now(),
      baseUrl,
      reachable: result.reachable,
    };

    return result.reachable;
  }

  function markLocalGatewayUnavailable(settings: AppSettings) {
    localGatewayProbeCache = {
      ts: now(),
      baseUrl: settings.localGateway.baseUrl,
      reachable: false,
    };
  }

  async function resolveProvider(settings: AppSettings): Promise<ResolvedProvider> {
    const fallbackProvider = getFallbackProvider(settings);

    if (!settings.localGateway.enabled) {
      return fallbackProvider;
    }

    const isReachable = await getLocalGatewayReachability(settings);

    if (!isReachable || !settings.localGateway.model.trim()) {
      return fallbackProvider;
    }

    return {
      provider: configuredOpenAICompatibleProvider,
      options: getLocalGatewayProviderOptions(settings),
      isLocalGateway: true,
      settings,
    };
  }

  async function runWithResolvedProvider<T>(
    settings: AppSettings,
    run: (provider: AIProvider, options: AIProviderOptions) => Promise<T>,
  ) {
    const resolvedProvider = await resolveProvider(settings);

    try {
      return await run(resolvedProvider.provider, resolvedProvider.options);
    } catch (error) {
      if (!resolvedProvider.isLocalGateway) {
        throw error;
      }

      markLocalGatewayUnavailable(resolvedProvider.settings);
      const fallbackProvider = getFallbackProvider(resolvedProvider.settings);

      return run(fallbackProvider.provider, fallbackProvider.options);
    }
  }

  async function generateRangeReport(input: RangeReportSourceInput): Promise<GeneratedReportContent> {
    const settings = await settingsRepository.getSettings();

    return runWithResolvedProvider(settings, (provider, options) =>
      provider.generateRangeReport(
        {
          ...input,
          reportLength: settings.reportLength,
          reportTone: settings.reportTone,
          reportFocus: settings.reportFocus,
          reportStyleHint: settings.reportStyleHint,
          reportStyleProfile: DEFAULT_APP_SETTINGS.reportStyleProfile,
        },
        options,
      ),
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

      return runWithResolvedProvider(settings, (provider, options) =>
        provider.generateDailyMemory(input, options),
      );
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

      return runWithResolvedProvider(settings, (provider, options) => {
        if (!provider.analyzeReportStyle) {
          throw new Error('当前 AI 服务暂不支持风格分析。');
        }

        return provider.analyzeReportStyle(input, options);
      });
    },

    async suggestClarifications(input: SuggestClarificationsInput): Promise<string[]> {
      const settings = await settingsRepository.getSettings();

      return runWithResolvedProvider(settings, (provider, options) => {
        if (!provider.suggestClarifications) {
          throw new Error('当前 AI 服务暂不支持追问。');
        }

        return provider.suggestClarifications(input, options);
      });
    },

    async suggestThreadLink(input: SuggestThreadLinkInput): Promise<ThreadLinkSuggestion> {
      const settings = await settingsRepository.getSettings();

      return runWithResolvedProvider(settings, (provider, options) => {
        if (!provider.suggestThreadLink) {
          throw new Error('当前 AI 服务暂不支持线索归并建议。');
        }

        return provider.suggestThreadLink(input, options);
      });
    },

    async suggestReportGaps(input: SuggestReportGapsInput): Promise<ReportGap[]> {
      const settings = await settingsRepository.getSettings();

      return runWithResolvedProvider(settings, (provider, options) => {
        if (!provider.suggestReportGaps) {
          throw new Error('当前 AI 服务暂不支持报告缺口检测。');
        }

        return provider.suggestReportGaps(input, options);
      });
    },

    async checkHealth(): Promise<ProviderHealth> {
      const settings = await settingsRepository.getSettings();
      const resolvedProvider = await resolveProvider(settings);

      if (!resolvedProvider.provider.checkHealth) {
        return {
          status: 'unavailable',
          message: '配置异常',
          detail: '当前 AI 服务暂不可用。',
        };
      }

      const health = await resolvedProvider.provider.checkHealth(resolvedProvider.options);

      if (!resolvedProvider.isLocalGateway || health.status !== 'unavailable') {
        return health;
      }

      markLocalGatewayUnavailable(resolvedProvider.settings);
      const fallbackProvider = getFallbackProvider(resolvedProvider.settings);

      if (!fallbackProvider.provider.checkHealth) {
        return {
          status: 'unavailable',
          message: '配置异常',
          detail: '当前 AI 服务暂不可用。',
        };
      }

      return fallbackProvider.provider.checkHealth(fallbackProvider.options);
    },
  };
}

export const aiService = createAIService();

function getProviderForSettings(
  settings: AppSettings,
  providers: {
    codexProvider: AIProvider;
    openAICompatibleProvider: AIProvider;
    anthropicProvider: AIProvider;
  },
) {
  if (settings.aiProviderId === currentProviderId) {
    return providers.codexProvider;
  }

  if (settings.aiProviderId === openAICompatibleProvider.id) {
    return providers.openAICompatibleProvider;
  }

  if (settings.aiProviderId === anthropicProvider.id) {
    return providers.anthropicProvider;
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
    anthropic: settings.anthropic,
  };
}

function getLocalGatewayProviderOptions(settings: AppSettings): AIProviderOptions {
  return {
    codexCommand: settings.codexCommand,
    codexModel: settings.codexModel,
    openAICompatible: {
      baseUrl: settings.localGateway.baseUrl,
      apiKey: 'local-gateway',
      model: settings.localGateway.model,
      apiMode: settings.localGateway.apiMode,
    },
    anthropic: settings.anthropic,
  };
}
