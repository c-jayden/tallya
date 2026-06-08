import { describe, expect, it, vi } from 'vitest';
import type {
  DailyMemory,
  GeneratedReportContent,
  RangeReportSourceInput,
  Report,
} from '../types';
import {
  createReportService,
  type ReportAIService,
  type ReportRepository,
} from './report-service';

const generatedReport: GeneratedReportContent = {
  title: '本周周报',
  summary: '本周完成存储迁移和通知验证。',
  highlights: ['完成 SQLite 迁移', '验证通知提醒'],
  completedItems: ['迁移本地存储', '补充提醒调度'],
  problems: '',
  nextWeekPlan: '继续整理报告能力。',
  markdown: '# 本周周报\n\n本周完成存储迁移和通知验证。',
};

describe('createReportService', () => {
  it('loads current weekly context with generated and locked memories only', async () => {
    const service = createService({
      memories: [
        createMemory('2026-06-01', 'generated'),
        createMemory('2026-06-02', 'draft'),
        createMemory('2026-06-03', 'locked'),
        createMemory('2026-05-29', 'generated'),
      ],
    });

    await expect(service.getCurrentWeeklyReportContext()).resolves.toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [
        expect.objectContaining({ date: '2026-06-01', status: 'generated' }),
        expect.objectContaining({ date: '2026-06-03', status: 'locked' }),
      ],
      existingReport: null,
    });
  });

  it('does not generate a weekly report without formal memories', async () => {
    const generateRangeReport = vi.fn();
    const service = createService({
      memories: [createMemory('2026-06-02', 'draft')],
      generateRangeReport,
    });

    await expect(service.generateCurrentWeeklyReport()).rejects.toThrow(
      '这个时间范围内还没有可用于生成报告的工作记忆。',
    );
    expect(generateRangeReport).not.toHaveBeenCalled();
  });

  it('generates a preview from the current weekly memories without saving it', async () => {
    const generateRangeReport = vi.fn().mockResolvedValue(generatedReport);
    const saveReport = vi.fn();
    const saveReportSources = vi.fn();
    const service = createService({
      memories: [createMemory('2026-06-01', 'generated')],
      generateRangeReport,
      reportRepository: {
        getAllReports: vi.fn(),
        getReportsByType: vi.fn(),
        getReportByTypeAndRange: vi.fn().mockResolvedValue(null),
        getWeeklyReportByRange: vi.fn().mockResolvedValue(null),
        saveReport,
        updateReport: vi.fn(),
        deleteReportSources: vi.fn(),
        saveReportSources,
        getReportById: vi.fn(),
      },
    });

    await expect(service.generateCurrentWeeklyReport()).resolves.toEqual({
      reportType: 'weekly',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [expect.objectContaining({ date: '2026-06-01' })],
      generated: generatedReport,
      existingReport: null,
    });
    expect(generateRangeReport).toHaveBeenCalledWith({
      reportType: 'weekly',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [expect.objectContaining({ date: '2026-06-01' })],
    } satisfies RangeReportSourceInput);
    expect(saveReport).not.toHaveBeenCalled();
    expect(saveReportSources).not.toHaveBeenCalled();
  });

  it('loads custom report context with formal memories only', async () => {
    const existingReport = createReport({
      id: 'custom-report-2026-06-01-2026-06-03',
      type: 'custom',
      title: '阶段工作总结',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    });
    const service = createService({
      memories: [
        createMemory('2026-06-01', 'generated'),
        createMemory('2026-06-02', 'draft'),
        createMemory('2026-06-03', 'locked'),
        createMemory('2026-06-04', 'generated'),
      ],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
      }),
    });

    await expect(service.getReportContext('custom', '2026-06-01', '2026-06-03')).resolves.toEqual({
      reportType: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      memories: [
        expect.objectContaining({ date: '2026-06-01', status: 'generated' }),
        expect.objectContaining({ date: '2026-06-03', status: 'locked' }),
      ],
      existingReport,
    });
  });

  it('saves a custom range report and report sources', async () => {
    const saveReport = vi.fn();
    const saveReportSources = vi.fn();
    const memory = createMemory('2026-06-01', 'generated');
    const service = createService({
      memories: [memory],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(null),
        saveReport,
        saveReportSources,
      }),
    });

    const report = await service.saveReport({
      reportType: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      memories: [memory],
      generated: {
        ...generatedReport,
        title: '2026年6月1日-6月3日工作总结',
      },
      existingReport: null,
    });

    expect(report).toEqual(
      expect.objectContaining({
        type: 'custom',
        title: '2026年6月1日-6月3日工作总结',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        status: 'generated',
      }),
    );
    expect(saveReport).toHaveBeenCalledWith(report);
    expect(saveReportSources).toHaveBeenCalledWith(report.id, [memory]);
  });

  it('overwrites the existing custom report for the same range', async () => {
    const existingReport = createReport({
      id: 'existing-custom-report',
      type: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    });
    const saveReport = vi.fn();
    const deleteReportSources = vi.fn();
    const memory = createMemory('2026-06-01', 'generated');
    const service = createService({
      memories: [memory],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        saveReport,
        deleteReportSources,
        saveReportSources: vi.fn(),
      }),
    });

    const report = await service.saveReport({
      reportType: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      memories: [memory],
      generated: generatedReport,
      existingReport,
    });

    expect(report.id).toBe(existingReport.id);
    expect(report.type).toBe('custom');
    expect(deleteReportSources).toHaveBeenCalledWith(existingReport.id);
    expect(saveReport).toHaveBeenCalledWith(report);
  });

  it('saves a weekly report and report sources', async () => {
    const saveReport = vi.fn();
    const saveReportSources = vi.fn();
    const memory = createMemory('2026-06-01', 'generated');
    const service = createService({
      memories: [memory],
      reportRepository: {
        getAllReports: vi.fn(),
        getReportsByType: vi.fn(),
        getReportByTypeAndRange: vi.fn().mockResolvedValue(null),
        getWeeklyReportByRange: vi.fn().mockResolvedValue(null),
        saveReport,
        updateReport: vi.fn(),
        deleteReportSources: vi.fn(),
        saveReportSources,
        getReportById: vi.fn(),
      },
    });

    const report = await service.saveWeeklyReport({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [memory],
      generated: generatedReport,
      existingReport: null,
    });

    expect(report).toEqual(
      expect.objectContaining({
        type: 'weekly',
        title: '本周周报',
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        content: generatedReport,
        status: 'generated',
      }),
    );
    expect(saveReport).toHaveBeenCalledWith(report);
    expect(saveReportSources).toHaveBeenCalledWith(report.id, [memory]);
  });

  it('reuses the existing weekly report id when overwriting the same week', async () => {
    const existingReport: Report = {
      id: 'existing-weekly-report',
      type: 'weekly',
      title: '旧周报',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      content: {},
      status: 'generated',
      createdAt: '2026-06-07T01:00:00.000Z',
      updatedAt: '2026-06-07T01:00:00.000Z',
      generatedAt: '2026-06-07T01:00:00.000Z',
    };
    const saveReport = vi.fn();
    const deleteReportSources = vi.fn();
    const memory = createMemory('2026-06-01', 'generated');
    const service = createService({
      memories: [memory],
      existingReport,
      reportRepository: {
        getAllReports: vi.fn(),
        getReportsByType: vi.fn(),
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        getWeeklyReportByRange: vi.fn().mockResolvedValue(existingReport),
        saveReport,
        updateReport: vi.fn(),
        deleteReportSources,
        saveReportSources: vi.fn(),
        getReportById: vi.fn(),
      },
    });

    const report = await service.saveWeeklyReport({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [memory],
      generated: generatedReport,
      existingReport,
    });

    expect(report.id).toBe(existingReport.id);
    expect(report.createdAt).toBe(existingReport.createdAt);
    expect(deleteReportSources).toHaveBeenCalledWith(existingReport.id);
    expect(saveReport).toHaveBeenCalledWith(report);
  });

  it('restores a stale report to generated and rewrites sources when saving regeneration', async () => {
    const existingReport = createReport({
      id: 'stale-weekly-report',
      status: 'stale',
      createdAt: '2026-06-07T01:00:00.000Z',
      updatedAt: '2026-06-08T01:00:00.000Z',
      generatedAt: '2026-06-07T01:00:00.000Z',
    });
    const memory = createMemory('2026-06-01', 'generated');
    const saveReport = vi.fn();
    const saveReportSources = vi.fn();
    const deleteReportSources = vi.fn();
    const service = createService({
      memories: [memory],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        saveReport,
        saveReportSources,
        deleteReportSources,
      }),
    });

    const report = await service.saveWeeklyReport({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      memories: [memory],
      generated: generatedReport,
      existingReport,
    });

    expect(report).toEqual(
      expect.objectContaining({
        id: existingReport.id,
        status: 'generated',
        createdAt: existingReport.createdAt,
        updatedAt: '2026-06-03T10:00:00.000Z',
        generatedAt: '2026-06-03T10:00:00.000Z',
      }),
    );
    expect(deleteReportSources).toHaveBeenCalledWith(existingReport.id);
    expect(saveReportSources).toHaveBeenCalledWith(existingReport.id, [
      expect.objectContaining({ id: memory.id, updatedAt: memory.updatedAt }),
    ]);
  });

  it('returns a friendly error when AI weekly output cannot be parsed', async () => {
    const service = createService({
      memories: [createMemory('2026-06-01', 'generated')],
      generateRangeReport: vi.fn().mockRejectedValue(new Error('AI 返回内容不是合法 JSON，请重试。')),
    });

    await expect(service.generateCurrentWeeklyReport()).rejects.toThrow(
      'AI 返回内容不是合法 JSON，请重试。',
    );
  });

  it('regenerates a weekly report preview for an existing report range', async () => {
    const existingReport: Report = {
      id: 'existing-weekly-report',
      type: 'weekly',
      title: '旧周报',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      content: {},
      status: 'generated',
      createdAt: '2026-06-01T01:00:00.000Z',
      updatedAt: '2026-06-01T01:00:00.000Z',
      generatedAt: '2026-06-01T01:00:00.000Z',
    };
    const generateRangeReport = vi
      .fn<ReportAIService['generateRangeReport']>()
      .mockResolvedValue(generatedReport);
    const service = createService({
      memories: [
        createMemory('2026-05-26', 'generated'),
        createMemory('2026-06-01', 'generated'),
      ],
      generateRangeReport,
      reportRepository: {
        getAllReports: vi.fn(),
        getReportsByType: vi.fn(),
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        getWeeklyReportByRange: vi.fn().mockResolvedValue(existingReport),
        saveReport: vi.fn(),
        updateReport: vi.fn(),
        deleteReportSources: vi.fn(),
        saveReportSources: vi.fn(),
        getReportById: vi.fn(),
      },
    });

    await expect(service.generateWeeklyReportForRange(existingReport)).resolves.toEqual({
      reportType: 'weekly',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      memories: [expect.objectContaining({ date: '2026-05-26' })],
      generated: generatedReport,
      existingReport,
    });
    expect(generateRangeReport).toHaveBeenCalledWith({
      reportType: 'weekly',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      memories: [expect.objectContaining({ date: '2026-05-26' })],
    });
  });
});

function createService({
  memories = [],
  existingReport = null,
  generateRangeReport = vi
    .fn<ReportAIService['generateRangeReport']>()
    .mockResolvedValue(generatedReport),
  reportRepository,
}: {
  memories?: DailyMemory[];
  existingReport?: Report | null;
  generateRangeReport?: ReportAIService['generateRangeReport'];
  reportRepository?: ReportRepository;
} = {}) {
  return createReportService({
    now: () => new Date('2026-06-03T10:00:00.000Z'),
    dailyMemoryRepository: {
      getGeneratedMemories: vi.fn().mockResolvedValue(memories),
    },
    aiService: {
      generateRangeReport,
    },
    reportRepository:
      reportRepository ??
      ({
        ...createReportRepository({
          getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        }),
      } satisfies ReportRepository),
  });
}

function createReportRepository(overrides: Partial<ReportRepository> = {}): ReportRepository {
  return {
    getAllReports: vi.fn(),
    getReportsByType: vi.fn(),
    getReportByTypeAndRange: vi.fn().mockResolvedValue(null),
    getWeeklyReportByRange: vi.fn().mockResolvedValue(null),
    saveReport: vi.fn(),
    updateReport: vi.fn(),
    deleteReportSources: vi.fn(),
    saveReportSources: vi.fn(),
    getReportById: vi.fn(),
    ...overrides,
  };
}

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'weekly-report-2026-06-01-2026-06-07',
    type: 'weekly',
    title: '本周周报',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    content: generatedReport,
    status: 'generated',
    createdAt: '2026-06-07T01:00:00.000Z',
    updatedAt: '2026-06-07T01:00:00.000Z',
    generatedAt: '2026-06-07T01:00:00.000Z',
    ...overrides,
  };
}

function createMemory(date: string, status: DailyMemory['status']): DailyMemory {
  return {
    id: `daily-memory-${date}`,
    date,
    rawContent: `${date} work note`,
    supplements: {
      tomorrowPlan: status === 'draft' ? 'Draft plan' : 'Continue follow up',
    },
    generated:
      status === 'draft'
        ? null
        : {
            summary: `${date} summary`,
            completedItems: [`${date} completed item`],
            tomorrowPlan: 'Continue follow up',
          },
    status,
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T02:00:00.000Z`,
  };
}
