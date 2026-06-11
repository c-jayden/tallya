import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LocalGatewaySettingsSection', () => {
  const source = readFileSync(
    new URL('../local-gateway-settings-section.tsx', import.meta.url),
    'utf8',
  );

  it('is a single switch plus on-demand fields, not a new provider', () => {
    expect(source).toContain('优先使用本地网关');
    expect(source).toContain('网关地址');
    expect(source).toContain('网关模型');
    expect(source).toContain('enabled ?');
    expect(source).not.toContain('onCheckLocalGateway');
    expect(source).not.toContain("value: 'cc-switch'");
    expect(source).not.toContain("value: 'codex-proxy'");
  });

  it('keeps restrained fallback and risk notes', () => {
    expect(source).toContain('不可用时自动回退');
    expect(source).toContain('cc-switch / codex-proxy');
    expect(source).toContain('非官方用法');
    expect(source).toContain('自行评估');
    expect(source).not.toContain('立即');
    expect(source).not.toContain('马上');
  });

  it('uses approachable placeholders for gateway fields', () => {
    expect(source).toContain('placeholder="例如 http://localhost:8080"');
    expect(source).toContain('placeholder="网关使用的模型名"');
  });
});
