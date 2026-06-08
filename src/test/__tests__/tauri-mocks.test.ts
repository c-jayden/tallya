import { describe, expect, it } from 'vitest';
import { emitTauriEvent, resetTauriMocks, tauriMocks } from '../tauri-mocks';

describe('tauri test mocks', () => {
  it('tracks invoke calls without reaching the real Tauri runtime', async () => {
    tauriMocks.invoke.mockResolvedValueOnce('ok');
    const { invoke } = await import('@tauri-apps/api/core');

    await expect(invoke('check_codex_cli', { command: 'codex' })).resolves.toBe('ok');
    expect(tauriMocks.invoke).toHaveBeenCalledWith('check_codex_cli', { command: 'codex' });
  });

  it('registers and clears event listeners between tests', async () => {
    const events: unknown[] = [];
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen('tray://open-search', (event) => events.push(event.payload));

    emitTauriEvent('tray://open-search', 'first');
    unlisten();
    emitTauriEvent('tray://open-search', 'second');

    expect(events).toEqual(['first']);
  });

  it('resets file dialog and fs mocks to safe defaults', async () => {
    tauriMocks.dialogSave.mockResolvedValueOnce('/tmp/backup.json');
    resetTauriMocks();
    const { save } = await import('@tauri-apps/plugin-dialog');

    await expect(save({ title: 'Backup' })).resolves.toBeNull();
  });
});
