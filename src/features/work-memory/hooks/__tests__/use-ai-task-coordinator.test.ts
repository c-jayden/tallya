import { describe, expect, it, vi } from 'vitest';
import type { MainWindowState } from '../../services/window-service';
import {
  createAiTask,
  createCloseBlockedAlert,
  notifyIfWindowNotForeground,
} from '../use-ai-task-coordinator';

describe('ai task coordinator helpers', () => {
  it('does not notify when Tallya is the foreground window', async () => {
    const sendNotification = vi.fn<() => Promise<void>>(async () => undefined);

    await expect(
      notifyIfWindowNotForeground(createAiTask('range-report', 'completed'), {
        getMainWindowState: async () => foregroundWindow,
        sendNotification,
      }),
    ).resolves.toBe(false);

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('notifies when Tallya is hidden or not focused', async () => {
    const sendNotification = vi.fn<() => Promise<void>>(async () => undefined);

    await expect(
      notifyIfWindowNotForeground(createAiTask('range-report', 'completed'), {
        getMainWindowState: async () => hiddenWindow,
        sendNotification,
      }),
    ).resolves.toBe(true);

    expect(sendNotification).toHaveBeenCalledWith('整理好了，点击查看。');
  });

  it('uses a needs-input notification when report gaps need user input', async () => {
    const sendNotification = vi.fn<() => Promise<void>>(async () => undefined);

    await notifyIfWindowNotForeground(createAiTask('report-gaps', 'needs-input'), {
      getMainWindowState: async () => ({ visible: true, minimized: false, focused: false }),
      sendNotification,
    });

    expect(sendNotification).toHaveBeenCalledWith('整理需要补充一点信息，点击继续。');
  });

  it('creates a persistent close-blocked alert when close-to-tray is disabled', () => {
    expect(createCloseBlockedAlert()).toEqual({
      id: 'ai-close-blocked',
      tone: 'warning',
      message: '正在整理，先等它完成后再关闭。',
      actionLabel: '继续等待',
    });
  });
});

const foregroundWindow: MainWindowState = {
  visible: true,
  minimized: false,
  focused: true,
};

const hiddenWindow: MainWindowState = {
  visible: false,
  minimized: false,
  focused: false,
};
