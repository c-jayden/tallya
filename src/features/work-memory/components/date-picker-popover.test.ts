import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('DatePickerPopover layering', () => {
  it('renders the calendar popover above dialog content', () => {
    const source = readFileSync(new URL('./date-picker-popover.tsx', import.meta.url), 'utf8');

    expect(source).toContain('side="bottom"');
    expect(source).toContain('align="start"');
    expect(source).toContain('avoidCollisions');
    expect(source).toContain('collisionPadding={16}');
    expect(source).toContain('sticky="always"');
    expect(source).toContain('z-[80]');
  });

  it('uses the shadcn popover portal', () => {
    const source = readFileSync(
      new URL('../../../components/ui/popover.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('<PopoverPrimitive.Portal>');
    expect(source).toContain('<PopoverPrimitive.Content');
  });
});
