import type { DailyMemory, GeneratedReportContent, Report } from '../types';
import { aiService as defaultAIService } from './ai/ai-service';
import { dailyMemoryRepository as defaultDailyMemoryRepository } from './daily-memory-repository';
import { reportRepository as defaultReportRepository } from './report-repository';
import { getCurrentWeekRange } from './report-date';

export type ReportDailyMemoryRepository = {
  getGeneratedMemories(): Promise<DailyMemory[]>;
};

export type ReportRepository = {
  getWeeklyReportByRange(startDate: string, endDate: string): Promise<Report | null>;
  saveReport(report: Report): Promise<void>;
  deleteReportSources(reportId: string): Promise<void>;
  saveReportSources(reportId: string, dailyMemories: DailyMemory[]): Promise<void>;
  getReportById(id: string): Promise<Report | null>;
};

export type ReportAIService = {
  generateWeeklyReport(input: {
    startDate: string;
    endDate: string;
    memories: DailyMemory[];
  }): Promise<GeneratedReportContent>;
};

export type ReportServiceOptions = {
  now?: () => Date;
  dailyMemoryRepository?: ReportDailyMemoryRepository;
  reportRepository?: ReportRepository;
  aiService?: ReportAIService;
};

export type WeeklyReportContext = {
  startDate: string;
  endDate: string;
  memories: DailyMemory[];
  existingReport: Report | null;
};

export type WeeklyReportDraft = WeeklyReportContext & {
  generated: GeneratedReportContent;
};

export function createReportService({
  now = () => new Date(),
  dailyMemoryRepository = defaultDailyMemoryRepository,
  reportRepository = defaultReportRepository,
  aiService = defaultAIService,
}: ReportServiceOptions = {}) {
  return {
    async getCurrentWeeklyReportContext(): Promise<WeeklyReportContext> {
      const { startDate, endDate } = getCurrentWeekRange(now());
      const [memories, existingReport] = await Promise.all([
        getFormalMemoriesInRange(dailyMemoryRepository, startDate, endDate),
        reportRepository.getWeeklyReportByRange(startDate, endDate),
      ]);

      return {
        startDate,
        endDate,
        memories,
        existingReport,
      };
    },

    async generateCurrentWeeklyReport(): Promise<WeeklyReportDraft> {
      const context = await this.getCurrentWeeklyReportContext();

      if (context.memories.length === 0) {
        throw new Error('这个时间范围内还没有可用于生成报告的工作记忆。');
      }

      const generated = await aiService.generateWeeklyReport({
        startDate: context.startDate,
        endDate: context.endDate,
        memories: context.memories,
      });

      return {
        ...context,
        generated,
      };
    },

    async saveWeeklyReport(draft: WeeklyReportDraft): Promise<Report> {
      const existingReport =
        draft.existingReport ??
        (await reportRepository.getWeeklyReportByRange(draft.startDate, draft.endDate));
      const timestamp = now().toISOString();
      const report: Report = {
        id: existingReport?.id ?? getWeeklyReportId(draft.startDate, draft.endDate),
        type: 'weekly',
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

function getWeeklyReportId(startDate: string, endDate: string) {
  return `weekly-report-${startDate}-${endDate}`;
}
