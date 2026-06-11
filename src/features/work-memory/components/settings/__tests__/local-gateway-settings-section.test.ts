import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LocalGatewaySettingsSection', () => {
  const source = readFileSync(
    new URL('../local-gateway-settings-section.tsx', import.meta.url),
    'utf8',
  );

  it('renders the local gateway controls without introducing a new provider id', () => {
    expect(source).toContain('本地 AI 网关');
    expect(source).toContain('网关地址');
    expect(source).toContain('模型');
    expect(source).toContain('接口模式');
    expect(source).toContain('检测');
    expect(source).toContain('onCheckLocalGateway');
    expect(source).not.toContain("value: 'cc-switch'");
    expect(source).not.toContain("value: 'codex-proxy'");
  });

  it('uses restrained Chinese notes for fallback and risk', () => {
    expect(source).toContain('没有本地网关也没关系，会继续使用 Codex CLI');
    expect(source).toContain('运行 codex-proxy');
    expect(source).toContain('cc-switch 开放 OpenAI 兼容端点');
    expect(source).toContain('非官方用法');
    expect(source).toContain('自行评估');
    expect(source).not.toContain('立即');
    expect(source).not.toContain('马上');
    expect(source).not.toContain('日报');
  });

  it('uses approachable placeholders for local gateway fields', () => {
    expect(source).toContain('placeholder="例如 http://localhost:8080"');
    expect(source).toContain('placeholder="填网关里显示的模型名"');
  });

  it('keeps clickable segmented controls cursor-aware', () => {
    expect(source).toContain('h-8 cursor-pointer rounded-lg bg-transparent px-3.5');
    expect(source).toContain('disabled:cursor-not-allowed');
  });
});
