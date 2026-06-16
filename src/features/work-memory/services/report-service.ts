import type {
  Clarification,
  CreateClarificationInput,
  Entry,
  GeneratedReportContent,
  RangeReportSourceInput,
  Report,
  ReportGap,
  ReportGapEntry,
  ReportGenerationType,
  ReportSourceEntry,
  Thread,
  ThreadSummary,
} from '../types';
import { aiService as defaultAIService } from './ai/ai-service';
import { clarificationRepository as defaultClarificationRepository } from './clarification-repository';
import { entryRepository as defaultEntryRepository } from './entry-repository';
import { reportRepository as defaultReportRepository } from './report-repository';
import { threadRepository as defaultThreadRepository } from './thread-repository';
import { threadService as defaultThreadService } from './thread-service';
import { getCurrentWeekRange } from './report-date';
import { getDailyMemoryDate } from './memory-date';
import { selectStalledThreadGaps } from './stalled-threads';
import { logger } from './logger/logger';

export type ReportEntryRepository = {
  listRange(startDate: string, endDate: string): Promise<Entry[]>;
};

export type ReportClarificationRepository = {
  listByEntryIds(entryIds: string[]): Promise<Clarification[]>;
  create(input: CreateClarificationInput): Promise<Clarification>;
};

export type ReportThreadRepository = {
  list(): Promise<Thread[]>;
};

// Stalled-thread review needs thread-level stats across all time (entry count and
// day span), not just the entries inside the report range, so it reads summaries.
export type ReportThreadSummaryProvider = {
  listThreadSummaries(): Promise<ThreadSummary[]>;
};

export type ReportRepository = {
  getAllReports(): Promise<Report[]>;
  getReportsByType(type: Report['type']): Promise<Report[]>;
  getReportByTypeAndRange(type: ReportGenerationType, startDate: string, endDate: string): Promise<Report | null>;
  getWeeklyReportByRange(startDate: string, endDate: string): Promise<Report | null>;
  saveReport(report: Report): Promise<void>;
  updateReport(report: Report): Promise<void>;
  getReportById(id: string): Promise<Report | null>;
};

export type ReportAIService = {
  generateRangeReport(input: RangeReportSourceInput): Promise<GeneratedReportContent>;
  suggestReportGaps(input: { entries: ReportGapEntry[] }): Promise<ReportGap[]>;
};

export type GapAnswer = {
  entryId: string;
  question: string;
  answer: string;
};

export type ReportServiceOptions = {
  now?: () => Date;
  entryRepository?: ReportEntryRepository;
  clarificationRepository?: ReportClarificationRepository;
  threadRepository?: ReportThreadRepository;
  threadSummaryProvider?: ReportThreadSummaryProvider;
  reportRepository?: ReportRepository;
  aiService?: ReportAIService;
};

export type ReportContext = {
  reportType: ReportGenerationType;
  startDate: string;
  endDate: string;
  entries: ReportSourceEntry[];
  existingReport: Report | null;
  overlappingReports?: Report[];
};

export type ReportSaveMode = 'overwrite' | 'create';

export type ReportDraft = ReportContext & {
  generated: GeneratedReportContent;
  saveMode?: ReportSaveMode;
  overwriteReportId?: string;
};

export type WeeklyReportContext = Omit<ReportContext, 'reportType'>;
export type WeeklyReportDraft = Omit<ReportDraft, 'reportType'> & {
  reportType?: 'weekly';
};

export function createReportService({
  now = () => new Date(),
  entryRepository = defaultEntryRepository,
  clarificationRepository = defaultClarificationRepository,
  threadRepository = defaultThreadRepository,
  threadSummaryProvider = defaultThreadService,
  reportRepository = defaultReportRepository,
  aiService = defaultAIService,
}: ReportServiceOptions = {}) {
  const sourceRepositories = { entryRepository, clarificationRepository, threadRepository };

  return {
    async getAllReports() {
      return reportRepository.getAllReports();
    },

    async getCurrentWeeklyReportContext(): Promise<WeeklyReportContext> {
      const { startDate, endDate } = getCurrentWeekRange(now());
      const context = await getReportContext(
        sourceRepositories,
        reportRepository,
        'weekly',
        startDate,
        endDate,
      );

      return toWeeklyContext(context);
    },

    async getReportContext(
      reportType: ReportGenerationType,
      startDate: string,
      endDate: string,
    ): Promise<ReportContext> {
      return getReportContext(sourceRepositories, reportRepository, reportType, startDate, endDate);
    },

    async generateCurrentWeeklyReport(): Promise<WeeklyReportDraft> {
      const context = await this.getCurrentWeeklyReportContext();
      const draft = await generateReportDraft(aiService, {
        reportType: 'weekly',
        ...context,
      });

      return toWeeklyDraft(draft);
    },

    async generateCustomRangeReport(startDate: string, endDate: string): Promise<ReportDraft> {
      const context = await this.getReportContext('custom', startDate, endDate);

      return generateReportDraft(aiService, context);
    },

    async generateWeeklyReportForRange(report: Report): Promise<WeeklyReportDraft> {
      const draft = await this.generateReportForRange(report);

      return toWeeklyDraft(draft);
    },

    async generateReportForRange(report: Report): Promise<ReportDraft> {
      const reportType = getSupportedGenerationType(report.type);
      const context = await getReportContext(
        sourceRepositories,
        reportRepository,
        reportType,
        report.startDate,
        report.endDate,
      );

      return generateReportDraft(aiService, {
        ...context,
        existingReport: context.existingReport ?? report,
      });
    },

    async saveWeeklyReport(draft: WeeklyReportDraft): Promise<Report> {
      return this.saveReport({
        ...draft,
        reportType: 'weekly',
      });
    },

    async saveReport(draft: ReportDraft): Promise<Report> {
      const timestamp = now().toISOString();
      const overwriteReport = draft.overwriteReportId
        ? await reportRepository.getReportById(draft.overwriteReportId)
        : null;
      const existingReport =
        draft.saveMode === 'create'
          ? null
          : overwriteReport ??
            draft.existingReport ??
            (await reportRepository.getReportByTypeAndRange(
              draft.reportType,
              draft.startDate,
              draft.endDate,
            ));
      const report: Report = {
        id:
          existingReport?.id ??
          getReportId(
            draft.reportType,
            draft.startDate,
            draft.endDate,
            draft.saveMode === 'create' ? timestamp : undefined,
          ),
        type: draft.reportType,
        title: draft.generated.title,
        startDate: draft.startDate,
        endDate: draft.endDate,
        content: draft.generated,
        status: 'generated',
        createdAt: existingReport?.createdAt ?? timestamp,
        updatedAt: timestamp,
        generatedAt: timestamp,
      };

      // Reports are regenerable from entries on demand, so we no longer track
      // per-source staleness.
      await reportRepository.saveReport(report);

      return report;
    },

    // Pre-generation follow-ups, from two independent fail-open sources: the AI's
    // "important but thin" picks within the range, and stalled threads ("还在进行吗？")
    // derived purely from timestamps. Either source failing never blocks the other
    // or the report; the no-AI case still surfaces stalled-thread questions.
    async getReportGaps(startDate: string, endDate: string): Promise<ReportGap[]> {
      const [aiGaps, stalledGaps] = await Promise.all([
        getAiReportGaps(sourceRepositories, aiService, startDate, endDate),
        getStalledThreadGaps(threadSummaryProvider, getDailyMemoryDate(now())),
      ]);

      return mergeReportGaps(aiGaps, stalledGaps);
    },

    async saveGapAnswers(answers: GapAnswer[]): Promise<void> {
      for (const { entryId, question, answer } of answers) {
        const trimmed = answer.trim();

        if (!trimmed) {
          continue;
        }

        await clarificationRepository.create({ entryId, question, answer: trimmed });
      }
    },
  };
}

export const reportService = createReportService();

type SourceRepositories = {
  entryRepository: ReportEntryRepository;
  clarificationRepository: ReportClarificationRepository;
  threadRepository: ReportThreadRepository;
};

// Builds the report's source material from the entry model: entries in range
// (oldest first), each carrying its clarification answers and thread title so
// the AI can aggregate cross-day storylines.
async function buildReportEntries(
  repositories: SourceRepositories,
  startDate: string,
  endDate: string,
): Promise<ReportSourceEntry[]> {
  const entries = await repositories.entryRepository.listRange(startDate, endDate);

  if (entries.length === 0) {
    return [];
  }

  const [clarifications, threads] = await Promise.all([
    repositories.clarificationRepository.listByEntryIds(entries.map((entry) => entry.id)),
    repositories.threadRepository.list(),
  ]);

  const answersByEntry = new Map<string, string[]>();
  for (const clarification of clarifications) {
    const list = answersByEntry.get(clarification.entryId) ?? [];
    list.push(clarification.answer);
    answersByEntry.set(clarification.entryId, list);
  }

  const titleByThread = new Map(threads.map((thread) => [thread.id, thread.title]));

  return [...entries]
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt))
    .map((entry) => ({
      occurredOn: entry.occurredOn,
      content: entry.content,
      clarifications: answersByEntry.get(entry.id) ?? [],
      threadTitle: entry.threadId ? titleByThread.get(entry.threadId) ?? null : null,
    }));
}

// Like buildReportEntries but keeps entry ids and clarification counts so the
// AI can flag a thin thread and we can attach the answer back to a real entry.
async function buildGapEntries(
  repositories: SourceRepositories,
  startDate: string,
  endDate: string,
): Promise<ReportGapEntry[]> {
  const entries = await repositories.entryRepository.listRange(startDate, endDate);

  if (entries.length === 0) {
    return [];
  }

  const [clarifications, threads] = await Promise.all([
    repositories.clarificationRepository.listByEntryIds(entries.map((entry) => entry.id)),
    repositories.threadRepository.list(),
  ]);

  const countByEntry = new Map<string, number>();
  for (const clarification of clarifications) {
    countByEntry.set(clarification.entryId, (countByEntry.get(clarification.entryId) ?? 0) + 1);
  }

  const titleByThread = new Map(threads.map((thread) => [thread.id, thread.title]));

  return [...entries]
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt))
    .map((entry) => ({
      id: entry.id,
      occurredOn: entry.occurredOn,
      content: entry.content,
      clarificationCount: countByEntry.get(entry.id) ?? 0,
      threadId: entry.threadId,
      threadTitle: entry.threadId ? titleByThread.get(entry.threadId) ?? null : null,
    }));
}

// At most this many follow-up questions are shown before generating, across both
// sources, so the pre-generation step stays a quick "补一两句", not a survey.
const MAX_REPORT_GAPS = 3;

// Fail-open: any failure (no AI, network/parse error) yields no gaps so report
// generation is never blocked or shown an error by AI gap detection.
async function getAiReportGaps(
  repositories: SourceRepositories,
  aiService: ReportAIService,
  startDate: string,
  endDate: string,
): Promise<ReportGap[]> {
  let gapEntries: ReportGapEntry[] = [];

  try {
    gapEntries = await buildGapEntries(repositories, startDate, endDate);

    if (gapEntries.length === 0) {
      logger.debug('ai', 'report-gaps.completed', 'Report gap detection completed', {
        startDate,
        endDate,
        entryCount: 0,
        entriesWithThreadCount: 0,
        entriesWithClarificationCount: 0,
        gapCount: 0,
        skippedReason: 'no_entries',
      });
      return [];
    }

    const gaps = await aiService.suggestReportGaps({ entries: gapEntries });

    logger.debug('ai', 'report-gaps.completed', 'Report gap detection completed', {
      startDate,
      endDate,
      entryCount: gapEntries.length,
      entriesWithThreadCount: gapEntries.filter((entry) => Boolean(entry.threadTitle)).length,
      entriesWithClarificationCount: gapEntries.filter((entry) => entry.clarificationCount > 0)
        .length,
      gapCount: gaps.length,
    });

    return gaps;
  } catch (error) {
    logger.warn('ai', 'report-gaps.failed', 'Report gap detection failed', {
      startDate,
      endDate,
      entryCount: gapEntries.length,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// Fail-open companion that needs no AI: stalled threads are flagged from their
// recorded day span alone, so they still surface when AI is unconfigured.
async function getStalledThreadGaps(
  threadSummaryProvider: ReportThreadSummaryProvider,
  referenceDate: string,
): Promise<ReportGap[]> {
  try {
    const summaries = await threadSummaryProvider.listThreadSummaries();
    const gaps = selectStalledThreadGaps(summaries, referenceDate);

    logger.debug('report', 'report-gaps.stalled_completed', 'Stalled thread detection completed', {
      referenceDate,
      threadCount: summaries.length,
      gapCount: gaps.length,
    });

    return gaps;
  } catch (error) {
    logger.warn('report', 'report-gaps.stalled_failed', 'Stalled thread detection failed', {
      referenceDate,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// AI gaps come first (period-specific picks), then stalled threads fill any
// remaining slots. Duplicates are dropped by entry id and by thread title so a
// thread flagged by both sources is asked about once. Capped at MAX_REPORT_GAPS.
function mergeReportGaps(aiGaps: ReportGap[], stalledGaps: ReportGap[]): ReportGap[] {
  const merged: ReportGap[] = [];
  const seenEntryIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (const gap of [...aiGaps, ...stalledGaps]) {
    if (merged.length >= MAX_REPORT_GAPS) {
      break;
    }

    if (seenEntryIds.has(gap.entryId) || (gap.threadTitle && seenTitles.has(gap.threadTitle))) {
      continue;
    }

    merged.push(gap);
    seenEntryIds.add(gap.entryId);

    if (gap.threadTitle) {
      seenTitles.add(gap.threadTitle);
    }
  }

  return merged;
}

async function getReportContext(
  repositories: SourceRepositories,
  reportRepository: ReportRepository,
  reportType: ReportGenerationType,
  startDate: string,
  endDate: string,
): Promise<ReportContext> {
  const [entries, savedReports] = await Promise.all([
    buildReportEntries(repositories, startDate, endDate),
    reportRepository.getReportsByType(reportType),
  ]);
  const rangeConflict = getReportRangeConflict(savedReports, startDate, endDate);

  return {
    reportType,
    startDate,
    endDate,
    entries,
    existingReport: rangeConflict.exactReport,
    overlappingReports: rangeConflict.overlappingReports,
  };
}

async function generateReportDraft(
  aiService: ReportAIService,
  context: ReportContext,
): Promise<ReportDraft> {
  if (context.entries.length === 0) {
    throw new Error('这个时间范围里还没有可整理的记录。');
  }

  const generated = await aiService.generateRangeReport({
    reportType: context.reportType,
    startDate: context.startDate,
    endDate: context.endDate,
    entries: context.entries,
  });

  return {
    ...context,
    generated,
  };
}

function toWeeklyContext(context: ReportContext): WeeklyReportContext {
  return {
    startDate: context.startDate,
    endDate: context.endDate,
    entries: context.entries,
    existingReport: context.existingReport,
    overlappingReports: context.overlappingReports,
  };
}

function toWeeklyDraft(draft: ReportDraft): WeeklyReportDraft {
  return {
    ...toWeeklyContext(draft),
    reportType: 'weekly',
    generated: draft.generated,
  };
}

function getSupportedGenerationType(type: Report['type']): ReportGenerationType {
  if (type === 'custom') {
    return 'custom';
  }

  return 'weekly';
}

function getReportRangeConflict(reports: Report[], startDate: string, endDate: string) {
  const exactReport =
    reports.find((report) => report.startDate === startDate && report.endDate === endDate) ?? null;
  const overlappingReports = reports.filter(
    (report) =>
      (report.startDate !== startDate || report.endDate !== endDate) &&
      report.startDate <= endDate &&
      report.endDate >= startDate,
  );

  return { exactReport, overlappingReports };
}

function getReportId(
  reportType: ReportGenerationType,
  startDate: string,
  endDate: string,
  uniqueSeed?: string,
) {
  const baseId = `${reportType}-report-${startDate}-${endDate}`;

  if (!uniqueSeed) {
    return baseId;
  }

  return `${baseId}-${uniqueSeed.replace(/\D/g, '')}`;
}
