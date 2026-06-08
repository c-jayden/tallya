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
