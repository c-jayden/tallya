import { mockGenerateDailyMemory } from './mock-generate-daily-memory';
import type { AIProvider } from './ai-provider';

const generateMockRangeReport: AIProvider['generateRangeReport'] = async (input) => {
  const completedItems = input.entries.map((entry) => entry.content);
  const highlights = completedItems.slice(0, 3);
  const title =
    input.reportType === 'custom'
      ? `${input.startDate} - ${input.endDate} 工作总结`
      : '本周回顾';

  return {
    title,
    summary: input.entries.map((entry) => entry.content).join('；'),
    highlights,
    completedItems,
    problems: '',
    nextWeekPlan: '',
    markdown: [
      `# ${title}`,
      '',
      ...input.entries.map((entry) => `- ${entry.occurredOn}：${entry.content}`),
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
  async analyzeReportStyle() {
    return {
      summary: '偏简洁，常用分点结构，语气自然。',
      promptHint: '整理时保持简洁自然，优先使用 3-5 条分点表达完成事项。',
    };
  },
};
