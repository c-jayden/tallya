import type {
  DailyMemory,
  GeneratedReportContent,
  RangeReportSourceInput,
  Report,
  ReportGenerationType,
} from '../types';
import { aiService as defaultAIService } from './ai/ai-service';
import { dailyMemoryRepository as defaultDailyMemoryRepository } from './daily-memory-repository';
import { reportRepository as defaultReportRepository } from './report-repository';
import { getCurrentWeekRange } from './report-date';

export type ReportDailyMemoryRepository = {
  getGeneratedMemories(): Promise<DailyMemory[]>;
};

export type ReportRepository = {
  getAllReports(): Promise<Report[]>;
  getReportsByType(type: Report['type']): Promise<Report[]>;
  getReportByTypeAndRange(type: ReportGenerationType, startDate: string, endDate: string): Promise<Report | null>;
  getWeeklyReportByRange(startDate: string, endDate: string): Promise<Report | null>;
  saveReport(report: Report): Promise<void>;
  updateReport(report: Report): Promise<void>;
  deleteReportSources(reportId: string): Promise<void>;
  saveReportSources(reportId: string, dailyMemories: DailyMemory[]): Promise<void>;
  getReportById(id: string): Promise<Report | null>;
};

export type ReportAIService = {
  generateRangeReport(input: RangeReportSourceInput): Promise<GeneratedReportContent>;
};

export type ReportServiceOptions = {
  now?: () => Date;
  dailyMemoryRepository?: ReportDailyMemoryRepository;
  reportRepository?: ReportRepository;
  aiService?: ReportAIService;
};

export type ReportContext = {
  reportType: ReportGenerationType;
  startDate: string;
  endDate: string;
  memories: DailyMemory[];
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
  dailyMemoryRepository = defaultDailyMemoryRepository,
  reportRepository = defaultReportRepository,
  aiService = defaultAIService,
}: ReportServiceOptions = {}) {
  return {
    async getAllReports() {
      return reportRepository.getAllReports();
    },

    async getCurrentWeeklyReportContext(): Promise<WeeklyReportContext> {
      const { startDate, endDate } = getCurrentWeekRange(now());
      const context = await getReportContext(
        dailyMemoryRepository,
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
      return getReportContext(dailyMemoryRepository, reportRepository, reportType, startDate, endDate);
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
        dailyMemoryRepository,
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

      if (existingReport) {
        await reportRepository.deleteReportSources(existingReport.id);
      }

      await reportRepository.saveReport(report);
      await reportRepository.saveReportSources(report.id, draft.memories);

      return report;
    },
  };
}

export const reportService = createReportService();

async function getFormalMemoriesInRange(
  repository: ReportDailyMemoryRepository,
  startDate: string,
  endDate: string,
) {
  const memories = await repository.getGeneratedMemories();

  return memories
    .filter(
      (memory) =>
        (memory.status === 'generated' || memory.status === 'locked') &&
        memory.generated !== null &&
        memory.date >= startDate &&
        memory.date <= endDate,
    )
    .sort((first, second) => first.date.localeCompare(second.date));
}

async function getReportContext(
  dailyMemoryRepository: ReportDailyMemoryRepository,
  reportRepository: ReportRepository,
  reportType: ReportGenerationType,
  startDate: string,
  endDate: string,
): Promise<ReportContext> {
  const [memories, existingReport] = await Promise.all([
    getFormalMemoriesInRange(dailyMemoryRepository, startDate, endDate),
    reportRepository.getReportByTypeAndRange(reportType, startDate, endDate),
  ]);

  return {
    reportType,
    startDate,
    endDate,
    memories,
    existingReport,
  };
}

async function generateReportDraft(
  aiService: ReportAIService,
  context: ReportContext,
): Promise<ReportDraft> {
  if (context.memories.length === 0) {
    throw new Error('这个时间范围内还没有可用于生成报告的工作记忆。');
  }

  const generated = await aiService.generateRangeReport({
    reportType: context.reportType,
    startDate: context.startDate,
    endDate: context.endDate,
    memories: context.memories,
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
    memories: context.memories,
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
