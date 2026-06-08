import { mockGenerateDailyMemory } from './mock-generate-daily-memory';
import type { AIProvider } from './ai-provider';

const generateMockRangeReport: AIProvider['generateRangeReport'] = async (input) => {
  const completedItems = input.memories.flatMap((memory) => memory.generated?.completedItems ?? []);
  const highlights = completedItems.slice(0, 3);
  const title =
    input.reportType === 'custom'
      ? `${input.startDate} - ${input.endDate} 工作总结`
      : '本周周报';

  return {
    title,
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
      `# ${title}`,
      '',
      ...input.memories.map((memory) => `- ${memory.date}：${memory.generated?.summary ?? ''}`),
    ].join('\n'),
  };
};

export const mockProvider: AIProvider = {
  id: 'mock',
  name: 'Mock',
  generateDailyMemory(input) {
    return mockGenerateDailyMemory(input);
  },
  async generateWeeklyReport(input) {
    return generateMockRangeReport({
      reportType: 'weekly',
      ...input,
    }, {
      codexCommand: 'codex',
      codexModel: 'gpt-5.4-mini',
    });
  },
  generateRangeReport: generateMockRangeReport,
};
