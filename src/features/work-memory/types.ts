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
};

export type MemoryStatusActions = {
  canViewDraft: boolean;
  canViewMemory: boolean;
  canViewReports: boolean;
  canGenerateReport: boolean;
};

export type MemoryStatusSummary = {
  title: string;
  description: string;
  actions: MemoryStatusActions;
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
  dailyReportText?: string;
};

export type DailyMemoryGeneratedContent = GeneratedDailyMemory;

export type ReportLength = 'brief' | 'standard' | 'detailed';

export type ReportTone = 'natural' | 'formal' | 'retrospective';

export type ReportFocus = 'outcomes' | 'completed-items' | 'risks';

export type ReportStyleProfile = {
  enabled: boolean;
  summary: string;
  promptHint: string;
  updatedAt: string;
};

export type ReportPreferences = {
  reportLength: ReportLength;
  reportTone: ReportTone;
  reportFocus: ReportFocus;
  reportStyleHint: string;
  reportStyleProfile: ReportStyleProfile;
};

export type AnalyzeReportStyleInput = {
  sampleText: string;
};

export type AnalyzedReportStyle = {
  summary: string;
  promptHint: string;
};

export type ReportGenerationType = 'weekly' | 'custom';

export type WeeklyReportSourceInput = {
  startDate: string;
  endDate: string;
  memories: DailyMemory[];
};

export type GenerateWeeklyReportInput = WeeklyReportSourceInput & ReportPreferences;

export type RangeReportSourceInput = WeeklyReportSourceInput & {
  reportType: ReportGenerationType;
};

export type GenerateRangeReportInput = RangeReportSourceInput & ReportPreferences;

export type GeneratedReportContent = {
  title: string;
  summary: string;
  highlights: string[];
  completedItems: string[];
  problems?: string;
  nextWeekPlan?: string;
  markdown: string;
};

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
