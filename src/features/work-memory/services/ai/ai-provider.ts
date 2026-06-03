import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';

export type AIProviderId = 'ai-codex-cli' | 'openai-compatible' | 'ollama';

export type GenerateDailyMemoryOptions = {
  codexCommand: string;
};

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
    options: GenerateDailyMemoryOptions,
  ): Promise<GeneratedDailyMemory>;
  checkHealth?(options: GenerateDailyMemoryOptions): Promise<ProviderHealth>;
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
