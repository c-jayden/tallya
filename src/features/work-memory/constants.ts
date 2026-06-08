import type { WeeklySnapshot } from './types';

export const today = new Date();

export const displayDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(today);

export const displayWeekday = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'long',
}).format(today);

export const supplementFields = ['项目/主题', '明日计划', '补充说明'] as const;

export type SupplementField = (typeof supplementFields)[number];

export const supplementPlaceholders: Record<SupplementField, string> = {
  '项目/主题': '例如：产品优化、活动筹备、客户交付',
  明日计划: '可选填写明天要跟进的事',
  补充说明: '需要在报告里强调的内容',
};

export const weeklySnapshot: WeeklySnapshot = {
  settledDays: 3,
  lastMemoryDate: '昨天',
};
