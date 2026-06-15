import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('DailyReportDialog', () => {
  const source = readFileSync(new URL('../daily-report-dialog.tsx', import.meta.url), 'utf8');
  const confirmDialogSource = readFileSync(
    new URL('../ai-busy-close-confirm-dialog.tsx', import.meta.url),
    'utf8',
  );

  it('renders AI status inside the dialog instead of the home page', () => {
    expect(source).toContain('<WorkMemoryAlerts');
    expect(source).toContain('aiAlert');
    expect(source).toContain('onDismissAlert: () => void');
    expect(source).toContain('onDismiss={onDismissAlert}');
  });

  it('asks before closing while AI整理 is still running', () => {
    expect(source).toContain('isCloseConfirmOpen');
    expect(confirmDialogSource).toContain('正在整理，要关闭吗？');
    expect(source).toContain('onForceClose');
    expect(source).toContain('preventReportDialogDismissWhenBusy(isGenerating');
  });

  it('can reuse the dialog close confirmation for native app close requests', () => {
    expect(source).toContain('closeRequestId?: number');
    expect(source).toContain('onAfterForceClose?: () => void');
    expect(source).toContain('handledCloseRequestIdRef');
    expect(source).toContain('requestClose(onAfterForceClose)');
    expect(source).toContain('<AiBusyCloseConfirmDialog');
  });

  it('uses a single primary action and icons for important actions', () => {
    expect(source.match(/variant="accent"/g)?.length).toBe(1);
    expect(source).toContain('Copy');
    expect(source).toContain('<Copy');
    expect(source).toContain('<Sparkles');
  });
});
