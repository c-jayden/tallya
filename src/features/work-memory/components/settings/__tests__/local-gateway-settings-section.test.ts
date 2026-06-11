import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LocalGatewaySettingsSection', () => {
  const source = readFileSync(
    new URL('../local-gateway-settings-section.tsx', import.meta.url),
    'utf8',
  );

  it('renders the local gateway controls without introducing a new provider id', () => {
    expect(source).toContain('本地 AI 网关');
    expect(source).toContain('自动使用本地网关');
    expect(source).toContain('本地网关高级设置');
    expect(source).toContain('网关地址');
    expect(source).toContain('网关模型');
    expect(source).toContain('接口模式');
    expect(source).not.toContain('onCheckLocalGateway');
    expect(source).not.toContain("value: 'cc-switch'");
    expect(source).not.toContain("value: 'codex-proxy'");
  });

  it('uses restrained Chinese notes for fallback and risk', () => {
    expect(source).toContain('打开后会自动探测本机网关，不可用时继续使用回退服务。');
    expect(source).toContain('codex-proxy');
    expect(source).toContain('cc-switch 开放 OpenAI 兼容端点');
    expect(source).toContain('非官方用法');
    expect(source).toContain('自行评估');
    expect(source).not.toContain('立即');
    expect(source).not.toContain('马上');
    expect(source).not.toContain('日报');
  });

  it('uses approachable placeholders for local gateway fields', () => {
    expect(source).toContain('placeholder="例如 http://localhost:8080"');
    expect(source).toContain('placeholder="留空时沿用回退服务的模型"');
  });

  it('hides gateway transport details behind native details disclosure', () => {
    expect(source).toContain('<details');
    expect(source).toContain('<summary');
    expect(source).toContain('本地网关高级设置');
    expect(source).toContain('ChevronRight');
    expect(source).toContain('group-open/local-gateway:rotate-90');
  });

  it('keeps clickable segmented controls cursor-aware', () => {
    expect(source).toContain('h-8 cursor-pointer rounded-lg bg-transparent px-3.5');
    expect(source).toContain('disabled:cursor-not-allowed');
  });
});
