import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';
import { type AIProvider } from './ai-provider';
import { codexCliProvider } from './codex-cli-provider';
import { mockProvider } from './mock-provider';

const providers = [codexCliProvider, mockProvider];
const providersById = new Map(providers.map((provider) => [provider.id, provider]));

// Keep this as a single switch until a settings page owns provider selection.
export const currentProviderId = 'codex-cli';

function getCurrentProvider() {
  const provider = providersById.get(currentProviderId);

  if (!provider) {
    throw new Error(`AI Provider "${currentProviderId}" is not registered.`);
  }

  return provider;
}

export const aiService = {
  getCurrentProvider(): AIProvider {
    return getCurrentProvider();
  },

  generateDailyMemory(input: GenerateDailyMemoryInput): Promise<GeneratedDailyMemory> {
    return getCurrentProvider().generateDailyMemory(input);
  },
};
