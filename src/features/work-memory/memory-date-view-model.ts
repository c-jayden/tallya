import { getDailyMemoryDate } from './services/daily-memory-repository';

export function isTodayDate(selectedDate: string, todayDate: string) {
  return selectedDate === todayDate;
}

export function isFutureMemoryDate(selectedDate: string, todayDate: string) {
  return selectedDate > todayDate;
}

export function getDailyMemoryHeroCopy(selectedDate: string, todayDate: string) {
  const dayDiff = getDayDiff(selectedDate, todayDate);

  if (dayDiff === 0) {
    return {
      title: '今天做了什么？',
      description: '随便写几句，Tallya 会帮你整理和沉淀。',
    };
  }

  if (dayDiff === 1) {
    return {
      title: '昨天做了什么？',
      description: '写下这一天记得的工作内容，Tallya 会帮你整理。',
    };
  }

  return {
    title: '这一天做了什么？',
    description: '写下这一天记得的工作内容，Tallya 会帮你整理。',
  };
}

export function getDailyMemoryTextareaPlaceholder(isToday: boolean) {
  return isToday
    ? '例如：上午推进需求讨论，下午整理方案并同步进展，明天继续跟进剩余问题。'
    : '例如：整理需求内容，处理反馈，补充说明，并同步后续计划。';
}

export function getDailyMemoryPrimaryActionLabel({
  isToday,
  hasGeneratedMemory,
}: {
  isToday: boolean;
  hasGeneratedMemory: boolean;
}) {
  if (isToday) {
    return hasGeneratedMemory ? '更新今日记录' : '整理成今日记录';
  }

  return hasGeneratedMemory ? '更新这天记录' : '整理成这天记录';
}

export function getDailyMemorySaveGeneratedLabel({
  isToday,
  hasGeneratedMemory,
}: {
  isToday: boolean;
  hasGeneratedMemory: boolean;
}) {
  if (isToday) {
    return hasGeneratedMemory ? '更新今日记录' : '保存为今日记忆';
  }

  return hasGeneratedMemory ? '更新这天记录' : '保存为这天记忆';
}

export function getDailyMemoryPreviewCopy(isToday: boolean) {
  return isToday
    ? {
        title: '今日记忆预览',
        description: '确认后会保存为今天唯一一条工作记忆。',
      }
    : {
        title: '这天记忆预览',
        description: '确认后会保存为这一天的工作记忆。',
      };
}

export function getDailyMemorySaveSuccessToast(isToday: boolean) {
  return isToday ? '今日记忆已保存' : '这天记忆已保存';
}

export function formatToolbarDate(selectedDate: string) {
  const date = getDateFromDailyMemoryDate(selectedDate);

  return {
    date: new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date),
    weekday: new Intl.DateTimeFormat('zh-CN', {
      weekday: 'long',
    }).format(date),
    dateTime: selectedDate,
  };
}

function getDayDiff(selectedDate: string, todayDate: string) {
  const selected = getDateFromDailyMemoryDate(selectedDate);
  const today = getDateFromDailyMemoryDate(todayDate);

  return Math.round((today.getTime() - selected.getTime()) / 86_400_000);
}

function getDateFromDailyMemoryDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

export function getTodayMemoryDate(now = new Date()) {
  return getDailyMemoryDate(now);
}
