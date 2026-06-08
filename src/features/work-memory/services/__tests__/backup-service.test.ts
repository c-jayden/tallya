import { describe, expect, it, vi } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../app-settings-repository';
import {
  buildBackupFileName,
  createBackupService,
  validateBackupFile,
  type BackupPayload,
} from '../backup-service';
import type { DailyMemory, Report, ReportSource } from '../../types';

describe('backup-service', () => {
  it('builds a backup payload with memories, reports, report sources, settings, and app version', async () => {
    const dailyMemories = [createDailyMemory('2026-06-08')];
    const reports = [createReport()];
    const reportSources = [createReportSource()];
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository: createDailyMemoryRepository({ dailyMemories }),
      reportRepository: createReportRepository({ reports, reportSources }),
      appSettingsRepository: createAppSettingsRepository({
        settings: { ...DEFAULT_APP_SETTINGS, theme: 'dark' },
      }),
    });

    await expect(service.buildBackupPayload()).resolves.toEqual({
      version: 1,
      exportedAt: '2026-06-08T10:00:00.000Z',
      appVersion: '0.1.0',
      data: {
        dailyMemories,
        reports,
        reportSources,
        appSettings: { ...DEFAULT_APP_SETTINGS, theme: 'dark' },
      },
    });
  });

  it('validates a legal backup file', () => {
    const payload = createBackupPayload();

    expect(validateBackupFile(JSON.stringify(payload))).toEqual(payload);
  });

  it('rejects invalid JSON backup files', () => {
    expect(() => validateBackupFile('{bad json')).toThrow('备份文件格式不正确');
  });

  it('rejects backup files without data', () => {
    expect(() => validateBackupFile(JSON.stringify({ version: 1 }))).toThrow(
      '备份文件格式不正确',
    );
  });

  it('restores a valid backup by overwriting existing local data', async () => {
    const payload = createBackupPayload({
      dailyMemories: [createDailyMemory('2026-06-08')],
      reports: [createReport()],
      reportSources: [createReportSource()],
      appSettings: { ...DEFAULT_APP_SETTINGS, closeToTray: false },
    });
    const dailyMemoryRepository = createDailyMemoryRepository();
    const reportRepository = createReportRepository();
    const appSettingsRepository = createAppSettingsRepository();
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository,
      reportRepository,
      appSettingsRepository,
    });

    await service.restoreBackupPayload(payload);

    expect(dailyMemoryRepository.replaceAll).toHaveBeenCalledWith(payload.data.dailyMemories);
    expect(reportRepository.replaceAll).toHaveBeenCalledWith(
      payload.data.reports,
      payload.data.reportSources,
    );
    expect(appSettingsRepository.saveSettings).toHaveBeenCalledWith(payload.data.appSettings);
  });

  it('does not clear current data when backup validation fails', async () => {
    const dailyMemoryRepository = createDailyMemoryRepository();
    const reportRepository = createReportRepository();
    const appSettingsRepository = createAppSettingsRepository();
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository,
      reportRepository,
      appSettingsRepository,
    });

    await expect(service.importBackupFromText('{bad json')).rejects.toThrow(
      '备份文件格式不正确',
    );

    expect(dailyMemoryRepository.replaceAll).not.toHaveBeenCalled();
    expect(reportRepository.replaceAll).not.toHaveBeenCalled();
    expect(appSettingsRepository.saveSettings).not.toHaveBeenCalled();
  });

  it('builds the default export file name from the current date', () => {
    expect(buildBackupFileName(new Date('2026-06-08T10:00:00.000Z'))).toBe(
      'tallya-backup-2026-06-08.json',
    );
  });

  it('exports backup files through mocked Tauri dialog and fs APIs', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository: createDailyMemoryRepository({
        dailyMemories: [createDailyMemory('2026-06-08')],
      }),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });
    tauriMocks.dialogSave.mockResolvedValueOnce('/mock/tallya-backup-2026-06-08.json');

    await expect(service.exportBackupToFile()).resolves.toEqual({ status: 'exported' });

    expect(tauriMocks.dialogSave).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'tallya-backup-2026-06-08.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }),
    );
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith(
      '/mock/tallya-backup-2026-06-08.json',
      expect.stringContaining('"dailyMemories"'),
    );
  });

  it('does not write a file when export is cancelled', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository: createDailyMemoryRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });
    tauriMocks.dialogSave.mockResolvedValueOnce(null);

    await expect(service.exportBackupToFile()).resolves.toEqual({ status: 'cancelled' });

    expect(tauriMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it('opens the Tauri app data directory instead of a hard-coded platform path', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      dailyMemoryRepository: createDailyMemoryRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });
    tauriMocks.appDataDir.mockResolvedValueOnce('/mock/app-data/tallya');

    await service.openDataDirectory();

    expect(tauriMocks.openPath).toHaveBeenCalledWith('/mock/app-data/tallya');
  });
});

function createBackupPayload(overrides: Partial<BackupPayload['data']> = {}): BackupPayload {
  return {
    version: 1,
    exportedAt: '2026-06-08T10:00:00.000Z',
    appVersion: '0.1.0',
    data: {
      dailyMemories: [],
      reports: [],
      reportSources: [],
      appSettings: DEFAULT_APP_SETTINGS,
      ...overrides,
    },
  };
}

function createDailyMemory(date: string): DailyMemory {
  return {
    id: `daily-memory-${date}`,
    date,
    rawContent: `${date} work memory.`,
    supplements: {},
    generated: {
      summary: `${date} summary`,
      completedItems: [`${date} completed item`],
    },
    status: 'generated',
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T02:00:00.000Z`,
  };
}

function createReport(): Report {
  return {
    id: 'weekly-2026-06-08',
    type: 'weekly',
    title: '本周周报',
    startDate: '2026-06-08',
    endDate: '2026-06-14',
    content: {
      title: '本周周报',
      summary: '整理了本周工作。',
      highlights: [],
      completedItems: [],
      markdown: '# 本周周报',
    },
    status: 'generated',
    createdAt: '2026-06-08T10:00:00.000Z',
    updatedAt: '2026-06-08T10:00:00.000Z',
    generatedAt: '2026-06-08T10:00:00.000Z',
  };
}

function createReportSource(): ReportSource {
  return {
    id: 'report-source-weekly-2026-06-08-daily-memory-2026-06-08',
    reportId: 'weekly-2026-06-08',
    dailyMemoryId: 'daily-memory-2026-06-08',
    dailyMemoryUpdatedAtSnapshot: '2026-06-08T02:00:00.000Z',
  };
}

function createDailyMemoryRepository({ dailyMemories = [] }: { dailyMemories?: DailyMemory[] } = {}) {
  return {
    getAllMemories: vi.fn(async () => dailyMemories),
    replaceAll: vi.fn(async () => undefined),
  };
}

function createReportRepository({
  reports = [],
  reportSources = [],
}: {
  reports?: Report[];
  reportSources?: ReportSource[];
} = {}) {
  return {
    getAllReports: vi.fn(async () => reports),
    getAllReportSources: vi.fn(async () => reportSources),
    replaceAll: vi.fn(async () => undefined),
  };
}

function createAppSettingsRepository({ settings = DEFAULT_APP_SETTINGS }: { settings?: AppSettings } = {}) {
  return {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async (nextSettings: AppSettings) => nextSettings),
  };
}
