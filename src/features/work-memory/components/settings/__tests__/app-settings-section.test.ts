import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppSettingsSection', () => {
  const source = readFileSync(new URL('../app-settings-section.tsx', import.meta.url), 'utf8');

  it('keeps shortcuts out of the application settings section', () => {
    expect(source).not.toContain('快捷键');
    expect(source).not.toContain('Ctrl/Cmd + K');
    expect(source).not.toContain('搜索记忆');
  });
});
