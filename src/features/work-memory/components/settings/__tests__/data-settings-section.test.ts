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

  it('uses local-first copy instead of admin-style wording', () => {
    expect(source).toContain('本地数据');
    expect(source).toContain('备份一份');
    expect(source).toContain('从备份恢复');
    expect(source).toContain('本地文件位置');
    expect(source).toContain('清理本机数据');
    expect(source).not.toContain('数据管理');
    expect(source).not.toContain('危险操作');
  });
});
