import { sanitizeLogData } from './sanitize-log';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogScope =
  | 'app'
  | 'ai'
  | 'provider'
  | 'sqlite'
  | 'backup'
  | 'notification'
  | 'tray'
  | 'report'
  | 'settings';

export type DiagnosticLogEntry = {
  timestamp: string;
  level: LogLevel;
  scope: LogScope;
  event: string;
  message: string;
  metadata?: unknown;
};

export type DiagnosticLogDependencies = {
  now: () => Date;
  appDataDir: () => Promise<string>;
  joinPath: (...parts: string[]) => Promise<string>;
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  readDir: (path: string) => Promise<Array<{ name: string; isFile?: boolean }>>;
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, contents: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  save: (options: {
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
    title: string;
  }) => Promise<string | null>;
};

export function createDiagnosticLogService(dependencies: DiagnosticLogDependencies) {
  let detailedLoggingEnabled = false;

  async function getLogsDirectory() {
    return dependencies.joinPath(await dependencies.appDataDir(), 'logs');
  }

  async function writeEntry(entry: DiagnosticLogEntry) {
    if (entry.level === 'debug' && !detailedLoggingEnabled) {
      return;
    }

    try {
      const logsDirectory = await getLogsDirectory();
      const logPath = await dependencies.joinPath(logsDirectory, buildLogFileName(dependencies.now()));
      const sanitizedEntry = {
        ...entry,
        metadata: sanitizeLogData(entry.metadata),
      };
      let previous = '';

      await dependencies.mkdir(logsDirectory, { recursive: true });
      // TODO: Prune logs older than the retention window after adding a safe
      // cross-platform file removal path to the Tauri capability set.

      try {
        previous = await dependencies.readTextFile(logPath);
      } catch {
        previous = '';
      }

      await dependencies.writeTextFile(logPath, `${previous}${JSON.stringify(sanitizedEntry)}\n`);
    } catch (error) {
      console.warn('Failed to write diagnostic log', error);
    }
  }

  return {
    setDetailedLoggingEnabled(enabled: boolean) {
      detailedLoggingEnabled = enabled;
    },
    isDetailedLoggingEnabled() {
      return detailedLoggingEnabled;
    },
    debug(scope: LogScope, event: string, message: string, metadata?: unknown) {
      return writeEntry(buildLogEntry(dependencies.now(), 'debug', scope, event, message, metadata));
    },
    info(scope: LogScope, event: string, message: string, metadata?: unknown) {
      return writeEntry(buildLogEntry(dependencies.now(), 'info', scope, event, message, metadata));
    },
    warn(scope: LogScope, event: string, message: string, metadata?: unknown) {
      return writeEntry(buildLogEntry(dependencies.now(), 'warn', scope, event, message, metadata));
    },
    error(scope: LogScope, event: string, message: string, metadata?: unknown) {
      return writeEntry(buildLogEntry(dependencies.now(), 'error', scope, event, message, metadata));
    },
    async openLogsDirectory() {
      const logsDirectory = await getLogsDirectory();

      await dependencies.mkdir(logsDirectory, { recursive: true });
      await dependencies.openPath(logsDirectory);
    },
    async exportDiagnosticLogs() {
      const logsDirectory = await getLogsDirectory();
      const selectedPath = await dependencies.save({
        defaultPath: buildDiagnosticLogFileName(dependencies.now()),
        filters: [{ name: 'Log', extensions: ['log'] }],
        title: '导出 Tallya 诊断日志',
      });

      if (!selectedPath) {
        return { status: 'cancelled' as const };
      }

      await dependencies.mkdir(logsDirectory, { recursive: true });
      const entries = await dependencies.readDir(logsDirectory);
      const logFileNames = entries
        .filter(
          (entry) =>
            entry.isFile !== false && /^tallya-\d{4}-\d{2}-\d{2}\.log$/.test(entry.name),
        )
        .map((entry) => entry.name)
        .sort()
        .slice(-7);
      const parts: string[] = [];

      for (const fileName of logFileNames) {
        const filePath = await dependencies.joinPath(logsDirectory, fileName);

        try {
          const content = await dependencies.readTextFile(filePath);

          if (content.trim()) {
            parts.push(content.trim());
          }
        } catch {
          // Ignore unreadable log files so one bad file does not block export.
        }
      }

      await dependencies.writeTextFile(selectedPath, parts.join('\n\n'));

      return { status: 'exported' as const };
    },
  };
}

function buildLogEntry(
  timestamp: Date,
  level: LogLevel,
  scope: LogScope,
  event: string,
  message: string,
  metadata?: unknown,
): DiagnosticLogEntry {
  return {
    timestamp: timestamp.toISOString(),
    level,
    scope,
    event,
    message,
    metadata,
  };
}

export function buildLogFileName(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `tallya-${year}-${month}-${day}.log`;
}

export function buildDiagnosticLogFileName(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  const second = `${date.getSeconds()}`.padStart(2, '0');

  return `tallya-diagnostic-${year}-${month}-${day}-${hour}${minute}${second}.log`;
}
