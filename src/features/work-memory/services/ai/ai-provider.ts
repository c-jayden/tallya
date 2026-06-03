import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';

export type AIProvider = {
  id: string;
  name: string;
  generateDailyMemory(input: GenerateDailyMemoryInput): Promise<GeneratedDailyMemory>;
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
