import { appVersion as currentAppVersion } from '@/lib/app-version';
import { appSettingsRepository, type AppSettings } from './app-settings-repository';
import { dailyMemoryRepository } from './daily-memory-repository';
import { reportRepository } from './report-repository';
import type { DailyMemory, Report, ReportSource } from '../types';

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  appVersion: string;
  data: {
    dailyMemories: DailyMemory[];
    reports: Report[];
    reportSources: ReportSource[];
    appSettings: AppSettings;
  };
};

type BackupServiceDependencies = {
  appVersion: string;
  now: () => Date;
  dailyMemoryRepository: {
    getAllMemories(): Promise<DailyMemory[]>;
    replaceAll(memories: DailyMemory[]): Promise<void>;
  };
  reportRepository: {
    getAllReports(): Promise<Report[]>;
    getAllReportSources(): Promise<ReportSource[]>;
    replaceAll(reports: Report[], reportSources: ReportSource[]): Promise<void>;
  };
  appSettingsRepository: {
    getSettings(): Promise<AppSettings>;
    saveSettings(settings: AppSettings): Promise<AppSettings>;
  };
};

const backupFileFilters = [{ name: 'JSON', extensions: ['json'] }];

export function createBackupService(dependencies: BackupServiceDependencies) {
  return {
    async buildBackupPayload(): Promise<BackupPayload> {
      const [dailyMemories, reports, reportSources, appSettings] = await Promise.all([
        dependencies.dailyMemoryRepository.getAllMemories(),
        dependencies.reportRepository.getAllReports(),
        dependencies.reportRepository.getAllReportSources(),
        dependencies.appSettingsRepository.getSettings(),
      ]);

      return {
        version: 1,
        exportedAt: dependencies.now().toISOString(),
        appVersion: dependencies.appVersion,
        data: {
          dailyMemories,
          reports,
          reportSources,
          // Backup files travel (cloud drives, chat apps), so the plaintext
          // API key never leaves the local database. Users re-enter it after
          // a restore.
          appSettings: {
            ...appSettings,
            openAICompatible: {
              ...appSettings.openAICompatible,
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
      // TODO: Move restore into one SQLite transaction once repositories expose
      // a shared transaction boundary.
      await dependencies.dailyMemoryRepository.replaceAll(payload.data.dailyMemories);
      await dependencies.reportRepository.replaceAll(
        payload.data.reports,
        payload.data.reportSources,
      );

      // Exports strip the API key, so an empty key in the backup must not wipe
      // the key already configured on this machine.
      const restoredSettings = payload.data.appSettings;
      const incomingApiKey = restoredSettings.openAICompatible?.apiKey;

      if (typeof incomingApiKey !== 'string' || !incomingApiKey.trim()) {
        const currentSettings = await dependencies.appSettingsRepository.getSettings();

        return dependencies.appSettingsRepository.saveSettings({
          ...restoredSettings,
          openAICompatible: {
            ...restoredSettings.openAICompatible,
            apiKey: currentSettings.openAICompatible.apiKey,
          },
        });
      }

      return dependencies.appSettingsRepository.saveSettings(restoredSettings);
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
  dailyMemoryRepository,
  reportRepository,
  appSettingsRepository,
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

    if (!isBackupPayload(payload)) {
      throw new Error('Invalid backup shape');
    }

    return payload;
  } catch {
    throw new Error('备份文件格式不正确');
  }
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<BackupPayload>;
  const data = payload.data as Partial<BackupPayload['data']> | undefined;

  return (
    payload.version === 1 &&
    typeof payload.exportedAt === 'string' &&
    typeof payload.appVersion === 'string' &&
    Boolean(data) &&
    Array.isArray(data?.dailyMemories) &&
    Array.isArray(data?.reports) &&
    Array.isArray(data?.reportSources) &&
    Boolean(data?.appSettings) &&
    typeof data?.appSettings === 'object' &&
    !Array.isArray(data?.appSettings)
  );
}
