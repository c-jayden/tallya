import type {
  DailyMemory,
  DailyMemoryGeneratedContent,
  DailyMemoryPreviewSection,
  MemoryStatusSummary,
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
  // Only formal memories enter history-like views; drafts remain editable on today's surface.
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
  const dayDiff = getDateDiffInDays(memoryDate, current);

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
  };
}

export function formatRecentMemoryDate(date: string, currentDate: string) {
  return formatMemoryDateLabel(date, currentDate);
}

export function formatMemoryDateLabel(date: string, currentDate: string) {
  const memoryDate = getMemoryDate(date);
  const current = getMemoryDate(currentDate);
  const dayDiff = getDateDiffInDays(memoryDate, current);

  if (dayDiff === 0) {
    return '今天';
  }

  if (dayDiff === 1) {
    return '昨天';
  }

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return `${memoryDate.getMonth() + 1}月${memoryDate.getDate()}日 ${weekdays[memoryDate.getDay()]}`;
}

export function getWeeklySnapshotFromMemories(
  memories: DailyMemory[],
  currentDate: string,
): WeeklySnapshot {
  const generatedMemories = memories
    .filter(isFormalMemory)
    .sort((first, second) => second.date.localeCompare(first.date));
  const lastMemory = generatedMemories[0];

  if (!lastMemory) {
    return getFallbackWeeklySnapshot();
  }
  const weekRange = getWeekDateRange(currentDate);
  const settledDates = new Set(
    generatedMemories
      .filter((memory) => memory.date >= weekRange.startDate && memory.date <= weekRange.endDate)
      .map((memory) => memory.date),
  );

  return {
    settledDays: settledDates.size,
    lastMemoryDate: formatRecentMemoryDate(lastMemory.date, currentDate),
  };
}

function isFormalMemory(memory: DailyMemory) {
  return (
    (memory.status === 'generated' || memory.status === 'locked') &&
    memory.generated !== null
  );
}

export function getMemoryStatusSummary({
  selectedDate,
  todayDate,
  selectedDateMemory,
  memories,
  hasReports,
  hasCurrentWeekReport = false,
}: {
  selectedDate: string;
  todayDate: string;
  selectedDateMemory: DailyMemory | null;
  memories: DailyMemory[];
  hasReports: boolean;
  hasCurrentWeekReport?: boolean;
}): MemoryStatusSummary {
  const formalMemories = memories
    .filter(isFormalMemory)
    .sort((first, second) => second.date.localeCompare(first.date));
  const hasFormalMemories = formalMemories.length > 0;
  const selectedDateHasDraft = selectedDateMemory?.status === 'draft';
  const selectedDateHasFormalMemory = selectedDateMemory ? isFormalMemory(selectedDateMemory) : false;
  const todayHasDraft = memories.some((memory) => memory.date === todayDate && memory.status === 'draft');
  const isSelectedDateToday = selectedDate === todayDate;
  const selectedDateLabel = formatMemoryDateLabel(selectedDate, todayDate);
  const weeklySnapshot = getWeeklySnapshotFromMemories(memories, todayDate);
  const baseActions = {
    canViewDraft: false,
    canViewMemory: hasFormalMemories,
    canViewReports: hasFormalMemories && hasReports,
    canGenerateReport: hasFormalMemories,
  };

  if (!hasFormalMemories && !todayHasDraft && !selectedDateHasDraft) {
    return {
      title: '还没有工作记忆',
      description: '整理第一条记录后，这里会显示你的沉淀进度。',
      actions: {
        canViewDraft: false,
        canViewMemory: false,
        canViewReports: false,
        canGenerateReport: false,
      },
    };
  }

  if (selectedDateHasDraft && !selectedDateHasFormalMemory) {
    return {
      title: isSelectedDateToday ? '今日草稿已保存' : '这天草稿已保存',
      description: isSelectedDateToday
        ? '整理成今日记录后，会开始沉淀你的工作记忆。'
        : '整理成这天记录后，会沉淀为对应日期的工作记忆。',
      actions: {
        ...baseActions,
        canViewDraft: true,
      },
    };
  }

  if (!hasFormalMemories) {
    return {
      title: '还没有工作记忆',
      description: '整理第一条记录后，这里会显示你的沉淀进度。',
      actions: {
        canViewDraft: false,
        canViewMemory: false,
        canViewReports: false,
        canGenerateReport: false,
      },
    };
  }

  if (isSelectedDateToday && selectedDateHasFormalMemory) {
    return {
      title: '今日记忆已沉淀',
      description: '你可以继续补充内容并重新整理。',
      actions: baseActions,
    };
  }

  if (!isSelectedDateToday && selectedDateHasFormalMemory) {
    return {
      title: '这天记忆已沉淀',
      description: `当前正在查看/编辑 ${selectedDateLabel} 的工作记忆。`,
      actions: baseActions,
    };
  }

  if (!isSelectedDateToday && hasFormalMemories) {
    return {
      title: '这天还没有工作记忆',
      description: `写下几句后，可以沉淀为 ${selectedDateLabel} 的记录。`,
      actions: baseActions,
    };
  }

  if (hasCurrentWeekReport && weeklySnapshot.settledDays === 0) {
    return {
      title: '本周回顾已保存',
      description: '可以查看已保存的整理，或在更新记忆后重新整理。',
      actions: baseActions,
    };
  }

  if (weeklySnapshot.settledDays > 0) {
    return {
      title: `本周已沉淀 ${weeklySnapshot.settledDays} 天`,
      description: `最近记录：${weeklySnapshot.lastMemoryDate}`,
      actions: baseActions,
    };
  }

  return {
    title: '历史记忆已沉淀',
    description: `最近记录：${weeklySnapshot.lastMemoryDate}`,
    actions: baseActions,
  };
}

export function shouldConfirmReferencedMemoryUpdate({
  isReferenced,
  currentStatus,
}: {
  isReferenced: boolean;
  currentStatus: DailyMemory['status'] | null;
}) {
  return isReferenced && (currentStatus === 'generated' || currentStatus === 'locked');
}

function getWeekDateRange(currentDate: string) {
  const current = getMemoryDate(currentDate);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(current);
  const end = new Date(current);

  start.setDate(current.getDate() + mondayOffset);
  end.setDate(start.getDate() + 6);

  return {
    startDate: formatMemoryDateKey(start),
    endDate: formatMemoryDateKey(end),
  };
}

function getDateDiffInDays(first: Date, second: Date) {
  const firstTime = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate());
  const secondTime = Date.UTC(second.getFullYear(), second.getMonth(), second.getDate());

  return Math.round((secondTime - firstTime) / 86_400_000);
}

function formatMemoryDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayMemoryState(
  memory: DailyMemory | null,
  memories: DailyMemory[] = [],
): TodayMemoryState {
  // The home status separates a draft from the single formal memory for the day.
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
