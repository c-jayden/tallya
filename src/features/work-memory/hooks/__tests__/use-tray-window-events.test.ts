import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useTrayWindowEvents', () => {
  const source = readFileSync(new URL('../use-tray-window-events.ts', import.meta.url), 'utf8');

  it('forwards hidden and close-blocked events to the caller', () => {
    expect(source).toContain('onWindowHidden?: () => void');
    expect(source).toContain('onCloseBlocked?: () => void');
    expect(source).toContain('handlersRef.current.onWindowHidden?.()');
    expect(source).toContain('handlersRef.current.onCloseBlocked?.()');
  });
});
