import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportDetailDialog copy', () => {
  it('does not render the saved-report description', () => {
    const source = readFileSync(new URL('./report-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('这是已保存的工作报告。');
  });

  it('shows a light stale hint when the report needs regeneration', () => {
    const source = readFileSync(new URL('./report-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('这份报告引用的工作记忆已更新，建议重新生成。');
    expect(source).toContain("report?.status === 'stale'");
  });
});
