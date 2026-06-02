import type { DailyMemoryGeneratedContent } from '../types';

type MockGenerateDailyMemoryInput = {
  rawContent: string;
  projectTopic: string;
  tomorrowPlan: string;
  extraNote: string;
};

function firstSentence(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '今天补充了一条工作记录。';
  }

  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

function splitWorkItems(value: string) {
  const items = value
    .split(/[\n。；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items.slice(0, 3) : ['已记录今日主要工作内容。'];
}

export async function mockGenerateDailyMemory(
  input: MockGenerateDailyMemoryInput,
): Promise<DailyMemoryGeneratedContent> {
  const summaryPrefix = input.projectTopic.trim() ? `${input.projectTopic.trim()}：` : '';
  const tomorrowPlan = input.tomorrowPlan.trim();
  const extraNote = input.extraNote.trim();

  return {
    sections: [
      {
        title: '今日摘要',
        content: [`${summaryPrefix}${firstSentence(input.rawContent)}`],
      },
      {
        title: '完成事项',
        content: splitWorkItems(input.rawContent),
      },
      {
        title: '关键产出',
        content: ['形成了一份可继续沉淀到今日记忆的工作记录。'],
      },
      {
        title: '遇到问题',
        content: [],
      },
      {
        title: '明日计划',
        content: tomorrowPlan ? [tomorrowPlan] : [],
      },
      {
        title: '补充说明',
        content: extraNote ? [extraNote] : [],
      },
    ],
  };
}
