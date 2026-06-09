import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AISettingsSection', () => {
  const source = readFileSync(new URL('../ai-settings-section.tsx', import.meta.url), 'utf8');

  it('shows Codex CLI and OpenAI Compatible without exposing Mock', () => {
    expect(source).toContain("label: 'Codex CLI'");
    expect(source).toContain("label: 'OpenAI Compatible'");
    expect(source).toContain("description: '使用本机 Codex CLI。'");
    expect(source).toContain("description: '填写 OpenAI 兼容服务、CC Switch 或公司网关。'");
    expect(source).not.toContain('如果该 Provider 是 Claude / Anthropic 格式');
    expect(source).not.toContain("label: 'Mock'");
  });

  it('keeps API Key in a password input', () => {
    expect(source).toContain('label="API Key"');
    expect(source).toContain('type="password"');
  });

  it('uses the requested API Key placeholder without exposing a real key', () => {
    expect(source).toContain('placeholder="sk-xxxxxx"');
    expect(source).not.toContain('placeholder="sk-..."');
  });

  it('uses a lighter placeholder color for OpenAI Compatible inputs', () => {
    expect(source).toContain("const openAIInputClassName = 'placeholder:text-slate-400'");
    expect(source.match(/className={openAIInputClassName}/g)).toHaveLength(3);
  });

  it('uses a segmented control for API Key interface mode', () => {
    expect(source).toContain('接口模式');
    expect(source).toContain('Chat Completions');
    expect(source).toContain('Responses API');
    expect(source).toContain('apiMode: mode');
    expect(source).toContain('inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted');
    expect(source).toContain('h-8 cursor-pointer rounded-lg bg-transparent px-3.5');
    expect(source).toContain('常用兼容接口。');
    expect(source).toContain('仅支持 /v1/responses 时使用。');
    expect(source).not.toContain('SelectValue placeholder="接口模式"');
  });

  it('mentions CC Switch responses errors without making it a provider', () => {
    expect(source).toContain('CC Switch');
    expect(source).toContain('only /v1/responses');
    expect(source).toContain('切换到 Responses API');
    expect(source).not.toContain("value: 'cc-switch'");
  });

  it('uses the shared OpenAI Compatible default model placeholder', () => {
    expect(source).toContain('placeholder={DEFAULT_OPENAI_COMPATIBLE_MODEL}');
    expect(source).not.toContain('placeholder="gpt-4.1-mini"');
  });

  it('stores OpenAI Compatible configuration through settings patches', () => {
    expect(source).toContain('openAICompatible');
    expect(source).toContain('baseUrl: event.target.value');
    expect(source).toContain('apiKey: event.target.value');
    expect(source).toContain('model: event.target.value');
    expect(source).toContain('apiMode: mode');
  });
});
