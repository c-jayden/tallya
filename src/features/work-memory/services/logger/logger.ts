import type { LogScope } from './diagnostic-log';
import { createDiagnosticLogService } from './diagnostic-log';

const diagnosticLogService = createDiagnosticLogService({
  now: () => new Date(),
  async appDataDir() {
    const { appDataDir } = await import('@tauri-apps/api/path');

    return appDataDir();
  },
  async joinPath(...parts: string[]) {
    const { join } = await import('@tauri-apps/api/path');

    return join(...parts);
  },
  async mkdir(path, options) {
    const { mkdir } = await import('@tauri-apps/plugin-fs');

    await mkdir(path, options);
  },
  async readDir(path) {
    const { readDir } = await import('@tauri-apps/plugin-fs');

    return readDir(path);
  },
  async readTextFile(path) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    return readTextFile(path);
  },
  async writeTextFile(path, contents) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    await writeTextFile(path, contents);
  },
  async removeFile(path) {
    const { remove } = await import('@tauri-apps/plugin-fs');

    await remove(path);
  },
  async openPath(path) {
    const { openPath } = await import('@tauri-apps/plugin-opener');

    await openPath(path);
  },
  async save(options) {
    const { save } = await import('@tauri-apps/plugin-dialog');

    return save(options);
  },
});

export const logger = {
  setDetailedLoggingEnabled(enabled: boolean) {
    diagnosticLogService.setDetailedLoggingEnabled(enabled);
  },
  debug(scope: LogScope, event: string, message: string, metadata?: unknown) {
    void diagnosticLogService.debug(scope, event, message, metadata);
  },
  info(scope: LogScope, event: string, message: string, metadata?: unknown) {
    void diagnosticLogService.info(scope, event, message, metadata);
  },
  warn(scope: LogScope, event: string, message: string, metadata?: unknown) {
    void diagnosticLogService.warn(scope, event, message, metadata);
  },
  error(scope: LogScope, event: string, message: string, metadata?: unknown) {
    void diagnosticLogService.error(scope, event, message, metadata);
  },
  openLogsDirectory() {
    return diagnosticLogService.openLogsDirectory();
  },
  exportDiagnosticLogs() {
    return diagnosticLogService.exportDiagnosticLogs();
  },
};
