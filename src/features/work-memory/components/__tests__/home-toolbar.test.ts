import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HomeToolbar date picker entry', () => {
  it('uses the shared shadcn date picker entry', () => {
    const source = readFileSync(new URL('../home-toolbar.tsx', import.meta.url), 'utf8');

    expect(source).toContain('DatePickerPopover');
    expect(source).toContain('onDateChange');
    expect(source).toContain('cursor-pointer');
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('showPicker');
  });
});
