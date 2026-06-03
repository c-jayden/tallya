import { invoke } from '@tauri-apps/api/core';
import type { GeneratedDailyMemory } from '../../types';
import { AIProviderError, type AIProvider } from './ai-provider';

export const codexCliProvider: AIProvider = {
  id: 'codex-cli',
  name: 'Codex CLI',
  async generateDailyMemory(input) {
    try {
      return await invoke<GeneratedDailyMemory>('generate_daily_memory_with_codex', { input });
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'Codex 生成失败，请检查 Codex CLI 是否可用。';

      throw new AIProviderError(message, codexCliProvider.id);
    }
  },
};
