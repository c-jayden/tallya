import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TallyaDialogFooter', () => {
  it('uses the shared dialog footer surface and border classes', () => {
    const source = readFileSync(new URL('./tallya-dialog-footer.tsx', import.meta.url), 'utf8');

    expect(source).toContain('border-t border-app-border bg-app-surface px-6 py-3');
    expect(source).not.toContain('color-mix');
  });
});
