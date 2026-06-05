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
