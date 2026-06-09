import { describe, expect, it } from 'vitest';
import { getShortcutModifierLabel, isMacPlatform } from '../platform';

describe('platform shortcut labels', () => {
  it('detects macOS and uses the command symbol', () => {
    expect(isMacPlatform({ platform: 'MacIntel', userAgent: '' })).toBe(true);
    expect(getShortcutModifierLabel({ platform: 'MacIntel', userAgent: '' })).toBe('⌘');
  });

  it('uses Ctrl for Windows and Linux platforms', () => {
    expect(getShortcutModifierLabel({ platform: 'Win32', userAgent: '' })).toBe('Ctrl');
    expect(getShortcutModifierLabel({ platform: 'Linux x86_64', userAgent: '' })).toBe('Ctrl');
  });

  it('defaults to Ctrl when the platform cannot be detected', () => {
    expect(getShortcutModifierLabel({ platform: '', userAgent: '' })).toBe('Ctrl');
  });
});
