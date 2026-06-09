import { save } from '@tauri-apps/plugin-dialog';
import { mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { LogScope } from './diagnostic-log';
import { createDiagnosticLogService } from './diagnostic-log';

const diagnosticLogService = createDiagnosticLogService({
  now: () => new Date(),
  async appDataDir() {
    return appDataDir();
  },
  async joinPath(...parts: string[]) {
    return join(...parts);
  },
  async mkdir(path, options) {
    await mkdir(path, options);
  },
  async readDir(path) {
    return readDir(path);
  },
  async readTextFile(path) {
    return readTextFile(path);
  },
  async writeTextFile(path, contents) {
    await writeTextFile(path, contents);
  },
  async removeFile(path) {
    await remove(path);
  },
  async openPath(path) {
    await openPath(path);
  },
  async save(options) {
    return save(options);
  },
});

export const logger = {
  setDetailedLoggingEnabled(enabled: boolean) {
    diagnosticLogService.setDetailedLoggingEnabled(enabled);
  },
  debug(scope: LogScope, event: string, message: string, metadata?: unknown) {
    return diagnosticLogService.debug(scope, event, message, metadata);
  },
  info(scope: LogScope, event: string, message: string, metadata?: unknown) {
    return diagnosticLogService.info(scope, event, message, metadata);
  },
  warn(scope: LogScope, event: string, message: string, metadata?: unknown) {
    return diagnosticLogService.warn(scope, event, message, metadata);
  },
  error(scope: LogScope, event: string, message: string, metadata?: unknown) {
    return diagnosticLogService.error(scope, event, message, metadata);
  },
  openLogsDirectory() {
    return diagnosticLogService.openLogsDirectory();
  },
  exportDiagnosticLogs() {
    return diagnosticLogService.exportDiagnosticLogs();
  },
};
