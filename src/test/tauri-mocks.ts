import { vi } from 'vitest';

type Listener = (event: { event: string; payload: unknown }) => void;

const listeners = new Map<string, Set<Listener>>();

export const tauriMocks = {
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listen: vi.fn(async (event: string, handler: Listener) => {
    const eventListeners = listeners.get(event) ?? new Set<Listener>();

    eventListeners.add(handler);
    listeners.set(event, eventListeners);

    return () => {
      eventListeners.delete(handler);
    };
  }),
  emit: vi.fn(async (event: string, payload?: unknown) => {
    listeners.get(event)?.forEach((handler) => handler({ event, payload }));
  }),
  dialogOpen: vi.fn<() => Promise<string | string[] | null>>(async () => null),
  dialogSave: vi.fn<() => Promise<string | null>>(async () => null),
  readTextFile: vi.fn<(path: string) => Promise<string>>(async () => ''),
  writeTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(async () => undefined),
  readDir: vi.fn<(path: string) => Promise<Array<{ name: string; isFile?: boolean }>>>(
    async () => [],
  ),
  mkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(
    async () => undefined,
  ),
  openPath: vi.fn<(path: string) => Promise<void>>(async () => undefined),
  appDataDir: vi.fn<() => Promise<string>>(async () => '/mock/app-data'),
  joinPath: vi.fn<(...parts: string[]) => Promise<string>>(
    async (...parts: string[]) => parts.join('/'),
  ),
  sendNotification: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  requestPermission: vi.fn<() => Promise<'granted' | 'denied' | 'prompt'>>(async () => 'granted'),
  isPermissionGranted: vi.fn<() => Promise<boolean>>(async () => true),
  currentWindowShow: vi.fn<() => Promise<void>>(async () => undefined),
  currentWindowHide: vi.fn<() => Promise<void>>(async () => undefined),
  currentWindowSetFocus: vi.fn<() => Promise<void>>(async () => undefined),
  sqlLoad: vi.fn<
    () => Promise<{
      execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
      select: <T>(query: string, bindValues?: unknown[]) => Promise<T>;
    }>
  >(async () => ({
    execute: vi.fn(async () => undefined),
    select: async <T>() => [] as T,
  })),
};

export function emitTauriEvent(event: string, payload?: unknown) {
  listeners.get(event)?.forEach((handler) => handler({ event, payload }));
}

export function resetTauriMocks() {
  listeners.clear();

  Object.values(tauriMocks).forEach((mock) => {
    if ('mockReset' in mock) {
      mock.mockReset();
    }
  });

  tauriMocks.listen.mockImplementation(async (event: string, handler: Listener) => {
    const eventListeners = listeners.get(event) ?? new Set<Listener>();

    eventListeners.add(handler);
    listeners.set(event, eventListeners);

    return () => {
      eventListeners.delete(handler);
    };
  });
  tauriMocks.emit.mockImplementation(async (event: string, payload?: unknown) => {
    emitTauriEvent(event, payload);
  });
  tauriMocks.dialogOpen.mockResolvedValue(null);
  tauriMocks.dialogSave.mockResolvedValue(null);
  tauriMocks.readTextFile.mockResolvedValue('');
  tauriMocks.writeTextFile.mockResolvedValue(undefined);
  tauriMocks.readDir.mockResolvedValue([]);
  tauriMocks.mkdir.mockResolvedValue(undefined);
  tauriMocks.openPath.mockResolvedValue(undefined);
  tauriMocks.appDataDir.mockResolvedValue('/mock/app-data');
  tauriMocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
  tauriMocks.sendNotification.mockResolvedValue(undefined);
  tauriMocks.requestPermission.mockResolvedValue('granted');
  tauriMocks.isPermissionGranted.mockResolvedValue(true);
  tauriMocks.currentWindowShow.mockResolvedValue(undefined);
  tauriMocks.currentWindowHide.mockResolvedValue(undefined);
  tauriMocks.currentWindowSetFocus.mockResolvedValue(undefined);
  tauriMocks.sqlLoad.mockResolvedValue({
    execute: vi.fn(async () => undefined),
    select: async <T>() => [] as T,
  });
}

resetTauriMocks();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: tauriMocks.listen,
  emit: tauriMocks.emit,
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: tauriMocks.appDataDir,
  join: tauriMocks.joinPath,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    show: tauriMocks.currentWindowShow,
    hide: tauriMocks.currentWindowHide,
    setFocus: tauriMocks.currentWindowSetFocus,
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: tauriMocks.dialogOpen,
  save: tauriMocks.dialogSave,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: tauriMocks.mkdir,
  readDir: tauriMocks.readDir,
  readTextFile: tauriMocks.readTextFile,
  writeTextFile: tauriMocks.writeTextFile,
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: tauriMocks.sendNotification,
  requestPermission: tauriMocks.requestPermission,
  isPermissionGranted: tauriMocks.isPermissionGranted,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: tauriMocks.openPath,
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: tauriMocks.sqlLoad,
  },
}));
