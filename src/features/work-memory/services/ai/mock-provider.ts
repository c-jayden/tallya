import { mockGenerateDailyMemory } from './mock-generate-daily-memory';
import type { AIProvider } from './ai-provider';

export const mockProvider: AIProvider = {
  id: 'mock',
  name: 'Mock',
  generateDailyMemory(input) {
    return mockGenerateDailyMemory(input);
  },
  async generateWeeklyReport(input) {
    const completedItems = input.memories.flatMap((memory) => memory.generated?.completedItems ?? []);
    const highlights = completedItems.slice(0, 3);

    return {
      title: '本周周报',
      summary: input.memories.map((memory) => memory.generated?.summary).filter(Boolean).join('；'),
      highlights,
      completedItems,
      problems: input.memories
        .map((memory) => memory.generated?.problems)
        .filter(Boolean)
        .join('；'),
      nextWeekPlan: input.memories
        .map((memory) => memory.generated?.tomorrowPlan ?? memory.supplements.tomorrowPlan)
        .filter(Boolean)
        .join('；'),
      markdown: [
        '# 本周周报',
        '',
        ...input.memories.map((memory) => `- ${memory.date}：${memory.generated?.summary ?? ''}`),
      ].join('\n'),
    };
  },
};
