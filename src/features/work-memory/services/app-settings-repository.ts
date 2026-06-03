import type { AIProviderId } from './ai/ai-provider';

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
export const DEFAULT_CODEX_COMMAND = 'codex';

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

export const appSettingsRepository = new LocalStorageAppSettingsRepository();

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
