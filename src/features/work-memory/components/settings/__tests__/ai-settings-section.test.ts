import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AISettingsSection', () => {
  const source = readFileSync(new URL('../ai-settings-section.tsx', import.meta.url), 'utf8');

  it('offers Codex CLI and OpenAI-compatible services without exposing Mock', () => {
    expect(source).toContain("label: 'Codex CLI'");
    expect(source).toContain("label: 'OpenAI 兼容服务'");
    expect(source).toContain("label: 'Claude / Anthropic'");
    expect(source).not.toContain("label: 'Mock'");
    expect(source).not.toContain("value: 'cc-switch'");
    expect(source).not.toContain("value: 'codex-proxy'");
  });

  it('picks a service first and only shows the chosen service fields', () => {
    expect(source).toContain('label="AI 服务"');
    expect(source).toContain('isCodexProvider ?');
    expect(source).toContain('DeepSeek');
    expect(source).toContain('Kimi');
    expect(source).toContain('OpenRouter');
    expect(source).toContain('OpenAI');
  });

  it('keeps Anthropic out of OpenAI-compatible presets', () => {
    expect(source).toContain('openAICompatibleProviderPresets.map');
    expect(source).not.toContain('claude` 预设');
  });

  it('demotes the local gateway to an advanced switch, not a co-equal route', () => {
    expect(source).toContain('<LocalGatewaySettingsSection');
    expect(source).toContain('<details');
    expect(source).toContain('高级');
    expect(source).not.toContain('回退服务');
    expect(source).not.toContain('当前使用路径');
  });

  it('keeps API Key in a password input with a warm placeholder', () => {
    expect(source).toContain('label="密钥"');
    expect(source).toContain('type="password"');
    expect(source).toContain('placeholder="粘贴服务商提供的 API Key"');
    expect(source).not.toContain('placeholder="sk-xxxxxx"');
  });

  it('uses a segmented control for interface mode and stores config via settings patches', () => {
    expect(source).toContain('接口模式');
    expect(source).toContain('Chat Completions');
    expect(source).toContain('Responses API');
    expect(source).toContain('apiMode: mode');
    expect(source).toContain('baseUrl: event.target.value');
    expect(source).toContain('apiKey: event.target.value');
    expect(source).toContain('model: event.target.value');
  });

  it('lets OpenAI-compatible users tune optional request parameters', () => {
    expect(source).toContain('请求参数');
    expect(source).toContain('temperature');
    expect(source).toContain('topP');
    expect(source).toContain('presencePenalty');
    expect(source).toContain('frequencyPenalty');
    expect(source).toContain('maxTokens');
    expect(source).toContain('max_tokens');
  });

  it('shows Anthropic-specific settings without OpenAI interface mode controls', () => {
    expect(source).toContain('isAnthropicProvider');
    expect(source).toContain('settings.anthropic.baseUrl');
    expect(source).toContain('settings.anthropic.apiKey');
    expect(source).toContain('settings.anthropic.model');
    expect(source).toContain('anthropic-version');
    expect(source).toContain('response_format');
  });
});
