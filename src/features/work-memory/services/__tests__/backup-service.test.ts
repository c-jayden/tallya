import { describe, expect, it, vi } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../app-settings-repository';
import {
  buildBackupFileName,
  createBackupService,
  validateBackupFile,
  type BackupPayload,
} from '../backup-service';
import type { Clarification, DailyMemory, Entry, Report, Thread } from '../../types';

describe('backup-service', () => {
  it('builds a v2 backup payload with entries, clarifications, threads, settings, and app version', async () => {
    const entries = [createEntry()];
    const clarifications = [createClarification()];
    const threads = [createThread()];
    const reports = [createReport()];
    const settings = {
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark' as const,
      openAICompatible: {
        ...DEFAULT_APP_SETTINGS.openAICompatible,
        apiKey: 'secret-key',
      },
    };
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository: createEntryRepository({ entries }),
      clarificationRepository: createClarificationRepository({ clarifications }),
      threadRepository: createThreadRepository({ threads }),
      reportRepository: createReportRepository({ reports }),
      appSettingsRepository: createAppSettingsRepository({ settings }),
    });

    await expect(service.buildBackupPayload()).resolves.toEqual({
      version: 2,
      exportedAt: '2026-06-08T10:00:00.000Z',
      appVersion: '0.1.0',
      data: {
        entries,
        clarifications,
        threads,
        reports,
        appSettings: {
          ...settings,
          openAICompatible: {
            ...settings.openAICompatible,
            apiKey: '',
          },
        },
      },
    });
  });

  it('validates a legal backup file', () => {
    const payload = createBackupPayload();

    expect(validateBackupFile(JSON.stringify(payload))).toEqual(payload);
  });

  it('validates a v1 backup file and fills current-model collections with empty arrays', () => {
    const payload = createLegacyBackupPayload({
      dailyMemories: [createDailyMemory('2026-06-08')],
    });

    expect(validateBackupFile(JSON.stringify(payload))).toEqual({
      ...payload,
      data: {
        ...payload.data,
        entries: [],
        clarifications: [],
        threads: [],
      },
    });
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
      entries: [createEntry()],
      clarifications: [createClarification()],
      threads: [createThread()],
      reports: [createReport()],
      appSettings: { ...DEFAULT_APP_SETTINGS, closeToTray: false },
    });
    const entryRepository = createEntryRepository();
    const clarificationRepository = createClarificationRepository();
    const threadRepository = createThreadRepository();
    const reportRepository = createReportRepository();
    const appSettingsRepository = createAppSettingsRepository();
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository,
      clarificationRepository,
      threadRepository,
      reportRepository,
      appSettingsRepository,
    });

    await service.restoreBackupPayload(payload);

    expect(entryRepository.replaceAll).toHaveBeenCalledWith(payload.data.entries);
    expect(clarificationRepository.replaceAll).toHaveBeenCalledWith(payload.data.clarifications);
    expect(threadRepository.replaceAll).toHaveBeenCalledWith(payload.data.threads);
    expect(reportRepository.replaceAll).toHaveBeenCalledWith(payload.data.reports);
    expect(appSettingsRepository.saveSettings).toHaveBeenCalledWith(payload.data.appSettings);
  });

  it('restores backup data inside the provided transaction boundary', async () => {
    const payload = createBackupPayload({
      entries: [createEntry()],
      clarifications: [createClarification()],
      threads: [createThread()],
      reports: [createReport()],
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        openAICompatible: {
          ...DEFAULT_APP_SETTINGS.openAICompatible,
          apiKey: 'backup-secret',
        },
      },
    });
    const events: string[] = [];
    const entryRepository = createEntryRepository();
    entryRepository.replaceAll.mockImplementation(async () => {
      events.push('entries');
    });
    const clarificationRepository = createClarificationRepository();
    clarificationRepository.replaceAll.mockImplementation(async () => {
      events.push('clarifications');
    });
    const threadRepository = createThreadRepository();
    threadRepository.replaceAll.mockImplementation(async () => {
      events.push('threads');
    });
    const reportRepository = createReportRepository();
    reportRepository.replaceAll.mockImplementation(async () => {
      events.push('reports');
    });
    const appSettingsRepository = createAppSettingsRepository();
    appSettingsRepository.saveSettings.mockImplementation(async (settings: AppSettings) => {
      events.push('settings');
      return settings;
    });
    let transactionCalls = 0;
    const transaction = async <T,>(operation: () => Promise<T>): Promise<T> => {
      transactionCalls += 1;
      events.push('begin');
      const result = await operation();
      events.push('commit');
      return result;
    };
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository,
      clarificationRepository,
      threadRepository,
      reportRepository,
      appSettingsRepository,
      transaction,
    });

    await service.restoreBackupPayload(payload);

    expect(transactionCalls).toBe(1);
    expect(events).toEqual([
      'begin',
      'threads',
      'entries',
      'clarifications',
      'reports',
      'settings',
      'commit',
    ]);
  });

  it('restores a v1 backup by converting daily memories into readable entries', async () => {
    const legacyMemory = createDailyMemory('2026-06-08');
    const payload = validateBackupFile(
      JSON.stringify(
        createLegacyBackupPayload({
          dailyMemories: [legacyMemory],
        }),
      ),
    );
    const entryRepository = createEntryRepository();
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository,
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });

    await service.restoreBackupPayload(payload);

    await expect(entryRepository.listAll()).resolves.toEqual([
      {
        id: `entry-migrated-${legacyMemory.id}`,
        content: legacyMemory.rawContent,
        occurredAt: legacyMemory.createdAt,
        occurredOn: legacyMemory.date,
        threadId: null,
        difficulty: null,
        effort: null,
        createdAt: legacyMemory.createdAt,
        updatedAt: legacyMemory.updatedAt,
      },
    ]);
  });

  it('keeps the current OpenAI-compatible api key when the backup key is empty', async () => {
    const currentSettings = {
      ...DEFAULT_APP_SETTINGS,
      openAICompatible: {
        ...DEFAULT_APP_SETTINGS.openAICompatible,
        apiKey: 'local-secret',
      },
    };
    const payload = createBackupPayload({
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        theme: 'dark',
        openAICompatible: {
          ...DEFAULT_APP_SETTINGS.openAICompatible,
          apiKey: '',
        },
      },
    });
    const appSettingsRepository = createAppSettingsRepository({ settings: currentSettings });
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository: createEntryRepository(),
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository,
    });

    await service.restoreBackupPayload(payload);

    expect(appSettingsRepository.saveSettings).toHaveBeenCalledWith({
      ...payload.data.appSettings,
      openAICompatible: {
        ...payload.data.appSettings.openAICompatible,
        apiKey: 'local-secret',
      },
    });
  });

  it('does not clear current data when backup validation fails', async () => {
    const entryRepository = createEntryRepository();
    const clarificationRepository = createClarificationRepository();
    const threadRepository = createThreadRepository();
    const reportRepository = createReportRepository();
    const appSettingsRepository = createAppSettingsRepository();
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository,
      clarificationRepository,
      threadRepository,
      reportRepository,
      appSettingsRepository,
    });

    await expect(service.importBackupFromText('{bad json')).rejects.toThrow(
      '备份文件格式不正确',
    );

    expect(entryRepository.replaceAll).not.toHaveBeenCalled();
    expect(clarificationRepository.replaceAll).not.toHaveBeenCalled();
    expect(threadRepository.replaceAll).not.toHaveBeenCalled();
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
      entryRepository: createEntryRepository(),
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
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
      expect.stringContaining('"entries"'),
    );
  });

  it('does not write a file when export is cancelled', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository: createEntryRepository(),
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });
    tauriMocks.dialogSave.mockResolvedValueOnce(null);

    await expect(service.exportBackupToFile()).resolves.toEqual({ status: 'cancelled' });

    expect(tauriMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it('opens the data directory through the Rust command', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository: createEntryRepository(),
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });

    await service.openDataDirectory();

    expect(tauriMocks.invoke).toHaveBeenCalledWith('open_app_directory', { kind: 'data' });
  });

  it('returns null without reading a file when backup import selection is cancelled', async () => {
    const service = createBackupService({
      appVersion: '0.1.0',
      now: () => new Date('2026-06-08T10:00:00.000Z'),
      entryRepository: createEntryRepository(),
      clarificationRepository: createClarificationRepository(),
      threadRepository: createThreadRepository(),
      reportRepository: createReportRepository(),
      appSettingsRepository: createAppSettingsRepository(),
    });
    tauriMocks.dialogOpen.mockResolvedValueOnce(null);

    await expect(service.selectBackupFile()).resolves.toBeNull();

    expect(tauriMocks.readTextFile).not.toHaveBeenCalled();
  });
});

function createBackupPayload(overrides: Partial<BackupPayload['data']> = {}): BackupPayload {
  return {
    version: 2,
    exportedAt: '2026-06-08T10:00:00.000Z',
    appVersion: '0.1.0',
    data: {
      entries: [],
      clarifications: [],
      threads: [],
      reports: [],
      appSettings: DEFAULT_APP_SETTINGS,
      ...overrides,
    },
  };
}

function createLegacyBackupPayload(
  overrides: Partial<{
    dailyMemories: DailyMemory[];
    reports: Report[];
    appSettings: AppSettings;
  }> = {},
) {
  return {
    version: 1,
    exportedAt: '2026-06-08T10:00:00.000Z',
    appVersion: '0.1.0',
    data: {
      dailyMemories: [],
      reports: [],
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

function createEntry(): Entry {
  return {
    id: 'entry_2026_06_08',
    content: '2026-06-08 work memory.',
    occurredAt: '2026-06-08T01:00:00.000Z',
    occurredOn: '2026-06-08',
    threadId: 'thread_2026_06_08',
    difficulty: null,
    effort: null,
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T02:00:00.000Z',
  };
}

function createClarification(): Clarification {
  return {
    id: 'clar_2026_06_08',
    entryId: 'entry_2026_06_08',
    question: '补充？',
    answer: '补充了上下文。',
    createdAt: '2026-06-08T01:30:00.000Z',
    updatedAt: '2026-06-08T01:30:00.000Z',
  };
}

function createThread(): Thread {
  return {
    id: 'thread_2026_06_08',
    title: '订单接口',
    status: 'open',
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T02:00:00.000Z',
  };
}

function createEntryRepository({ entries = [] }: { entries?: Entry[] } = {}) {
  let currentEntries = entries;

  return {
    listAll: vi.fn(async () => currentEntries),
    replaceAll: vi.fn(async (nextEntries: Entry[]) => {
      currentEntries = nextEntries;
    }),
  };
}

function createClarificationRepository({
  clarifications = [],
}: {
  clarifications?: Clarification[];
} = {}) {
  let currentClarifications = clarifications;

  return {
    listAll: vi.fn(async () => currentClarifications),
    replaceAll: vi.fn(async (nextClarifications: Clarification[]) => {
      currentClarifications = nextClarifications;
    }),
  };
}

function createThreadRepository({ threads = [] }: { threads?: Thread[] } = {}) {
  let currentThreads = threads;

  return {
    listAll: vi.fn(async () => currentThreads),
    replaceAll: vi.fn(async (nextThreads: Thread[]) => {
      currentThreads = nextThreads;
    }),
  };
}

function createReportRepository({ reports = [] }: { reports?: Report[] } = {}) {
  return {
    getAllReports: vi.fn(async () => reports),
    replaceAll: vi.fn(async () => undefined),
  };
}

function createAppSettingsRepository({ settings = DEFAULT_APP_SETTINGS }: { settings?: AppSettings } = {}) {
  return {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async (nextSettings: AppSettings) => nextSettings),
  };
}
