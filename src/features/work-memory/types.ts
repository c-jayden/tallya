export type OfficialMemoryStatus = 'notGenerated' | 'generated' | 'locked';

export type ReportFreshness = 'fresh' | 'stale';

export type TodayMemoryState = {
  officialStatus: OfficialMemoryStatus;
  hasDraft: boolean;
  referencedByWeeklyReport: boolean;
  reportFreshness: ReportFreshness;
};

export type StatusVariant = 'empty' | 'draft' | 'settled' | 'locked';

export type WeeklySnapshot = {
  settledDays: number;
  lastMemoryDate: string;
  lastMemorySummary: string;
};

export type DailyMemoryStatus = 'draft' | 'generated' | 'locked';

export type DailyMemoryGeneratedSection = {
  title: '今日摘要' | '完成事项' | '关键产出' | '遇到问题' | '明日计划' | '补充说明';
  content: string[];
};

export type DailyMemoryGeneratedContent = {
  sections: DailyMemoryGeneratedSection[];
};

export type DailyMemory = {
  id: string;
  date: string;
  rawContent: string;
  projectTopic: string;
  tomorrowPlan: string;
  extraNote: string;
  generatedContent: DailyMemoryGeneratedContent | null;
  status: DailyMemoryStatus;
  createdAt: string;
  updatedAt: string;
};
