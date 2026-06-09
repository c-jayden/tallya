import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('SettingsDialog', () => {
  const source = readFileSync(new URL('../settings-dialog.tsx', import.meta.url), 'utf8');

  it('keeps settings open while the backup file picker is active', () => {
    expect(source).toContain('!nextOpen && settingsState.isImportingBackup');
    expect(source).toContain('settingsState.resetTransientState()');
  });

  it('requires confirmation before exporting diagnostic logs', () => {
    expect(source).toContain('ExportDiagnosticLogConfirmDialog');
    expect(source).toContain('settingsState.exportDiagnosticLog');
  });
});
