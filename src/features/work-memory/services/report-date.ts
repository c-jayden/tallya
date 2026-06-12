import { getDailyMemoryDate } from './memory-date';

const DAYS_IN_WEEK = 7;

export type WeekRange = {
  startDate: string;
  endDate: string;
};

export type ReportDateRange = WeekRange;

export function getCurrentWeekRange(now = new Date()): WeekRange {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(current);
  const end = new Date(current);

  start.setDate(current.getDate() + mondayOffset);
  end.setDate(start.getDate() + DAYS_IN_WEEK - 1);

  return {
    startDate: getDailyMemoryDate(start),
    endDate: getDailyMemoryDate(end),
  };
}

export function formatReportDateRange(startDate: string, endDate: string) {
  return `${formatChineseDate(startDate)} - ${formatChineseDate(endDate)}`;
}

export function getDefaultCustomReportRange(now = new Date()): ReportDateRange {
  const weekRange = getCurrentWeekRange(now);

  return {
    startDate: weekRange.startDate,
    endDate: getDailyMemoryDate(now),
  };
}

export function isValidReportDateRange(startDate: string, endDate: string) {
  return isDailyMemoryDate(startDate) && isDailyMemoryDate(endDate) && startDate <= endDate;
}

function formatChineseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return `${year}年${month}月${day}日`;
}

function isDailyMemoryDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
