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

export type SuggestClarificationsInput = {
  content: string;
};

export type AnalyzedReportStyle = {
  summary: string;
  promptHint: string;
};

export type ReportGenerationType = 'weekly' | 'custom';

// One entry as seen by report generation: the note, its clarification answers,
// and the thread it belongs to (so the AI can aggregate a cross-day storyline).
export type ReportSourceEntry = {
  occurredOn: string;
  content: string;
  clarifications: string[];
  threadTitle: string | null;
};

export type WeeklyReportSourceInput = {
  startDate: string;
  endDate: string;
  entries: ReportSourceEntry[];
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

// A single low-friction work-memory entry. Capture stays structureless: just
// text plus a timestamp. thread_id / difficulty / effort are reserved for later
// milestones (thread linking, light metadata) and stay null until then.
export type Entry = {
  id: string;
  content: string;
  occurredAt: string; // ISO timestamp of when the work happened/was logged
  occurredOn: string; // YYYY-MM-DD derived from occurredAt, used for day grouping
  threadId: string | null;
  difficulty: number | null;
  effort: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateEntryInput = {
  content: string;
  occurredAt?: string;
};

export type UpdateEntryInput = {
  content: string;
};

// A follow-up that adds real detail to an entry without rewriting it. question
// is null for manual additions (no AI prompt), set when AI asked something.
export type Clarification = {
  id: string;
  entryId: string;
  question: string | null;
  answer: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateClarificationInput = {
  entryId: string;
  question?: string | null;
  answer: string;
};

export type ThreadStatus = 'open' | 'archived';

// A thread groups entries that turned out to be the same cross-day piece of
// work. Threads have no hierarchy or task state — just a title for the
// storyline. Entries point at a thread via Entry.threadId.
export type Thread = {
  id: string;
  title: string;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateThreadInput = {
  title: string;
  status?: ThreadStatus;
};

export type UpdateThreadInput = {
  title?: string;
  status?: ThreadStatus;
};

// A thread plus the aggregate stats the thread browser needs (entry count and
// the span of days it covers), so the list can render without loading entries.
export type ThreadSummary = Thread & {
  entryCount: number;
  firstOccurredOn: string;
  lastOccurredOn: string;
};

// One recent entry offered to the AI as a possible match for a new entry. The
// thread fields are set when the candidate already belongs to a thread, so the
// AI can suggest joining an existing storyline instead of starting a new one.
export type ThreadLinkCandidate = {
  id: string;
  content: string;
  occurredOn: string;
  threadId: string | null;
  threadTitle: string | null;
};

export type SuggestThreadLinkInput = {
  content: string;
  candidates: ThreadLinkCandidate[];
};

// relatedEntryId is the candidate the new entry continues (or null when the AI
// finds no match). threadTitle is a short suggested name for the shared thread.
export type ThreadLinkSuggestion = {
  relatedEntryId: string | null;
  threadTitle: string;
};

// One entry offered to report gap-detection, carrying its id (so an answer can
// be saved back), thread, and how many clarifications it already has.
export type ReportGapEntry = {
  id: string;
  occurredOn: string;
  content: string;
  clarificationCount: number;
  threadId: string | null;
  threadTitle: string | null;
};

export type SuggestReportGapsInput = {
  entries: ReportGapEntry[];
};

// An "important but thin" thread the AI flags before a report: a representative
// entryId to attach the answer to, the thread title, and one short question.
export type ReportGap = {
  entryId: string;
  threadTitle: string;
  question: string;
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
