import type { AppSettings } from './app-settings-repository';

export const trayEvents = {
  focusEntry: 'tray://focus-entry',
  openSearch: 'tray://open-search',
  openSettings: 'tray://open-settings',
  windowHidden: 'tray://window-hidden',
} as const;

type TrayEventHandlers = {
  onFocusEntry: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onWindowHidden: () => void;
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

export async function syncWindowBehaviorSettings(settings: AppSettings) {
  await invokeWindowCommand('set_window_behavior', {
    closeToTray: settings.closeToTray,
  });

  // TODO: Connect launchAtStartup through the Tauri autostart plugin when the
  // plugin is added. For now this setting is persisted but not applied.
  void settings.launchAtStartup;
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
      listen(trayEvents.windowHidden, handlers.onWindowHidden),
    ]);

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  } catch (error) {
    console.warn('Failed to register tray event handlers', error);

    return () => {};
  }
}

async function invokeWindowCommand(command: string, args?: Record<string, unknown>) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    await invoke(command, args);
  } catch (error) {
    console.warn(`Window command failed: ${command}`, error);
  }
}
