import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportGenerateDialog layout', () => {
  it('keeps the footer outside the scrollable body', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');
    const bodyIndex = source.indexOf('<TallyaScrollArea className="min-h-0 flex-1');
    const footerIndex = source.indexOf('<TallyaDialogFooter>');

    expect(bodyIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(bodyIndex);
    expect(source).not.toContain('DialogFooter className=');
  });
});
