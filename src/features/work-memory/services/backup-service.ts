import { appVersion as currentAppVersion } from '@/lib/app-version';
import { appSettingsRepository, type AppSettings } from './app-settings-repository';
import { clarificationRepository } from './clarification-repository';
import { buildEntriesFromDailyMemories } from './daily-memory-entry-migration';
import { entryRepository } from './entry-repository';
import { reportRepository } from './report-repository';
import { threadRepository } from './thread-repository';
import type { Clarification, DailyMemory, Entry, Report, Thread } from '../types';

export type BackupPayload = {
  version: 1 | 2;
  exportedAt: string;
  appVersion: string;
  data: {
    dailyMemories?: DailyMemory[];
    entries: Entry[];
    clarifications: Clarification[];
    threads: Thread[];
    reports: Report[];
    appSettings: AppSettings;
  };
};

type BackupServiceDependencies = {
  appVersion: string;
  now: () => Date;
  entryRepository: {
    listAll(): Promise<Entry[]>;
    replaceAll(entries: Entry[]): Promise<void>;
  };
  clarificationRepository: {
    listAll(): Promise<Clarification[]>;
    replaceAll(clarifications: Clarification[]): Promise<void>;
  };
  threadRepository: {
    listAll(): Promise<Thread[]>;
    replaceAll(threads: Thread[]): Promise<void>;
  };
  reportRepository: {
    getAllReports(): Promise<Report[]>;
    replaceAll(reports: Report[]): Promise<void>;
  };
  appSettingsRepository: {
    getSettings(): Promise<AppSettings>;
    saveSettings(settings: AppSettings): Promise<AppSettings>;
  };
  transaction?: <T>(operation: () => Promise<T>) => Promise<T>;
};

const backupFileFilters = [{ name: 'JSON', extensions: ['json'] }];

export function createBackupService(dependencies: BackupServiceDependencies) {
  return {
    async buildBackupPayload(): Promise<BackupPayload> {
      const [
        entries,
        clarifications,
        threads,
        reports,
        appSettings,
      ] = await Promise.all([
        dependencies.entryRepository.listAll(),
        dependencies.clarificationRepository.listAll(),
        dependencies.threadRepository.listAll(),
        dependencies.reportRepository.getAllReports(),
        dependencies.appSettingsRepository.getSettings(),
      ]);

      return {
        version: 2,
        exportedAt: dependencies.now().toISOString(),
        appVersion: dependencies.appVersion,
        data: {
          entries,
          clarifications,
          threads,
          reports,
          // Backup files travel (cloud drives, chat apps), so plaintext API
          // keys never leave the local database. Users re-enter them after
          // a restore.
          appSettings: {
            ...appSettings,
            openAICompatible: {
              ...appSettings.openAICompatible,
              apiKey: '',
            },
            anthropic: {
              ...appSettings.anthropic,
              apiKey: '',
            },
          },
        },
      };
    },

    async exportBackupToFile() {
      const payload = await this.buildBackupPayload();
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const selectedPath = await save({
        defaultPath: buildBackupFileName(dependencies.now()),
        filters: backupFileFilters,
        title: '导出 Tallya 备份',
      });

      if (!selectedPath) {
        return { status: 'cancelled' as const };
      }

      await writeTextFile(selectedPath, JSON.stringify(payload, null, 2));

      return { status: 'exported' as const };
    },

    async selectBackupFile() {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const selectedPath = await open({
        filters: backupFileFilters,
        multiple: false,
        title: '导入 Tallya 备份',
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return null;
      }

      return validateBackupFile(await readTextFile(selectedPath));
    },

    async importBackupFromText(text: string) {
      return this.restoreBackupPayload(validateBackupFile(text));
    },

    async restoreBackupPayload(payload: BackupPayload) {
      const entries =
        payload.version === 1
          ? buildEntriesFromDailyMemories(payload.data.dailyMemories ?? [])
          : payload.data.entries;

      await runBackupRestoreTransaction(dependencies, async () => {
        await dependencies.threadRepository.replaceAll(payload.data.threads);
        await dependencies.entryRepository.replaceAll(entries);
        await dependencies.clarificationRepository.replaceAll(payload.data.clarifications);
        await dependencies.reportRepository.replaceAll(payload.data.reports);
      });

      // Settings are saved after the data transaction, not inside it:
      // saveSettings opens its own transaction, and nesting BEGIN within BEGIN
      // breaks on SQLite. Exports strip API keys, so empty keys in the backup
      // must not wipe the keys already configured on this machine.
      const restoredSettings = payload.data.appSettings;
      const hasOpenAIKey = hasText(restoredSettings.openAICompatible?.apiKey);
      const hasAnthropicKey = hasText(restoredSettings.anthropic?.apiKey);

      if (hasOpenAIKey && hasAnthropicKey) {
        return dependencies.appSettingsRepository.saveSettings(restoredSettings);
      }

      const currentSettings = await dependencies.appSettingsRepository.getSettings();

      return dependencies.appSettingsRepository.saveSettings({
        ...restoredSettings,
        openAICompatible: {
          ...restoredSettings.openAICompatible,
          apiKey: hasOpenAIKey
            ? restoredSettings.openAICompatible.apiKey
            : currentSettings.openAICompatible.apiKey,
        },
        anthropic: {
          ...restoredSettings.anthropic,
          apiKey: hasAnthropicKey
            ? restoredSettings.anthropic.apiKey
            : currentSettings.anthropic.apiKey,
        },
      });
    },

    async openDataDirectory() {
      // Resolve + create + reveal happens in Rust to dodge JS plugin scope
      // issues that broke this on macOS.
      const { invoke } = await import('@tauri-apps/api/core');

      await invoke('open_app_directory', { kind: 'data' });
    },
  };
}

export const backupService = createBackupService({
  appVersion: currentAppVersion,
  now: () => new Date(),
  entryRepository,
  clarificationRepository,
  threadRepository,
  reportRepository,
  appSettingsRepository,
  // No DB transaction wrapper on purpose: tauri-plugin-sql does not pin a
  // connection across calls, so a multi-call BEGIN/COMMIT around the restore
  // self-locks ("database is locked") — the same failure that broke settings
  // save. replaceAll already runs as individual statements (never truly atomic
  // here anyway), so the restore runs sequentially instead.
});

export function buildBackupFileName(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `tallya-backup-${year}-${month}-${day}.json`;
}

export function validateBackupFile(text: string): BackupPayload {
  try {
    const payload = JSON.parse(text) as unknown;
    const normalizedPayload = normalizeBackupPayload(payload);

    if (!normalizedPayload) {
      throw new Error('Invalid backup shape');
    }

    return normalizedPayload;
  } catch {
    throw new Error('备份文件格式不正确');
  }
}

function runBackupRestoreTransaction<T>(
  dependencies: BackupServiceDependencies,
  operation: () => Promise<T>,
) {
  return dependencies.transaction ? dependencies.transaction(operation) : operation();
}

function normalizeBackupPayload(value: unknown): BackupPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<BackupPayload>;
  const data = payload.data as Partial<BackupPayload['data']> | undefined;

  if (
    payload.version !== 1 &&
    payload.version !== 2
  ) {
    return null;
  }

  if (
    typeof payload.exportedAt === 'string' &&
    typeof payload.appVersion === 'string' &&
    Boolean(data) &&
    Array.isArray(data?.reports) &&
    Boolean(data?.appSettings) &&
    typeof data?.appSettings === 'object' &&
    !Array.isArray(data?.appSettings) &&
    (payload.version === 2 || Array.isArray(data?.dailyMemories))
  ) {
    const entries = normalizeVersionedArray(payload.version, data.entries);
    const clarifications = normalizeVersionedArray(payload.version, data.clarifications);
    const threads = normalizeVersionedArray(payload.version, data.threads);

    if (!entries || !clarifications || !threads) {
      return null;
    }

    return {
      version: payload.version,
      exportedAt: payload.exportedAt,
      appVersion: payload.appVersion,
      data: {
        ...(payload.version === 1 ? { dailyMemories: data.dailyMemories } : {}),
        entries: entries as Entry[],
        clarifications: clarifications as Clarification[],
        threads: threads as Thread[],
        reports: data.reports,
        appSettings: data.appSettings as AppSettings,
      },
    };
  }

  return null;
}

function normalizeVersionedArray(version: BackupPayload['version'], value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  return version === 1 ? [] : null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
