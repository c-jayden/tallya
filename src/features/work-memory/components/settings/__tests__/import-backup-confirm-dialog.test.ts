import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ImportBackupConfirmDialog close policy', () => {
  const source = readFileSync(new URL('../import-backup-confirm-dialog.tsx', import.meta.url), 'utf8');

  it('keeps import-in-progress non-dismissible because it overwrites local data', () => {
    expect(source).toContain('disabled={isImportingBackup}');
    expect(source).not.toContain('AiBusyCloseConfirmDialog');
  });
});
