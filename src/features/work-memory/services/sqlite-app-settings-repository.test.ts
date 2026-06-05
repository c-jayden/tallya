import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, SQLiteAppSettingsRepository } from './app-settings-repository';
import { TestDatabaseClient } from './database/test-database';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('SQLiteAppSettingsRepository', () => {
  it('returns defaults when settings have not been saved', async () => {
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(new TestDatabaseClient()));

    await expect(repository.getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
  });

  it('saves and reads app settings from the app_settings table', async () => {
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(new TestDatabaseClient()));

    const saved = await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
      dailyReminderEnabled: true,
    });

    await expect(repository.getSettings()).resolves.toEqual(saved);
  });

  it('writes settings into dedicated columns instead of a single JSON payload', async () => {
    const database = new RecordingAppSettingsDatabase();
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database));

    await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
      dailyReminderEnabled: true,
    });

    expect(database.lastSettingsWrite?.query.toLowerCase()).toContain('theme');
    expect(database.lastSettingsWrite?.query.toLowerCase()).toContain('close_to_tray');
    expect(database.lastSettingsWrite?.query.toLowerCase()).not.toContain('value_json');
    expect(database.lastSettingsWrite?.bindValues).toContain('dark');
    expect(database.lastSettingsWrite?.bindValues).toContain(0);
    expect(database.lastSettingsWrite?.bindValues).toContain(1);
  });

  it('resets settings back to defaults', async () => {
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(new TestDatabaseClient()));

    await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'light',
      weeklyReminderEnabled: true,
    });

    await expect(repository.resetSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    await expect(repository.getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
  });

  it('migrates legacy localStorage settings without deleting the old value', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        theme: 'dark',
        closeToTray: false,
      }),
    );
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(new TestDatabaseClient()), {
      legacyStorage: storage,
    });

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
    });
    expect(storage.getItem('tallya.app-settings.v1')).not.toBeNull();
    expect(storage.getItem('tallya.app-settings.sqlite-migrated.v1')).toBe('1');
  });

  it('skips legacy settings migration after the migrated marker is written', async () => {
    const database = new TestDatabaseClient();
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        theme: 'dark',
      }),
    );

    await new SQLiteAppSettingsRepository(Promise.resolve(database), {
      legacyStorage: storage,
    }).getSettings();

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        theme: 'light',
      }),
    );

    const secondStartupRepository = new SQLiteAppSettingsRepository(Promise.resolve(database), {
      legacyStorage: storage,
    });

    await expect(secondStartupRepository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
    });
  });

  it('does not overwrite existing SQLite settings when legacy migration runs again', async () => {
    const database = new TestDatabaseClient();
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        theme: 'dark',
        closeToTray: false,
      }),
    );
    const sqliteRepository = new SQLiteAppSettingsRepository(Promise.resolve(database), {
      legacyStorage: null,
    });

    await sqliteRepository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'light',
      closeToTray: true,
      dailyReminderEnabled: true,
    });

    const migratingRepository = new SQLiteAppSettingsRepository(Promise.resolve(database), {
      legacyStorage: storage,
    });

    await expect(migratingRepository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      theme: 'light',
      closeToTray: true,
      dailyReminderEnabled: true,
    });
    expect(storage.getItem('tallya.app-settings.sqlite-migrated.v1')).toBe('1');
  });

  it('migrates the previous SQLite value_json row into the column table', async () => {
    const database = new LegacySQLiteAppSettingsDatabase({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
      dailyReminderEnabled: true,
    });
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database), {
      legacyStorage: null,
    });

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
      dailyReminderEnabled: true,
    });
    expect(database.appSettings.get('app_settings')?.theme).toBe('dark');
    expect(database.appSettings.get('app_settings')?.close_to_tray).toBe(0);
    expect(database.appSettings.get('app_settings')?.daily_reminder_enabled).toBe(1);
  });

  it('does not fail startup reads when legacy settings migration fails', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        theme: 'dark',
      }),
    );
    const repository = new SQLiteAppSettingsRepository(
      Promise.resolve(new FailingAppSettingsMigrationDatabase()),
      {
        legacyStorage: storage,
      },
    );

    await expect(repository.getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    expect(storage.getItem('tallya.app-settings.sqlite-migrated.v1')).toBeNull();
  });
});

class FailingAppSettingsMigrationDatabase extends TestDatabaseClient {
  override async execute(query: string, bindValues: unknown[] = []) {
    if (query.toLowerCase().includes('insert into app_settings')) {
      throw new Error('insert failed');
    }

    return super.execute(query, bindValues);
  }
}

class RecordingAppSettingsDatabase extends TestDatabaseClient {
  lastSettingsWrite: { query: string; bindValues: unknown[] } | null = null;

  override async execute(query: string, bindValues: unknown[] = []) {
    if (query.toLowerCase().includes('insert into app_settings')) {
      this.lastSettingsWrite = { query, bindValues };
    }

    return super.execute(query, bindValues);
  }
}

class LegacySQLiteAppSettingsDatabase extends TestDatabaseClient {
  constructor(private readonly legacySettings: unknown) {
    super();
  }

  override async select<T>(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = query.toLowerCase();

    if (normalizedQuery.includes("name = 'app_settings_legacy_json'")) {
      return [{ name: 'app_settings_legacy_json' }] as T;
    }

    if (normalizedQuery.includes('from app_settings_legacy_json')) {
      return [
        {
          key: String(bindValues[0]),
          value_json: JSON.stringify(this.legacySettings),
          updated_at: '2026-06-05T00:00:00.000Z',
        },
      ] as T;
    }

    return super.select<T>(query, bindValues);
  }
}
