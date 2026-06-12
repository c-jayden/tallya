import { describe, expect, it } from 'vitest';

import { getOpenAIProviderPreset } from '../known-openai-providers';
import {
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  getKnownProviderModels,
} from '../known-models';

describe('known-models', () => {
  it('tracks currently recommended Codex CLI models', () => {
    expect(getKnownProviderModels('ai-codex-cli').map((model) => model.value)).toEqual([
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.3-codex-spark',
    ]);
  });

  it('keeps the OpenAI-compatible default aligned with the OpenAI preset', () => {
    expect(DEFAULT_OPENAI_COMPATIBLE_MODEL).toBe(getOpenAIProviderPreset('openai')?.defaultModel);
  });
});
