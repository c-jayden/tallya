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
} from '../types';
import { aiService as defaultAIService } from './ai/ai-service';
import { clarificationRepository as defaultClarificationRepository } from './clarification-repository';
import { entryRepository as defaultEntryRepository } from './entry-repository';
import { reportRepository as defaultReportRepository } from './report-repository';
import { threadRepository as defaultThreadRepository } from './thread-repository';
import { getCurrentWeekRange } from './report-date';

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
  reportRepository?: ReportRepository;
  aiService?: ReportAIService;
};

export type ReportContext = {
  reportType: ReportGenerationType;
  startDate: string;
  endDate: string;
  entries: ReportSourceEntry[];
  existingReport: Report | null;
};

export type ReportDraft = ReportContext & {
  generated: GeneratedReportContent;
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
      const existingReport =
        draft.existingReport ??
        (await reportRepository.getReportByTypeAndRange(
          draft.reportType,
          draft.startDate,
          draft.endDate,
        ));
      const timestamp = now().toISOString();
      const report: Report = {
        id: existingReport?.id ?? getReportId(draft.reportType, draft.startDate, draft.endDate),
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
      // per-source staleness (the old daily_memories report_sources mechanism).
      await reportRepository.saveReport(report);

      return report;
    },

    // Fail-open: any failure (no AI, network/parse error) yields no gaps so
    // report generation is never blocked or shown an error by gap detection.
    async getReportGaps(startDate: string, endDate: string): Promise<ReportGap[]> {
      try {
        const gapEntries = await buildGapEntries(sourceRepositories, startDate, endDate);

        if (gapEntries.length === 0) {
          return [];
        }

        return await aiService.suggestReportGaps({ entries: gapEntries });
      } catch {
        return [];
      }
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

async function getReportContext(
  repositories: SourceRepositories,
  reportRepository: ReportRepository,
  reportType: ReportGenerationType,
  startDate: string,
  endDate: string,
): Promise<ReportContext> {
  const [entries, existingReport] = await Promise.all([
    buildReportEntries(repositories, startDate, endDate),
    reportRepository.getReportByTypeAndRange(reportType, startDate, endDate),
  ]);

  return {
    reportType,
    startDate,
    endDate,
    entries,
    existingReport,
  };
}

async function generateReportDraft(
  aiService: ReportAIService,
  context: ReportContext,
): Promise<ReportDraft> {
  if (context.entries.length === 0) {
    throw new Error('这个时间范围内还没有可用于生成报告的记录。');
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

function getReportId(reportType: ReportGenerationType, startDate: string, endDate: string) {
  return `${reportType}-report-${startDate}-${endDate}`;
}
