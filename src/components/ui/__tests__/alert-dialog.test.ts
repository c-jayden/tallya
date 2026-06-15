import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AlertDialog', () => {
  it('uses the same footer surface as Tallya dialogs', () => {
    const source = readFileSync(new URL('../alert-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('border-t border-app-border bg-app-surface');
    expect(source).not.toContain('bg-muted/50');
  });
});
