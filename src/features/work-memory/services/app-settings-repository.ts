import type { AIProviderId } from './ai/ai-provider';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { createFriendlyError } from './service-error';

export type AppTheme = 'system' | 'light' | 'dark';

export type OpenAICompatibleSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type OllamaSettings = {
  baseUrl: string;
  model: string;
};

export type AppSettings = {
  aiProviderId: AIProviderId;
  codexCommand: string;
  openAICompatible: OpenAICompatibleSettings;
  ollama: OllamaSettings;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  dailyReminderMessage: string;
  weeklyReminderEnabled: boolean;
  weeklyReminderWeekday: string;
  weeklyReminderTime: string;
  weeklyReminderMessage: string;
  theme: AppTheme;
  launchAtStartup: boolean;
  closeToTray: boolean;
  startMinimized: boolean;
};

const STORAGE_KEY = 'tallya.app-settings.v1';
const SETTINGS_ROW_KEY = 'app_settings';
const LEGACY_MIGRATION_KEY = 'tallya.app-settings.sqlite-migrated.v1';
export const DEFAULT_CODEX_COMMAND = 'codex';

// Defaults define the first-run and reset state. Components should go through
// this repository instead of reading storage directly.
export const DEFAULT_APP_SETTINGS: AppSettings = {
  aiProviderId: 'ai-codex-cli',
  codexCommand: DEFAULT_CODEX_COMMAND,
  openAICompatible: {
    baseUrl: '',
    apiKey: '',
    model: '',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: '',
  },
  dailyReminderEnabled: false,
  dailyReminderTime: '18:00',
  dailyReminderMessage: '可以花一分钟沉淀一下今天的工作。',
  weeklyReminderEnabled: false,
  weeklyReminderWeekday: 'friday',
  weeklyReminderTime: '18:30',
  weeklyReminderMessage: '可以整理一下这周的工作脉络了。',
  theme: 'system',
  launchAtStartup: false,
  closeToTray: true,
  startMinimized: false,
};

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export class LocalStorageAppSettingsRepository {
  constructor(private readonly storage: Storage | null = getBrowserStorage()) {}

  async getSettings() {
    return this.readSettings();
  }

  async saveSettings(settings: AppSettings) {
    const normalizedSettings = normalizeAppSettings(settings);

    this.storage?.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));

    return normalizedSettings;
  }

  async resetSettings() {
    return this.saveSettings(DEFAULT_APP_SETTINGS);
  }

  private readSettings() {
    if (!this.storage) {
      return DEFAULT_APP_SETTINGS;
    }

    const rawValue = this.storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_APP_SETTINGS;
    }

    try {
      return normalizeAppSettings(JSON.parse(rawValue) as unknown);
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  }
}

type AppSettingsColumnRow = {
  key: string;
  ai_provider_id: string;
  codex_command: string;
  openai_base_url: string;
  openai_api_key: string;
  openai_model: string;
  ollama_base_url: string;
  ollama_model: string;
  daily_reminder_enabled: number | boolean;
  daily_reminder_time: string;
  daily_reminder_message: string;
  weekly_reminder_enabled: number | boolean;
  weekly_reminder_weekday: string;
  weekly_reminder_time: string;
  weekly_reminder_message: string;
  theme: string;
  launch_at_startup: number | boolean;
  close_to_tray: number | boolean;
  start_minimized: number | boolean;
  updated_at: string;
};

type LegacyAppSettingsJsonRow = {
  value_json: string;
};

type TableNameRow = {
  name: string;
};

export class SQLiteAppSettingsRepository {
  private legacyStorage: Storage | null;
  private didAttemptLegacySQLiteMigration = false;
  private didAttemptLegacyMigration = false;
  private databasePromise: Promise<DatabaseClient> | null;
  private readonly now: () => Date;

  constructor(
    database?: Promise<DatabaseClient>,
    options: { legacyStorage?: Storage | null; now?: () => Date } = {},
  ) {
    this.databasePromise = database ?? null;
    this.legacyStorage = options.legacyStorage ?? getBrowserStorage();
    this.now = options.now ?? (() => new Date());
  }

  async getSettings() {
    try {
      const database = await this.getReadyDatabase();
      const rows = await database.select<AppSettingsColumnRow[]>(
        'SELECT * FROM app_settings WHERE key = $1 LIMIT 1',
        [SETTINGS_ROW_KEY],
      );

      return normalizeAppSettingsRow(rows[0]) ?? DEFAULT_APP_SETTINGS;
    } catch (error) {
      console.error('Failed to read app settings from SQLite', error);

      return DEFAULT_APP_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings) {
    const normalizedSettings = normalizeAppSettings(settings);

    try {
      const database = await this.getReadyDatabase();

      await saveAppSettingsRow(database, normalizedSettings, this.now().toISOString());

      return normalizedSettings;
    } catch (error) {
      console.error('Failed to save app settings to SQLite', error);
      throw createFriendlyError('设置保存失败，请稍后重试。', error);
    }
  }

  async resetSettings() {
    return this.saveSettings(DEFAULT_APP_SETTINGS);
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    const database = await this.databasePromise;

    await this.migrateLegacySQLiteJson(database);
    await this.migrateLegacyLocalStorage(database);

    return database;
  }

  private async migrateLegacySQLiteJson(database: DatabaseClient) {
    if (this.didAttemptLegacySQLiteMigration) {
      return;
    }

    this.didAttemptLegacySQLiteMigration = true;

    try {
      if (await hasSavedSettings(database)) {
        return;
      }

      const legacyTables = await database.select<TableNameRow[]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings_legacy_json'",
      );

      if (legacyTables.length === 0) {
        return;
      }

      const rows = await database.select<LegacyAppSettingsJsonRow[]>(
        'SELECT value_json FROM app_settings_legacy_json WHERE key = $1 LIMIT 1',
        [SETTINGS_ROW_KEY],
      );

      if (!rows[0]?.value_json) {
        return;
      }

      await saveAppSettingsRow(
        database,
        normalizeAppSettings(JSON.parse(rows[0].value_json) as unknown),
        this.now().toISOString(),
      );
    } catch (error) {
      console.warn('Failed to migrate legacy SQLite app settings to columns', error);
    }
  }

  private async migrateLegacyLocalStorage(database: DatabaseClient) {
    if (this.didAttemptLegacyMigration) {
      return;
    }

    this.didAttemptLegacyMigration = true;

    if (
      !this.legacyStorage ||
      this.legacyStorage.getItem(LEGACY_MIGRATION_KEY) === '1' ||
      !this.legacyStorage.getItem(STORAGE_KEY)
    ) {
      return;
    }

    try {
      if (await hasSavedSettings(database)) {
        this.legacyStorage.setItem(LEGACY_MIGRATION_KEY, '1');
        return;
      }

      const legacyRepository = new LocalStorageAppSettingsRepository(this.legacyStorage);
      const legacySettings = await legacyRepository.getSettings();

      await saveAppSettingsRow(database, legacySettings, this.now().toISOString());
      this.legacyStorage.setItem(LEGACY_MIGRATION_KEY, '1');
    } catch (error) {
      console.warn('Failed to migrate legacy app settings to SQLite', error);
    }
  }
}

export const appSettingsRepository = new SQLiteAppSettingsRepository();

async function hasSavedSettings(database: DatabaseClient) {
  const rows = await database.select<AppSettingsColumnRow[]>(
    'SELECT * FROM app_settings WHERE key = $1 LIMIT 1',
    [SETTINGS_ROW_KEY],
  );

  return rows.length > 0;
}

async function saveAppSettingsRow(
  database: DatabaseClient,
  settings: AppSettings,
  updatedAt: string,
) {
  await database.execute(
    `
      INSERT INTO app_settings (
        key,
        ai_provider_id,
        codex_command,
        openai_base_url,
        openai_api_key,
        openai_model,
        ollama_base_url,
        ollama_model,
        daily_reminder_enabled,
        daily_reminder_time,
        daily_reminder_message,
        weekly_reminder_enabled,
        weekly_reminder_weekday,
        weekly_reminder_time,
        weekly_reminder_message,
        theme,
        launch_at_startup,
        close_to_tray,
        start_minimized,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT(key) DO UPDATE SET
        ai_provider_id = excluded.ai_provider_id,
        codex_command = excluded.codex_command,
        openai_base_url = excluded.openai_base_url,
        openai_api_key = excluded.openai_api_key,
        openai_model = excluded.openai_model,
        ollama_base_url = excluded.ollama_base_url,
        ollama_model = excluded.ollama_model,
        daily_reminder_enabled = excluded.daily_reminder_enabled,
        daily_reminder_time = excluded.daily_reminder_time,
        daily_reminder_message = excluded.daily_reminder_message,
        weekly_reminder_enabled = excluded.weekly_reminder_enabled,
        weekly_reminder_weekday = excluded.weekly_reminder_weekday,
        weekly_reminder_time = excluded.weekly_reminder_time,
        weekly_reminder_message = excluded.weekly_reminder_message,
        theme = excluded.theme,
        launch_at_startup = excluded.launch_at_startup,
        close_to_tray = excluded.close_to_tray,
        start_minimized = excluded.start_minimized,
        updated_at = excluded.updated_at
    `,
    [
      SETTINGS_ROW_KEY,
      settings.aiProviderId,
      settings.codexCommand,
      settings.openAICompatible.baseUrl,
      settings.openAICompatible.apiKey,
      settings.openAICompatible.model,
      settings.ollama.baseUrl,
      settings.ollama.model,
      toSqliteBoolean(settings.dailyReminderEnabled),
      settings.dailyReminderTime,
      settings.dailyReminderMessage,
      toSqliteBoolean(settings.weeklyReminderEnabled),
      settings.weeklyReminderWeekday,
      settings.weeklyReminderTime,
      settings.weeklyReminderMessage,
      settings.theme,
      toSqliteBoolean(settings.launchAtStartup),
      toSqliteBoolean(settings.closeToTray),
      toSqliteBoolean(settings.startMinimized),
      updatedAt,
    ],
  );
}

function normalizeAppSettingsRow(row: AppSettingsColumnRow | undefined) {
  if (!row) {
    return null;
  }

  return normalizeAppSettings({
    aiProviderId: row.ai_provider_id,
    codexCommand: row.codex_command,
    openAICompatible: {
      baseUrl: row.openai_base_url,
      apiKey: row.openai_api_key,
      model: row.openai_model,
    },
    ollama: {
      baseUrl: row.ollama_base_url,
      model: row.ollama_model,
    },
    dailyReminderEnabled: getSqliteBoolean(
      row.daily_reminder_enabled,
      DEFAULT_APP_SETTINGS.dailyReminderEnabled,
    ),
    dailyReminderTime: row.daily_reminder_time,
    dailyReminderMessage: row.daily_reminder_message,
    weeklyReminderEnabled: getSqliteBoolean(
      row.weekly_reminder_enabled,
      DEFAULT_APP_SETTINGS.weeklyReminderEnabled,
    ),
    weeklyReminderWeekday: row.weekly_reminder_weekday,
    weeklyReminderTime: row.weekly_reminder_time,
    weeklyReminderMessage: row.weekly_reminder_message,
    theme: row.theme,
    launchAtStartup: getSqliteBoolean(
      row.launch_at_startup,
      DEFAULT_APP_SETTINGS.launchAtStartup,
    ),
    closeToTray: getSqliteBoolean(row.close_to_tray, DEFAULT_APP_SETTINGS.closeToTray),
    startMinimized: getSqliteBoolean(
      row.start_minimized,
      DEFAULT_APP_SETTINGS.startMinimized,
    ),
  });
}

function toSqliteBoolean(value: boolean) {
  return value ? 1 : 0;
}

function getSqliteBoolean(value: number | boolean, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 1 ? true : value === 0 ? false : fallback;
}

function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS;
  }

  const input = value as Record<string, unknown>;

  return {
    aiProviderId: getAIProviderId(input.aiProviderId),
    codexCommand: getString(input.codexCommand, DEFAULT_APP_SETTINGS.codexCommand),
    openAICompatible: normalizeOpenAICompatibleSettings(input.openAICompatible),
    ollama: normalizeOllamaSettings(input.ollama),
    dailyReminderEnabled: getBoolean(
      input.dailyReminderEnabled,
      DEFAULT_APP_SETTINGS.dailyReminderEnabled,
    ),
    dailyReminderTime: getString(input.dailyReminderTime, DEFAULT_APP_SETTINGS.dailyReminderTime),
    dailyReminderMessage: getString(
      input.dailyReminderMessage,
      DEFAULT_APP_SETTINGS.dailyReminderMessage,
    ),
    weeklyReminderEnabled: getBoolean(
      input.weeklyReminderEnabled,
      DEFAULT_APP_SETTINGS.weeklyReminderEnabled,
    ),
    weeklyReminderWeekday: getString(
      input.weeklyReminderWeekday,
      DEFAULT_APP_SETTINGS.weeklyReminderWeekday,
    ),
    weeklyReminderTime: getString(
      input.weeklyReminderTime,
      DEFAULT_APP_SETTINGS.weeklyReminderTime,
    ),
    weeklyReminderMessage: getString(
      input.weeklyReminderMessage,
      DEFAULT_APP_SETTINGS.weeklyReminderMessage,
    ),
    theme: getTheme(input.theme),
    launchAtStartup: getBoolean(input.launchAtStartup, DEFAULT_APP_SETTINGS.launchAtStartup),
    closeToTray: getBoolean(input.closeToTray, DEFAULT_APP_SETTINGS.closeToTray),
    startMinimized: getBoolean(input.startMinimized, DEFAULT_APP_SETTINGS.startMinimized),
  };
}

function getString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function getTheme(value: unknown): AppTheme {
  return value === 'system' || value === 'light' || value === 'dark'
    ? value
    : DEFAULT_APP_SETTINGS.theme;
}

function getAIProviderId(value: unknown): AIProviderId {
  return value === 'ai-codex-cli' || value === 'openai-compatible' || value === 'ollama'
    ? value
    : DEFAULT_APP_SETTINGS.aiProviderId;
}

function normalizeOpenAICompatibleSettings(value: unknown): OpenAICompatibleSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.openAICompatible;
  }

  const input = value as Record<string, unknown>;

  return {
    baseUrl: getString(input.baseUrl, DEFAULT_APP_SETTINGS.openAICompatible.baseUrl),
    apiKey: getString(input.apiKey, DEFAULT_APP_SETTINGS.openAICompatible.apiKey),
    model: getString(input.model, DEFAULT_APP_SETTINGS.openAICompatible.model),
  };
}

function normalizeOllamaSettings(value: unknown): OllamaSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.ollama;
  }

  const input = value as Record<string, unknown>;

  return {
    baseUrl: getString(input.baseUrl, DEFAULT_APP_SETTINGS.ollama.baseUrl),
    model: getString(input.model, DEFAULT_APP_SETTINGS.ollama.model),
  };
}
