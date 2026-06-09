import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, LocalStorageAppSettingsRepository } from '../app-settings-repository';

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

describe('LocalStorageAppSettingsRepository', () => {
  it('returns default settings when storage is empty', async () => {
    const repository = new LocalStorageAppSettingsRepository(new MemoryStorage());

    await expect(repository.getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    await expect(repository.getSettings()).resolves.toMatchObject({
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
      diagnosticLoggingEnabled: false,
    });
  });

  it('saves settings and merges missing fields with defaults on read', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageAppSettingsRepository(storage);

    await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      aiProviderId: 'ai-codex-cli',
      codexCommand: 'custom-codex',
      openAICompatible: {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
      },
      dailyReminderEnabled: true,
      theme: 'dark',
      closeToTray: false,
    });

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      codexCommand: 'custom-codex',
      openAICompatible: {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-test',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
      },
      dailyReminderEnabled: true,
      theme: 'dark',
      closeToTray: false,
    });

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        aiProviderId: 'mock',
        codexCommand: 'codex-nightly',
        theme: 'unknown',
      }),
    );

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      codexCommand: 'codex-nightly',
    });

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        aiProviderId: 'openai-compatible',
        openAICompatible: {},
      }),
    );

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      aiProviderId: 'openai-compatible',
      openAICompatible: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-5.4-mini',
      },
    });

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        reportLength: 'unknown',
        reportTone: 'formal',
        reportFocus: 'risks',
      }),
    );

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      reportTone: 'formal',
      reportFocus: 'risks',
    });

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        diagnosticLoggingEnabled: true,
      }),
    );

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      diagnosticLoggingEnabled: true,
    });

    storage.setItem(
      'tallya.app-settings.v1',
      JSON.stringify({
        reportStyleHint: '请保持简洁。',
        reportStyleProfile: {
          enabled: true,
          summary: '偏简洁。',
          promptHint: '使用 3 条以内分点。',
          updatedAt: '2026-06-09T10:00:00.000Z',
        },
      }),
    );

    await expect(repository.getSettings()).resolves.toEqual({
      ...DEFAULT_APP_SETTINGS,
      reportStyleHint: '请保持简洁。',
      reportStyleProfile: {
        enabled: true,
        summary: '偏简洁。',
        promptHint: '使用 3 条以内分点。',
        updatedAt: '2026-06-09T10:00:00.000Z',
      },
    });
  });

  it('resets saved settings back to defaults', async () => {
    const repository = new LocalStorageAppSettingsRepository(new MemoryStorage());

    await repository.saveSettings({
      ...DEFAULT_APP_SETTINGS,
      codexCommand: 'codex-nightly',
      weeklyReminderEnabled: true,
    });

    await expect(repository.resetSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    await expect(repository.getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
  });
});
