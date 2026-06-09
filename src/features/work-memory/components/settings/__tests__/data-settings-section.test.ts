import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('DataSettingsSection diagnostics', () => {
  const source = readFileSync(new URL('../data-settings-section.tsx', import.meta.url), 'utf8');

  it('shows diagnostic log actions and detailed logging switch', () => {
    expect(source).toContain('诊断日志');
    expect(source).toContain('打开日志目录');
    expect(source).toContain('导出诊断日志');
    expect(source).toContain('启用详细诊断日志');
  });
});
