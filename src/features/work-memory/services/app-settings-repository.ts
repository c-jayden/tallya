import type {
  AnthropicParameters,
  AIProviderId,
  OpenAICompatibleApiMode,
  OpenAICompatibleParameters,
} from './ai/ai-provider';
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_CODEX_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  normalizeProviderModel,
} from './ai/known-models';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
import { createFriendlyError } from './service-error';
import type { ReportFocus, ReportLength, ReportStyleProfile, ReportTone } from '../types';

export type AppTheme = 'system' | 'light' | 'dark';

export type OpenAICompatibleSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiMode: OpenAICompatibleApiMode;
  parameters: OpenAICompatibleParameters;
};

export type AnthropicSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  parameters: AnthropicParameters;
};

export type LocalGatewaySettings = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiMode: OpenAICompatibleApiMode;
};

export type OllamaSettings = {
  baseUrl: string;
  model: string;
};

export type AppSettings = {
  aiProviderId: AIProviderId;
  codexCommand: string;
  codexModel: string;
  openAICompatible: OpenAICompatibleSettings;
  anthropic: AnthropicSettings;
  localGateway: LocalGatewaySettings;
  ollama: OllamaSettings;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  dailyReminderMessage: string;
  weeklyReminderEnabled: boolean;
  weeklyReminderWeekday: string;
  weeklyReminderTime: string;
  weeklyReminderMessage: string;
  reportLength: ReportLength;
  reportTone: ReportTone;
  reportFocus: ReportFocus;
  reportStyleHint: string;
  reportStyleProfile: ReportStyleProfile;
  theme: AppTheme;
  launchAtStartup: boolean;
  closeToTray: boolean;
  startMinimized: boolean;
  diagnosticLoggingEnabled: boolean;
};

const STORAGE_KEY = 'tallya.app-settings.v1';
const LEGACY_MIGRATION_KEY = 'tallya.app-settings.sqlite-migrated.v1';
export const DEFAULT_CODEX_COMMAND = 'codex';

export const DEFAULT_OPENAI_COMPATIBLE_PARAMETERS: OpenAICompatibleParameters = {
  temperature: '',
  topP: '',
  presencePenalty: '',
  frequencyPenalty: '',
  maxTokens: '',
};

export const DEFAULT_ANTHROPIC_PARAMETERS: AnthropicParameters = {
  temperature: '',
  topP: '',
  maxTokens: '',
};

// Defaults define the first-run and reset state. Components should go through
// this repository instead of reading storage directly.
export const DEFAULT_APP_SETTINGS: AppSettings = {
  aiProviderId: 'ai-codex-cli',
  codexCommand: DEFAULT_CODEX_COMMAND,
  codexModel: DEFAULT_CODEX_MODEL,
  openAICompatible: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: DEFAULT_OPENAI_COMPATIBLE_MODEL,
    apiMode: 'chat-completions',
    parameters: DEFAULT_OPENAI_COMPATIBLE_PARAMETERS,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    model: DEFAULT_ANTHROPIC_MODEL,
    parameters: DEFAULT_ANTHROPIC_PARAMETERS,
  },
  // Disabled by default: probing localhost and silently routing work content to
  // whatever answers on a common dev port is too aggressive for a privacy tool.
  localGateway: {
    enabled: false,
    baseUrl: 'http://localhost:8080',
    model: '',
    apiMode: 'chat-completions',
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
  reportLength: 'standard',
  reportTone: 'natural',
  reportFocus: 'outcomes',
  reportStyleHint: '',
  reportStyleProfile: {
    enabled: false,
    summary: '',
    promptHint: '',
    updatedAt: '',
  },
  theme: 'system',
  launchAtStartup: false,
  closeToTray: true,
  startMinimized: false,
  diagnosticLoggingEnabled: false,
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

type AppSettingsRow = {
  key: string;
  value: string;
  updated_at: string;
};

export class SQLiteAppSettingsRepository {
  private legacyStorage: Storage | null;
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
      const rows = await database.select<AppSettingsRow[]>('SELECT key, value FROM app_settings');

      return rows.length > 0 ? normalizeAppSettings(rowsToAppSettingsInput(rows)) : DEFAULT_APP_SETTINGS;
    } catch (error) {
      logger.error('settings', 'app-settings.read_failed', 'Failed to read app settings from SQLite', {
        operation: 'select',
        table: 'app_settings',
        error,
      });

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
      logger.error('settings', 'app-settings.write_failed', 'Failed to save app settings to SQLite', {
        operation: 'upsert',
        table: 'app_settings',
        error,
      });
      throw createFriendlyError('设置保存失败，请稍后重试。', error);
    }
  }

  async resetSettings() {
    return this.saveSettings(DEFAULT_APP_SETTINGS);
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    const database = await this.databasePromise;

    await this.migrateLegacyLocalStorage(database);

    return database;
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
      logger.warn('settings', 'app-settings.legacy_migration_failed', 'Failed to migrate legacy app settings to SQLite', {
        table: 'app_settings',
        error,
      });
    }
  }
}

export const appSettingsRepository = new SQLiteAppSettingsRepository();

async function hasSavedSettings(database: DatabaseClient) {
  const rows = await database.select<AppSettingsRow[]>('SELECT key, value FROM app_settings');

  return rows.length > 0;
}

async function saveAppSettingsRow(
  database: DatabaseClient,
  settings: AppSettings,
  updatedAt: string,
) {
  await database.transaction(async (transactionDatabase) => {
    for (const [key, value] of Object.entries(appSettingsToRows(settings))) {
      await transactionDatabase.execute(
        `
          INSERT INTO app_settings (key, value, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `,
        [key, value, updatedAt],
      );
    }
  });
}

function appSettingsToRows(settings: AppSettings): Record<string, string> {
  return {
    aiProviderId: settings.aiProviderId,
    codexCommand: settings.codexCommand,
    codexModel: settings.codexModel,
    openAICompatibleBaseUrl: settings.openAICompatible.baseUrl,
    openAICompatibleApiKey: settings.openAICompatible.apiKey,
    openAICompatibleModel: settings.openAICompatible.model,
    openAICompatibleApiMode: settings.openAICompatible.apiMode,
    openAICompatibleParameters: JSON.stringify(settings.openAICompatible.parameters),
    anthropicBaseUrl: settings.anthropic.baseUrl,
    anthropicApiKey: settings.anthropic.apiKey,
    anthropicModel: settings.anthropic.model,
    anthropicParameters: JSON.stringify(settings.anthropic.parameters),
    localGatewayEnabled: String(settings.localGateway.enabled),
    localGatewayBaseUrl: settings.localGateway.baseUrl,
    localGatewayModel: settings.localGateway.model,
    localGatewayApiMode: settings.localGateway.apiMode,
    ollamaBaseUrl: settings.ollama.baseUrl,
    ollamaModel: settings.ollama.model,
    dailyReminderEnabled: String(settings.dailyReminderEnabled),
    dailyReminderTime: settings.dailyReminderTime,
    dailyReminderMessage: settings.dailyReminderMessage,
    weeklyReminderEnabled: String(settings.weeklyReminderEnabled),
    weeklyReminderWeekday: settings.weeklyReminderWeekday,
    weeklyReminderTime: settings.weeklyReminderTime,
    weeklyReminderMessage: settings.weeklyReminderMessage,
    reportLength: settings.reportLength,
    reportTone: settings.reportTone,
    reportFocus: settings.reportFocus,
    reportStyleHint: settings.reportStyleHint,
    reportStyleProfile: JSON.stringify(settings.reportStyleProfile),
    theme: settings.theme,
    launchAtStartup: String(settings.launchAtStartup),
    closeToTray: String(settings.closeToTray),
    startMinimized: String(settings.startMinimized),
    diagnosticLoggingEnabled: String(settings.diagnosticLoggingEnabled),
  };
}

function rowsToAppSettingsInput(rows: AppSettingsRow[]) {
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    aiProviderId: values.aiProviderId,
    codexCommand: values.codexCommand,
    codexModel: values.codexModel,
    openAICompatible: {
      baseUrl: values.openAICompatibleBaseUrl,
      apiKey: values.openAICompatibleApiKey,
      model: values.openAICompatibleModel,
      apiMode: values.openAICompatibleApiMode,
      parameters: parseRowJSON(values.openAICompatibleParameters),
    },
    anthropic: {
      baseUrl: values.anthropicBaseUrl,
      apiKey: values.anthropicApiKey,
      model: values.anthropicModel,
      parameters: parseRowJSON(values.anthropicParameters),
    },
    localGateway: {
      enabled: getBooleanString(values.localGatewayEnabled),
      baseUrl: values.localGatewayBaseUrl,
      model: values.localGatewayModel,
      apiMode: values.localGatewayApiMode,
    },
    ollama: {
      baseUrl: values.ollamaBaseUrl,
      model: values.ollamaModel,
    },
    dailyReminderEnabled: getBooleanString(values.dailyReminderEnabled),
    dailyReminderTime: values.dailyReminderTime,
    dailyReminderMessage: values.dailyReminderMessage,
    weeklyReminderEnabled: getBooleanString(values.weeklyReminderEnabled),
    weeklyReminderWeekday: values.weeklyReminderWeekday,
    weeklyReminderTime: values.weeklyReminderTime,
    weeklyReminderMessage: values.weeklyReminderMessage,
    reportLength: values.reportLength,
    reportTone: values.reportTone,
    reportFocus: values.reportFocus,
    reportStyleHint: values.reportStyleHint,
    reportStyleProfile: parseRowJSON(values.reportStyleProfile),
    theme: values.theme,
    launchAtStartup: getBooleanString(values.launchAtStartup),
    closeToTray: getBooleanString(values.closeToTray),
    startMinimized: getBooleanString(values.startMinimized),
    diagnosticLoggingEnabled: getBooleanString(values.diagnosticLoggingEnabled),
  };
}

function getBooleanString(value: string | undefined) {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function parseRowJSON(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS;
  }

  const input = value as Record<string, unknown>;

  return {
    aiProviderId: getAIProviderId(input.aiProviderId),
    codexCommand: getString(input.codexCommand, DEFAULT_APP_SETTINGS.codexCommand),
    codexModel: normalizeProviderModel(
      getAIProviderId(input.aiProviderId),
      getString(input.codexModel, DEFAULT_APP_SETTINGS.codexModel),
    ),
    openAICompatible: normalizeOpenAICompatibleSettings(input.openAICompatible),
    anthropic: normalizeAnthropicSettings(input.anthropic),
    localGateway: normalizeLocalGatewaySettings(input.localGateway),
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
    reportLength: getReportLength(input.reportLength),
    reportTone: getReportTone(input.reportTone),
    reportFocus: getReportFocus(input.reportFocus),
    reportStyleHint: getString(input.reportStyleHint, DEFAULT_APP_SETTINGS.reportStyleHint),
    reportStyleProfile: normalizeReportStyleProfile(input.reportStyleProfile),
    theme: getTheme(input.theme),
    launchAtStartup: getBoolean(input.launchAtStartup, DEFAULT_APP_SETTINGS.launchAtStartup),
    closeToTray: getBoolean(input.closeToTray, DEFAULT_APP_SETTINGS.closeToTray),
    startMinimized: getBoolean(input.startMinimized, DEFAULT_APP_SETTINGS.startMinimized),
    diagnosticLoggingEnabled: getBoolean(
      input.diagnosticLoggingEnabled,
      DEFAULT_APP_SETTINGS.diagnosticLoggingEnabled,
    ),
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

function getReportLength(value: unknown): ReportLength {
  return value === 'brief' || value === 'standard' || value === 'detailed'
    ? value
    : DEFAULT_APP_SETTINGS.reportLength;
}

function getReportTone(value: unknown): ReportTone {
  return value === 'natural' || value === 'formal' || value === 'retrospective'
    ? value
    : DEFAULT_APP_SETTINGS.reportTone;
}

function getReportFocus(value: unknown): ReportFocus {
  return value === 'outcomes' || value === 'completed-items' || value === 'risks'
    ? value
    : DEFAULT_APP_SETTINGS.reportFocus;
}

function normalizeReportStyleProfile(value: unknown): ReportStyleProfile {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.reportStyleProfile;
  }

  const input = value as Record<string, unknown>;

  return {
    enabled: getBoolean(input.enabled, DEFAULT_APP_SETTINGS.reportStyleProfile.enabled),
    summary: getString(input.summary, DEFAULT_APP_SETTINGS.reportStyleProfile.summary),
    promptHint: getString(input.promptHint, DEFAULT_APP_SETTINGS.reportStyleProfile.promptHint),
    updatedAt: getString(input.updatedAt, DEFAULT_APP_SETTINGS.reportStyleProfile.updatedAt),
  };
}

function getAIProviderId(value: unknown): AIProviderId {
  return value === 'ai-codex-cli' ||
    value === 'openai-compatible' ||
    value === 'anthropic' ||
    value === 'ollama'
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
    // An intentionally cleared model must stay empty (volcengine-style presets
    // expect the user to fill in an endpoint id); resurrecting the default here
    // would silently send a foreign model name to the configured service.
    model: getStringAllowEmpty(input.model, DEFAULT_APP_SETTINGS.openAICompatible.model),
    apiMode: getOpenAICompatibleApiMode(input.apiMode),
    parameters: normalizeOpenAICompatibleParameters(input.parameters),
  };
}

function getStringAllowEmpty(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeOpenAICompatibleParameters(value: unknown): OpenAICompatibleParameters {
  if (!value || typeof value !== 'object') {
    return DEFAULT_OPENAI_COMPATIBLE_PARAMETERS;
  }

  const input = value as Record<string, unknown>;

  return {
    temperature: getOptionalNumberString(input.temperature),
    topP: getOptionalNumberString(input.topP),
    presencePenalty: getOptionalNumberString(input.presencePenalty),
    frequencyPenalty: getOptionalNumberString(input.frequencyPenalty),
    maxTokens: getOptionalNumberString(input.maxTokens),
  };
}

function normalizeAnthropicSettings(value: unknown): AnthropicSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.anthropic;
  }

  const input = value as Record<string, unknown>;

  return {
    baseUrl: getString(input.baseUrl, DEFAULT_APP_SETTINGS.anthropic.baseUrl),
    apiKey: getString(input.apiKey, DEFAULT_APP_SETTINGS.anthropic.apiKey),
    model: getString(input.model, DEFAULT_APP_SETTINGS.anthropic.model),
    parameters: normalizeAnthropicParameters(input.parameters),
  };
}

function normalizeAnthropicParameters(value: unknown): AnthropicParameters {
  if (!value || typeof value !== 'object') {
    return DEFAULT_ANTHROPIC_PARAMETERS;
  }

  const input = value as Record<string, unknown>;

  return {
    temperature: getOptionalNumberString(input.temperature),
    topP: getOptionalNumberString(input.topP),
    maxTokens: getOptionalNumberString(input.maxTokens),
  };
}

function getOptionalNumberString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  return trimmed && Number.isFinite(Number(trimmed)) ? trimmed : '';
}

function normalizeLocalGatewaySettings(value: unknown): LocalGatewaySettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.localGateway;
  }

  const input = value as Record<string, unknown>;

  return {
    enabled: getBoolean(input.enabled, DEFAULT_APP_SETTINGS.localGateway.enabled),
    baseUrl: getString(input.baseUrl, DEFAULT_APP_SETTINGS.localGateway.baseUrl),
    model: getString(input.model, DEFAULT_APP_SETTINGS.localGateway.model),
    apiMode: getOpenAICompatibleApiMode(input.apiMode),
  };
}

function getOpenAICompatibleApiMode(value: unknown): OpenAICompatibleApiMode {
  return value === 'responses' || value === 'chat-completions'
    ? value
    : DEFAULT_APP_SETTINGS.openAICompatible.apiMode;
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
