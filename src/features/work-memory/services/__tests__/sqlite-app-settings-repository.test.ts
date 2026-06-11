import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, SQLiteAppSettingsRepository } from '../app-settings-repository';
import { TestDatabaseClient } from '../database/test-database';

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

  it('writes settings as individual key-value rows', async () => {
    const database = new RecordingAppSettingsDatabase();
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database));

    await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      closeToTray: false,
      dailyReminderEnabled: true,
    });

    expect(database.appSettings.get('theme')?.value).toBe('dark');
    expect(database.appSettings.get('codexModel')?.value).toBe(DEFAULT_APP_SETTINGS.codexModel);
    expect(database.appSettings.get('openAICompatibleApiMode')?.value).toBe(
      'chat-completions',
    );
    expect(JSON.parse(database.appSettings.get('openAICompatibleParameters')?.value ?? '{}')).toEqual({
      temperature: '',
      topP: '',
      presencePenalty: '',
      frequencyPenalty: '',
    });
    expect(database.appSettings.get('localGatewayEnabled')?.value).toBe('true');
    expect(database.appSettings.get('localGatewayBaseUrl')?.value).toBe(
      'http://localhost:8080',
    );
    expect(database.appSettings.get('localGatewayModel')?.value).toBe('');
    expect(database.appSettings.get('localGatewayApiMode')?.value).toBe(
      'chat-completions',
    );
    expect(database.appSettings.get('closeToTray')?.value).toBe('false');
    expect(database.appSettings.get('dailyReminderEnabled')?.value).toBe('true');
    expect(database.appSettings.get('reportLength')?.value).toBe('standard');
    expect(database.appSettings.get('reportTone')?.value).toBe('natural');
    expect(database.appSettings.get('reportFocus')?.value).toBe('outcomes');
    expect(database.appSettings.get('reportStyleHint')?.value).toBe('');
    expect(JSON.parse(database.appSettings.get('reportStyleProfile')?.value ?? '{}')).toEqual({
      enabled: false,
      summary: '',
      promptHint: '',
      updatedAt: '',
    });
    expect(database.appSettings.has('app_settings')).toBe(false);
    expect(database.lastSettingsWrite?.query.toLowerCase()).toContain('key, value, updated_at');
    expect(database.lastSettingsWrite?.query.toLowerCase()).not.toContain('value_json');
  });

  it('fills missing report preferences and style settings from defaults when reading older settings rows', async () => {
    const database = new TestDatabaseClient();
    database.appSettings.set('theme', {
      key: 'theme',
      value: 'dark',
      updated_at: '2026-06-05T01:00:00.000Z',
    });
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database));

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
    });
  });

  it('fills missing OpenAI Compatible api mode from defaults when reading older settings rows', async () => {
    const database = new TestDatabaseClient();
    database.appSettings.set('aiProviderId', {
      key: 'aiProviderId',
      value: 'openai-compatible',
      updated_at: '2026-06-09T01:00:00.000Z',
    });
    database.appSettings.set('openAICompatibleBaseUrl', {
      key: 'openAICompatibleBaseUrl',
      value: 'https://gateway.example.com/v1',
      updated_at: '2026-06-09T01:00:00.000Z',
    });
    database.appSettings.set('openAICompatibleApiKey', {
      key: 'openAICompatibleApiKey',
      value: 'legacy-key',
      updated_at: '2026-06-09T01:00:00.000Z',
    });
    database.appSettings.set('openAICompatibleModel', {
      key: 'openAICompatibleModel',
      value: 'legacy-model',
      updated_at: '2026-06-09T01:00:00.000Z',
    });
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database));

    await expect(repository.getSettings()).resolves.toMatchObject({
      aiProviderId: 'openai-compatible',
      openAICompatible: {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'legacy-key',
        model: 'legacy-model',
        apiMode: 'chat-completions',
        parameters: {
          temperature: '',
          topP: '',
          presencePenalty: '',
          frequencyPenalty: '',
        },
      },
    });
  });

  it('fills missing local gateway settings from defaults when reading older settings rows', async () => {
    const database = new TestDatabaseClient();
    database.appSettings.set('localGatewayEnabled', {
      key: 'localGatewayEnabled',
      value: 'false',
      updated_at: '2026-06-11T01:00:00.000Z',
    });
    database.appSettings.set('localGatewayBaseUrl', {
      key: 'localGatewayBaseUrl',
      value: 'http://localhost:8787',
      updated_at: '2026-06-11T01:00:00.000Z',
    });
    database.appSettings.set('localGatewayModel', {
      key: 'localGatewayModel',
      value: 'gpt-5',
      updated_at: '2026-06-11T01:00:00.000Z',
    });
    const repository = new SQLiteAppSettingsRepository(Promise.resolve(database));

    await expect(repository.getSettings()).resolves.toMatchObject({
      localGateway: {
        enabled: false,
        baseUrl: 'http://localhost:8787',
        model: 'gpt-5',
        apiMode: 'chat-completions',
      },
    });
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

class RecordingAppSettingsDatabase extends TestDatabaseClient {
  lastSettingsWrite: { query: string; bindValues: unknown[] } | null = null;

  override async execute(query: string, bindValues: unknown[] = []) {
    if (query.toLowerCase().includes('insert into app_settings')) {
      this.lastSettingsWrite = { query, bindValues };
    }

    return super.execute(query, bindValues);
  }
}
