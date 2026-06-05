export type OfficialMemoryStatus = 'notGenerated' | 'generated' | 'locked';

export type ReportFreshness = 'fresh' | 'stale';

export type TodayMemoryState = {
  officialStatus: OfficialMemoryStatus;
  hasDraft: boolean;
  hasGeneratedHistory: boolean;
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

export type DailyMemorySupplements = {
  projectTopic?: string;
  tomorrowPlan?: string;
  extraNote?: string;
};

export type GenerateDailyMemoryInput = {
  date: string;
  rawContent: string;
  supplements?: DailyMemorySupplements;
};

export type GeneratedDailyMemory = {
  summary: string;
  completedItems: string[];
  keyOutcome?: string;
  problems?: string;
  tomorrowPlan?: string;
  extraNote?: string;
};

export type DailyMemoryGeneratedContent = GeneratedDailyMemory;

export type DailyMemoryPreviewSection = {
  title: '今日摘要' | '完成事项' | '关键产出' | '遇到问题' | '明日计划' | '补充说明';
  content: string[];
};

export type DailyMemory = {
  id: string;
  date: string;
  rawContent: string;
  supplements: DailyMemorySupplements;
  generated: DailyMemoryGeneratedContent | null;
  status: DailyMemoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReportType = 'weekly' | 'monthly' | 'yearly' | 'custom' | 'performance' | 'handoff';

export type ReportStatus = 'generated' | 'stale' | 'locked';

export type Report = {
  id: string;
  type: ReportType;
  title: string;
  startDate: string;
  endDate: string;
  content: unknown;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
};

export type ReportSource = {
  id: string;
  reportId: string;
  dailyMemoryId: string;
  dailyMemoryUpdatedAtSnapshot: string;
};
