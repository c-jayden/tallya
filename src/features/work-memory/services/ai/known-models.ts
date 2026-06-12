import type { AIProviderId } from './ai-provider';

export const DEFAULT_CODEX_MODEL = 'gpt-5.4-mini';
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

export type AIModelOption = {
  value: string;
  label: string;
};

export const knownProviderModels: Record<AIProviderId, AIModelOption[]> = {
  'ai-codex-cli': [
    {
      value: 'gpt-5.5',
      label: 'GPT-5.5',
    },
    {
      value: 'gpt-5.4',
      label: 'GPT-5.4',
    },
    {
      value: 'gpt-5.4-mini',
      label: 'GPT-5.4-Mini',
    },
    {
      value: 'gpt-5.3-codex-spark',
      label: 'GPT-5.3-Codex-Spark',
    },
  ],
  'openai-compatible': [],
  anthropic: [],
};

export function getKnownProviderModels(providerId: AIProviderId) {
  return knownProviderModels[providerId] ?? [];
}

export function normalizeProviderModel(providerId: AIProviderId, model: string) {
  const models = getKnownProviderModels(providerId);

  return models.some((option) => option.value === model) ? model : (models[0]?.value ?? model);
}

export function getDefaultProviderModel(providerId: AIProviderId) {
  if (providerId === 'ai-codex-cli') {
    return DEFAULT_CODEX_MODEL;
  }

  if (providerId === 'openai-compatible') {
    return DEFAULT_OPENAI_COMPATIBLE_MODEL;
  }

  if (providerId === 'anthropic') {
    return DEFAULT_ANTHROPIC_MODEL;
  }

  return getKnownProviderModels(providerId)[0]?.value ?? '';
}
