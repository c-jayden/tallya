import { getDailyMemoryDate } from './daily-memory-repository';

const DAYS_IN_WEEK = 7;

export type WeekRange = {
  startDate: string;
  endDate: string;
};

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

function formatChineseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return `${year}年${month}月${day}日`;
}
