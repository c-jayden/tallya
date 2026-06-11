import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AISettingsSection', () => {
  const source = readFileSync(new URL('../ai-settings-section.tsx', import.meta.url), 'utf8');

  it('offers Codex CLI and OpenAI-compatible services without exposing Mock', () => {
    expect(source).toContain("label: 'Codex CLI'");
    expect(source).toContain("label: 'OpenAI 兼容服务'");
    expect(source).not.toContain("label: 'Mock'");
    expect(source).not.toContain("value: 'cc-switch'");
    expect(source).not.toContain("value: 'codex-proxy'");
  });

  it('picks a service first and only shows the chosen service fields', () => {
    expect(source).toContain('label="AI 服务"');
    // Codex -> model select; OpenAI-compatible -> preset/url/key/model under isCodexProvider branch
    expect(source).toContain('isCodexProvider ?');
    expect(source).toContain('已内置 DeepSeek、通义、Kimi、OpenRouter、OpenAI');
  });

  it('demotes the local gateway to an advanced switch, not a co-equal route', () => {
    expect(source).toContain('<LocalGatewaySettingsSection');
    expect(source).toContain('<details');
    expect(source).toContain('高级');
    // No more "回退服务 / 当前使用路径" plumbing leaking into the UI.
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
});
