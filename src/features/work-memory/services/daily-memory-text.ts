import type { DailyMemory } from '../types';

export function normalizeDailyMemoryText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/^#{1,6}\s+/, ''))
    .filter((line) => line !== '本次未提及')
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDailyMemoryAsDailyReport(memory: DailyMemory) {
  const generated = memory.generated;

  if (!generated) {
    return '';
  }

  const directReport = normalizeDailyMemoryText(generated.dailyReportText ?? '');

  if (directReport) {
    return directReport;
  }

  const summary = normalizeDailyMemoryText(generated.summary);
  const completedItems = normalizeItems(generated.completedItems);
  const keyOutcome = normalizeDailyMemoryText(generated.keyOutcome ?? '');
  const problems = normalizeDailyMemoryText(generated.problems ?? '');
  const tomorrowPlan = normalizeDailyMemoryText(generated.tomorrowPlan ?? '');
  const extraNote = normalizeDailyMemoryText(generated.extraNote ?? '');

  if (
    !summary &&
    completedItems.length === 0 &&
    !keyOutcome &&
    !problems &&
    !tomorrowPlan &&
    !extraNote
  ) {
    return '';
  }

  const shouldUseSections =
    completedItems.length > 1 || Boolean(problems) || Boolean(tomorrowPlan);

  if (!shouldUseSections) {
    return normalizeDailyMemoryText(
      [summary || completedItems[0], keyOutcome, extraNote].filter(Boolean).join(' '),
    );
  }

  const sections: string[] = [];
  const todayWork = buildTodayWorkText({ summary, completedItems, keyOutcome, extraNote });

  if (todayWork) {
    sections.push(`今日完成：${todayWork}`);
  }

  if (problems) {
    sections.push(`遇到问题：${problems}`);
  }

  if (tomorrowPlan) {
    sections.push(`明日计划：${tomorrowPlan}`);
  }

  return normalizeDailyMemoryText(sections.join('\n'));
}

function buildTodayWorkText({
  summary,
  completedItems,
  keyOutcome,
  extraNote,
}: {
  summary: string;
  completedItems: string[];
  keyOutcome: string;
  extraNote: string;
}) {
  const parts = completedItems.length > 0 ? completedItems : [summary];
  const merged = [...parts, keyOutcome, extraNote].filter(Boolean);

  return merged.join('；');
}

function normalizeItems(items: string[]) {
  return items.map((item) => normalizeDailyMemoryText(item)).filter(Boolean);
}
