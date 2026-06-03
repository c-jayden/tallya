import type { GeneratedDailyMemory, GenerateDailyMemoryInput } from '../../types';

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
  input: GenerateDailyMemoryInput,
): Promise<GeneratedDailyMemory> {
  const supplements = input.supplements ?? {};
  const projectTopic = supplements.projectTopic?.trim();
  const summaryPrefix = projectTopic ? `${projectTopic}：` : '';

  return {
    summary: `${summaryPrefix}${firstSentence(input.rawContent)}`,
    completedItems: splitWorkItems(input.rawContent),
    keyOutcome: '形成了一份可继续沉淀到今日记忆的工作记录。',
    problems: undefined,
    tomorrowPlan: supplements.tomorrowPlan?.trim() || undefined,
    extraNote: supplements.extraNote?.trim() || undefined,
  };
}
