import { describe, expect, it } from 'vitest';
import {
  CUSTOM_OPENAI_PROVIDER_ID,
  getOpenAIProviderPreset,
  matchOpenAIProviderPreset,
  openAICompatibleProviderPresets,
} from '../known-openai-providers';
import { normalizeOpenAICompatibleBaseUrl } from '../openai-compatible-provider';

describe('known OpenAI-compatible providers', () => {
  it('lists DeepSeek first by popularity and includes 自定义 fallback id', () => {
    expect(openAICompatibleProviderPresets[0].id).toBe('deepseek');
    expect(getOpenAIProviderPreset(CUSTOM_OPENAI_PROVIDER_ID)).toBeNull();
  });

  it('keeps non-general API providers out of OpenAI-compatible presets', () => {
    const presetIds = openAICompatibleProviderPresets.map((preset) => preset.id);

    expect(presetIds).not.toContain('anthropic');
    expect(presetIds).not.toContain('kimi-code');
    expect(getOpenAIProviderPreset('kimi-code')).toBeNull();
  });

  it('separates Kimi global and China presets because their API keys use different hosts', () => {
    expect(getOpenAIProviderPreset('moonshot-cn')).toMatchObject({
      label: 'Kimi CN',
      baseUrl: 'https://api.moonshot.cn/v1',
      defaultModel: 'kimi-k2.6',
      apiMode: 'chat-completions',
      parameters: {
        temperature: '1',
        topP: '0.95',
        presencePenalty: '0',
        frequencyPenalty: '0',
      },
    });
    expect(getOpenAIProviderPreset('moonshot')).toMatchObject({
      label: 'Kimi',
      baseUrl: 'https://api.moonshot.ai/v1',
    });
  });

  it('prefills request parameters only where the preset needs them', () => {
    expect(getOpenAIProviderPreset('moonshot')).toMatchObject({
      defaultModel: 'kimi-k2.6',
      parameters: {
        temperature: '1',
        topP: '0.95',
        presencePenalty: '0',
        frequencyPenalty: '0',
      },
    });
    expect(getOpenAIProviderPreset('deepseek')?.parameters).toBeUndefined();
  });

  it('documents provider JSON mode and token-limit source notes in preset hints', () => {
    expect(getOpenAIProviderPreset('qwen')?.hint).toContain('来源');
    expect(getOpenAIProviderPreset('moonshot')?.hint).toContain('fixed value 1.0');
    expect(getOpenAIProviderPreset('zhipu')?.hint).toContain('glm-4.5');
    expect(getOpenAIProviderPreset('volcengine')?.hint).toContain('默认 4k');
    expect(getOpenAIProviderPreset('siliconflow')?.hint).toContain('max_tokens');
    expect(getOpenAIProviderPreset('openai')?.hint).toContain('/v1/responses');
  });

  it('matches a saved Base URL back to its preset, normalizing /v1', () => {
    // DeepSeek's preset URL has no /v1; normalization adds it, and a saved URL
    // with /v1 still matches.
    expect(matchOpenAIProviderPreset('https://api.deepseek.com')).toBe('deepseek');
    expect(matchOpenAIProviderPreset('https://api.deepseek.com/v1/')).toBe('deepseek');
    expect(matchOpenAIProviderPreset('https://example.com/v1')).toBe(CUSTOM_OPENAI_PROVIDER_ID);
    expect(matchOpenAIProviderPreset('')).toBe(CUSTOM_OPENAI_PROVIDER_ID);
    expect(matchOpenAIProviderPreset('https://api.moonshot.cn/v1')).toBe('moonshot-cn');
    expect(matchOpenAIProviderPreset('https://api.moonshot.ai/v1')).toBe('moonshot');
    expect(matchOpenAIProviderPreset('https://api.kimi.com/coding/v1')).toBe(
      CUSTOM_OPENAI_PROVIDER_ID,
    );
  });

  it('keeps non-/v1 versioned paths intact so Zhipu and Volcengine work', () => {
    expect(normalizeOpenAICompatibleBaseUrl('https://open.bigmodel.cn/api/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/paas/v4',
    );
    expect(normalizeOpenAICompatibleBaseUrl('https://ark.cn-beijing.volces.com/api/v3')).toBe(
      'https://ark.cn-beijing.volces.com/api/v3',
    );
    expect(matchOpenAIProviderPreset('https://open.bigmodel.cn/api/paas/v4')).toBe('zhipu');
  });

  it('appends /v1 only when no version segment is present', () => {
    expect(normalizeOpenAICompatibleBaseUrl('https://api.deepseek.com')).toBe(
      'https://api.deepseek.com/v1',
    );
  });
});
