import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useSettingsDialogState', () => {
  const source = readFileSync(new URL('../use-settings-dialog-state.ts', import.meta.url), 'utf8');

  it('shows a friendly toast when opening the data directory fails', () => {
    expect(source).toContain("toast.error('打开数据目录失败')");
    expect(source).toContain("console.error('Failed to open data directory', error)");
  });

  it('does not treat cancelled backup file selection as an import error', () => {
    expect(source).toContain('if (payload) {');
    expect(source).toContain('setIsImportConfirmOpen(true)');
  });
});
