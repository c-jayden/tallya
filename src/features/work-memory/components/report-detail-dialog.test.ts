import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportDetailDialog copy', () => {
  it('does not render the saved-report description', () => {
    const source = readFileSync(new URL('./report-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('这是已保存的工作报告。');
  });
});
