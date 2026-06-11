import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportDetailDialog copy', () => {
  it('does not render the saved-report description', () => {
    const source = readFileSync(new URL('../report-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('这是已保存的工作报告。');
  });

  it('shows a light stale hint when the report needs regeneration', () => {
    const source = readFileSync(new URL('../report-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('这份整理引用的工作记忆已更新，可以重新整理一次。');
    expect(source).toContain("report?.status === 'stale'");
  });

  it('keeps the regenerate button on the standard Button size system', () => {
    const detailSource = readFileSync(new URL('../report-detail-dialog.tsx', import.meta.url), 'utf8');
    const previewSource = readFileSync(new URL('../report-preview-dialog.tsx', import.meta.url), 'utf8');

    expect(detailSource).not.toContain('h-9 min-w-28');
    expect(detailSource).not.toContain('rounded-xl');
    expect(detailSource).not.toContain('px-3.5');
    expect(previewSource).not.toContain('h-9 min-w-24');
    expect(previewSource).not.toContain('rounded-xl');
    expect(previewSource).not.toContain('px-3.5');
    expect(detailSource).toContain('bg-app-accent text-app-accent-ink');
    expect(previewSource).toContain('bg-app-accent text-app-accent-ink');
  });
});
