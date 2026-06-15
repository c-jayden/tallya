import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('DailyReportDialog', () => {
  const source = readFileSync(new URL('../daily-report-dialog.tsx', import.meta.url), 'utf8');

  it('renders AI status inside the dialog instead of the home page', () => {
    expect(source).toContain('<WorkMemoryAlerts');
    expect(source).toContain('aiAlert');
  });

  it('asks before closing while AI整理 is still running', () => {
    expect(source).toContain('isCloseConfirmOpen');
    expect(source).toContain('正在整理，要关闭吗？');
    expect(source).toContain('onForceClose');
    expect(source).toContain('preventReportDialogDismissWhenBusy(isGenerating');
  });
});
