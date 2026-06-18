import type { AppSettings } from './app-settings-repository';
import { logger } from './logger/logger';

export const trayEvents = {
  focusEntry: 'tray://focus-entry',
  openSearch: 'tray://open-search',
  openSettings: 'tray://open-settings',
  checkUpdate: 'tray://check-update',
  windowHidden: 'tray://window-hidden',
  closeBlocked: 'tray://close-blocked',
  openThreads: 'tray://open-threads',
} as const;

export type MainWindowState = {
  visible: boolean;
  minimized: boolean;
  focused: boolean;
};

type TrayEventHandlers = {
  onFocusEntry: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCheckUpdate: () => void;
  onWindowHidden: () => void;
  onCloseBlocked: () => void;
  onOpenThreads: () => void;
};

export async function showMainWindow() {
  await invokeWindowCommand('show_main_window');
}

export async function hideMainWindow() {
  await invokeWindowCommand('hide_main_window');
}

export async function focusMainWindow() {
  await showMainWindow();
}

export async function toggleMainWindow() {
  await invokeWindowCommand('toggle_main_window');
}

export async function quitApp() {
  await invokeWindowCommand('quit_app');
}

export async function getMainWindowState(): Promise<MainWindowState> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    return await invoke<MainWindowState>('get_main_window_state');
  } catch (error) {
    logger.warn('tray', 'window.state_failed', 'Failed to read window state', {
      error,
    });

    return { visible: false, minimized: false, focused: false };
  }
}

export function isMainWindowForeground(state: MainWindowState) {
  return state.visible && !state.minimized && state.focused;
}

export async function sendTallyaNotification(body: string) {
  const { invoke } = await import('@tauri-apps/api/core');

  await invoke('send_tallya_notification', { body });
}

// Same as sendTallyaNotification, but clicking the toast opens the threads hub
// (Windows only; elsewhere it just brings the app forward).
export async function sendMergeNudgeNotification(body: string) {
  const { invoke } = await import('@tauri-apps/api/core');

  await invoke('send_merge_nudge_notification', { body });
}

export async function setActiveAiTaskRunning(active: boolean) {
  await invokeWindowCommand('set_active_ai_task_running', { active });
}

// Mirrors the pending-merge count onto the OS app badge; 0 clears it. Best-effort
// (no-op in the dev server / on backends without a numeric badge).
export async function setMergeBadgeCount(count: number) {
  await invokeWindowCommand('set_badge_count', { count });
}

export async function syncWindowBehaviorSettings(settings: AppSettings) {
  await invokeWindowCommand('set_window_behavior', {
    closeToTray: settings.closeToTray,
  });

  await syncLaunchAtStartup(settings.launchAtStartup);
}

async function syncLaunchAtStartup(launchAtStartup: boolean) {
  // The autostart plugin only exists in the real Tauri app; in the browser dev
  // server the import/calls fail, so this is best-effort and never surfaced.
  try {
    const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
    const alreadyEnabled = await isEnabled();

    if (launchAtStartup && !alreadyEnabled) {
      await enable();
    } else if (!launchAtStartup && alreadyEnabled) {
      await disable();
    }
  } catch (error) {
    logger.warn('tray', 'window.autostart_sync_failed', 'Failed to sync launch-at-startup', {
      launchAtStartup,
      error,
    });
  }
}

export async function applyStartupWindowBehavior(settings: AppSettings) {
  await syncWindowBehaviorSettings(settings);

  if (settings.startMinimized) {
    await hideMainWindow();
  }
}

export async function registerTrayEventHandlers(handlers: TrayEventHandlers) {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisteners = await Promise.all([
      listen(trayEvents.focusEntry, handlers.onFocusEntry),
      listen(trayEvents.openSearch, handlers.onOpenSearch),
      listen(trayEvents.openSettings, handlers.onOpenSettings),
      listen(trayEvents.checkUpdate, handlers.onCheckUpdate),
      listen(trayEvents.windowHidden, handlers.onWindowHidden),
      listen(trayEvents.closeBlocked, handlers.onCloseBlocked),
      listen(trayEvents.openThreads, handlers.onOpenThreads),
    ]);

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  } catch (error) {
    logger.warn('tray', 'tray.register_event_handlers_failed', 'Failed to register tray event handlers', {
      error,
    });

    return () => {};
  }
}

async function invokeWindowCommand(command: string, args?: Record<string, unknown>) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    await invoke(command, args);
  } catch (error) {
    logger.warn('tray', 'window.command_failed', 'Window command failed', {
      command,
      error,
    });
  }
}
