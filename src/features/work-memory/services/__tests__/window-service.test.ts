import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import {
  getMainWindowState,
  isMainWindowForeground,
  sendTallyaNotification,
  setActiveAiTaskRunning,
} from '../window-service';

describe('window-service', () => {
  it('reads the main window foreground state from Tauri', async () => {
    tauriMocks.invoke.mockResolvedValueOnce({
      visible: true,
      minimized: false,
      focused: true,
    });

    await expect(getMainWindowState()).resolves.toEqual({
      visible: true,
      minimized: false,
      focused: true,
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith('get_main_window_state');
  });

  it('treats only visible, unminimized, focused windows as foreground', () => {
    expect(isMainWindowForeground({ visible: true, minimized: false, focused: true })).toBe(true);
    expect(isMainWindowForeground({ visible: false, minimized: false, focused: true })).toBe(false);
    expect(isMainWindowForeground({ visible: true, minimized: true, focused: true })).toBe(false);
    expect(isMainWindowForeground({ visible: true, minimized: false, focused: false })).toBe(false);
  });

  it('sends Tallya system notifications through the Tauri command', async () => {
    await sendTallyaNotification('整理好了，可以查看。');

    expect(tauriMocks.invoke).toHaveBeenCalledWith('send_tallya_notification', {
      body: '整理好了，可以查看。',
    });
  });

  it('syncs active AI task state to Tauri close handling', async () => {
    await setActiveAiTaskRunning(true);

    expect(tauriMocks.invoke).toHaveBeenCalledWith('set_active_ai_task_running', {
      active: true,
    });
  });

  it('lets close-to-tray take precedence over AI close blocking in the native close handler', () => {
    const source = readFileSync(new URL('../../../../../src-tauri/src/lib.rs', import.meta.url), 'utf8');
    const shouldHideIndex = source.indexOf('if should_hide {');
    const shouldBlockIndex = source.indexOf('} else if should_block_close {');

    expect(shouldHideIndex).toBeGreaterThan(-1);
    expect(shouldBlockIndex).toBeGreaterThan(shouldHideIndex);
    expect(source).toContain('app_handle.emit(TRAY_EVENT_WINDOW_HIDDEN');
    expect(source).toContain('app_handle.emit(TRAY_EVENT_CLOSE_BLOCKED');
  });
});
