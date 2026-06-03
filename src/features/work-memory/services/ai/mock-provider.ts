import { mockGenerateDailyMemory } from '../mock-generate-daily-memory';
import type { AIProvider } from './ai-provider';

export const mockProvider: AIProvider = {
  id: 'mock',
  name: 'Mock',
  generateDailyMemory(input) {
    return mockGenerateDailyMemory(input);
  },
};
