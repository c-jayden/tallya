import type {
  DailyMemory,
  DailyMemoryGeneratedContent,
  DailyMemoryPreviewSection,
  StatusVariant,
  TodayMemoryState,
  WeeklySnapshot,
} from './types';

export function getStatusVariant(todayMemory: TodayMemoryState, isLocked: boolean): StatusVariant {
  if (isLocked) {
    return 'locked';
  }

  if (todayMemory.officialStatus === 'generated') {
    return 'settled';
  }

  return todayMemory.hasDraft ? 'draft' : 'empty';
}

export function getMemorySummary(memory: DailyMemory) {
  return memory.generated?.summary ?? memory.rawContent;
}

export function getGeneratedMemories(memories: DailyMemory[]) {
  return memories
    .filter((memory) => (memory.status === 'generated' || memory.status === 'locked') && memory.generated)
    .sort((first, second) => second.date.localeCompare(first.date));
}

function getMemoryDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

export function formatMemoryDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(getMemoryDate(date));
}

export function getRelativeMemoryDate(date: string, currentDate: string) {
  const memoryDate = getMemoryDate(date);
  const current = getMemoryDate(currentDate);
  const dayDiff = Math.round((current.getTime() - memoryDate.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return '今天';
  }

  if (dayDiff === 1) {
    return '昨天';
  }

  if (dayDiff >= 2 && dayDiff < 7) {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(memoryDate);
  }

  return '';
}

export function getMemorySnippet(memory: DailyMemory, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return '';
  }

  const summary = memory.generated?.summary ?? '';
  const normalizedSummary = normalizeComparableText(summary);
  const candidates = [
    memory.rawContent,
    ...(memory.generated?.completedItems ?? []),
    memory.generated?.keyOutcome,
    memory.generated?.problems,
    memory.generated?.tomorrowPlan,
    memory.generated?.extraNote,
    memory.supplements.projectTopic,
    memory.supplements.tomorrowPlan,
    memory.supplements.extraNote,
    memory.date,
  ].filter((value): value is string => Boolean(value));
  const match = candidates.find((value) => {
    if (!value.toLowerCase().includes(normalizedKeyword)) {
      return false;
    }

    const normalizedValue = normalizeComparableText(value);

    return !(
      normalizedValue === normalizedSummary ||
      (normalizedSummary.length > 0 &&
        normalizedValue.includes(normalizedSummary) &&
        normalizedValue.length - normalizedSummary.length <= 8) ||
      (normalizedValue.length > 0 &&
        normalizedSummary.includes(normalizedValue) &&
        normalizedSummary.length - normalizedValue.length <= 8)
    );
  });

  if (!match) {
    return '';
  }

  return match.length > 72 ? `${match.slice(0, 72)}...` : match;
}

function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

export function getFallbackWeeklySnapshot(): WeeklySnapshot {
  return {
    settledDays: 0,
    lastMemoryDate: '',
    lastMemorySummary: '',
  };
}

export function getWeeklySnapshotFromMemories(
  memories: DailyMemory[],
  currentDate: string,
): WeeklySnapshot {
  const generatedMemories = memories
    .filter((memory) => memory.status === 'generated' || memory.status === 'locked')
    .sort((first, second) => second.date.localeCompare(first.date));
  const lastMemory = generatedMemories[0];

  if (!lastMemory) {
    return getFallbackWeeklySnapshot();
  }

  return {
    settledDays: generatedMemories.length,
    lastMemoryDate: lastMemory.date === currentDate ? '今天' : '昨天',
    lastMemorySummary: getMemorySummary(lastMemory),
  };
}

export function getTodayMemoryState(
  memory: DailyMemory | null,
  memories: DailyMemory[] = [],
): TodayMemoryState {
  const hasGeneratedHistory = memories.some(
    (item) => item.status === 'generated' || item.status === 'locked',
  );

  if (!memory) {
    return {
      officialStatus: 'notGenerated',
      hasDraft: false,
      hasGeneratedHistory,
      referencedByWeeklyReport: false,
      reportFreshness: 'fresh',
    };
  }

  return {
    officialStatus:
      memory.status === 'locked'
        ? 'locked'
        : memory.status === 'generated'
          ? 'generated'
          : 'notGenerated',
    hasDraft: memory.status === 'draft',
    hasGeneratedHistory:
      hasGeneratedHistory || memory.status === 'generated' || memory.status === 'locked',
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  };
}

export function getPreviewItems(content: string[]) {
  const items = content.map((item) => item.trim()).filter(Boolean);

  return items.length > 0 ? items : null;
}

export function getMemoryPreviewSections(
  content: DailyMemoryGeneratedContent | null,
): DailyMemoryPreviewSection[] {
  if (!content) {
    return [];
  }

  return [
    {
      title: '今日摘要',
      content: [content.summary],
    },
    {
      title: '完成事项',
      content: content.completedItems,
    },
    {
      title: '关键产出',
      content: content.keyOutcome ? [content.keyOutcome] : [],
    },
    {
      title: '遇到问题',
      content: content.problems ? [content.problems] : [],
    },
    {
      title: '明日计划',
      content: content.tomorrowPlan ? [content.tomorrowPlan] : [],
    },
    {
      title: '补充说明',
      content: content.extraNote ? [content.extraNote] : [],
    },
  ];
}

export function getUnmentionedSectionTitles(content: DailyMemoryGeneratedContent | null) {
  return getMemoryPreviewSections(content)
    .filter((section) => !getPreviewItems(section.content))
    .map((section) => section.title);
}
