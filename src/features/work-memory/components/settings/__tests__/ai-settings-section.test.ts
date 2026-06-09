import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AISettingsSection', () => {
  const source = readFileSync(new URL('../ai-settings-section.tsx', import.meta.url), 'utf8');

  it('shows Codex CLI and OpenAI Compatible without exposing Mock', () => {
    expect(source).toContain("label: 'Codex CLI'");
    expect(source).toContain("label: 'OpenAI Compatible'");
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

  it('uses the shared OpenAI Compatible default model placeholder', () => {
    expect(source).toContain('placeholder={DEFAULT_OPENAI_COMPATIBLE_MODEL}');
    expect(source).not.toContain('placeholder="gpt-4.1-mini"');
  });

  it('stores OpenAI Compatible configuration through settings patches', () => {
    expect(source).toContain('openAICompatible');
    expect(source).toContain('baseUrl: event.target.value');
    expect(source).toContain('apiKey: event.target.value');
    expect(source).toContain('model: event.target.value');
  });
});
