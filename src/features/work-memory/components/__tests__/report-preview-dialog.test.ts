import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportPreviewDialog close policy', () => {
  const source = readFileSync(new URL('../report-preview-dialog.tsx', import.meta.url), 'utf8');

  it('keeps save-in-progress non-dismissible because it is a local write', () => {
    expect(source).toContain('closeButtonDisabled={isSaving}');
    expect(source).toContain('preventReportDialogDismissWhenBusy(isSaving');
    expect(source).toContain('disabled={isSaving}');
  });
});
