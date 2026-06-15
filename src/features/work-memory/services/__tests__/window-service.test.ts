import { describe, expect, it } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import {
  getMainWindowState,
  isMainWindowForeground,
  sendTallyaNotification,
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
});
