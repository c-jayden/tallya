import type {
  GeneratedDailyMemory,
  GeneratedReportContent,
  AnalyzedReportStyle,
  AnalyzeReportStyleInput,
  GenerateDailyMemoryInput,
  GenerateRangeReportInput,
  GenerateWeeklyReportInput,
  ReportGap,
  SuggestClarificationsInput,
  SuggestReportGapsInput,
  SuggestThreadLinkInput,
  ThreadLinkSuggestion,
} from '../../types';

export type AIProviderId = 'ai-codex-cli' | 'openai-compatible' | 'ollama';
export type OpenAICompatibleApiMode = 'chat-completions' | 'responses';

export type OpenAICompatibleParameters = {
  temperature: string;
  topP: string;
  presencePenalty: string;
  frequencyPenalty: string;
};

export type GenerateDailyMemoryOptions = {
  codexCommand: string;
  codexModel: string;
  openAICompatible?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    apiMode?: OpenAICompatibleApiMode;
    parameters?: OpenAICompatibleParameters;
  };
};

export type AIProviderOptions = GenerateDailyMemoryOptions;

export type ProviderHealth = {
  status: 'unknown' | 'checking' | 'available' | 'unavailable';
  message: string;
  detail?: string;
};

// Keep provider-specific details behind this boundary so Codex CLI can be
// replaced or joined by other local/user-configured services without UI churn.
export type AIProvider = {
  id: AIProviderId | 'mock';
  name: string;
  generateDailyMemory(
    input: GenerateDailyMemoryInput,
    options: AIProviderOptions,
  ): Promise<GeneratedDailyMemory>;
  generateWeeklyReport(
    input: GenerateWeeklyReportInput,
    options: AIProviderOptions,
  ): Promise<GeneratedReportContent>;
  generateRangeReport(
    input: GenerateRangeReportInput,
    options: AIProviderOptions,
  ): Promise<GeneratedReportContent>;
  analyzeReportStyle?(
    input: AnalyzeReportStyleInput,
    options: AIProviderOptions,
  ): Promise<AnalyzedReportStyle>;
  suggestClarifications?(
    input: SuggestClarificationsInput,
    options: AIProviderOptions,
  ): Promise<string[]>;
  suggestThreadLink?(
    input: SuggestThreadLinkInput,
    options: AIProviderOptions,
  ): Promise<ThreadLinkSuggestion>;
  suggestReportGaps?(
    input: SuggestReportGapsInput,
    options: AIProviderOptions,
  ): Promise<ReportGap[]>;
  checkHealth?(options: AIProviderOptions): Promise<ProviderHealth>;
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    cause?: unknown,
  ) {
    super(message);
    if (cause !== undefined) {
      Object.assign(this, { cause });
    }
    this.name = 'AIProviderError';
  }
}
