import { describe, expect, it, vi } from 'vitest';
import type {
  Clarification,
  Entry,
  GeneratedReportContent,
  RangeReportSourceInput,
  Report,
  Thread,
} from '../../types';
import {
  createReportService,
  type ReportAIService,
  type ReportRepository,
} from '../report-service';

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
  it('builds the weekly context from entries, oldest first with clarifications and thread titles', async () => {
    const service = createService({
      // Returned newest-first like the real repository; the service re-sorts ascending.
      entries: [
        createEntry('e2', '2026-06-03', '继续联调订单接口', 'thread_1'),
        createEntry('e1', '2026-06-01', '对接订单接口', 'thread_1'),
      ],
      clarifications: [createClarification('c1', 'e1', '卡在鉴权头')],
      threads: [createThread('thread_1', '订单接口对接')],
    });

    await expect(service.getCurrentWeeklyReportContext()).resolves.toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      entries: [
        {
          occurredOn: '2026-06-01',
          content: '对接订单接口',
          clarifications: ['卡在鉴权头'],
          threadTitle: '订单接口对接',
        },
        {
          occurredOn: '2026-06-03',
          content: '继续联调订单接口',
          clarifications: [],
          threadTitle: '订单接口对接',
        },
      ],
      existingReport: null,
    });
  });

  it('does not generate a weekly report when the range has no entries', async () => {
    const generateRangeReport = vi.fn();
    const service = createService({ entries: [], generateRangeReport });

    await expect(service.generateCurrentWeeklyReport()).rejects.toThrow(
      '这个时间范围内还没有可用于生成报告的记录。',
    );
    expect(generateRangeReport).not.toHaveBeenCalled();
  });

  it('generates a weekly preview from entries without saving it', async () => {
    const generateRangeReport = vi
      .fn<ReportAIService['generateRangeReport']>()
      .mockResolvedValue(generatedReport);
    const saveReport = vi.fn();
    const service = createService({
      entries: [createEntry('e1', '2026-06-01', '对接订单接口')],
      generateRangeReport,
      reportRepository: createReportRepository({ saveReport }),
    });

    await expect(service.generateCurrentWeeklyReport()).resolves.toEqual({
      reportType: 'weekly',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      entries: [
        { occurredOn: '2026-06-01', content: '对接订单接口', clarifications: [], threadTitle: null },
      ],
      generated: generatedReport,
      existingReport: null,
    });
    expect(generateRangeReport).toHaveBeenCalledWith({
      reportType: 'weekly',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      entries: [
        { occurredOn: '2026-06-01', content: '对接订单接口', clarifications: [], threadTitle: null },
      ],
    } satisfies RangeReportSourceInput);
    expect(saveReport).not.toHaveBeenCalled();
  });

  it('saves a custom range report (no source tracking)', async () => {
    const saveReport = vi.fn();
    const service = createService({
      entries: [createEntry('e1', '2026-06-01', '对接订单接口')],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(null),
        saveReport,
      }),
    });

    const report = await service.saveReport({
      reportType: 'custom',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      entries: [],
      generated: { ...generatedReport, title: '2026年6月1日-6月3日工作总结' },
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
  });

  it('reuses the existing report id when overwriting the same range', async () => {
    const existingReport = createReport({
      id: 'existing-weekly-report',
      createdAt: '2026-06-07T01:00:00.000Z',
    });
    const saveReport = vi.fn();
    const service = createService({
      entries: [createEntry('e1', '2026-06-01', '对接订单接口')],
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
        saveReport,
      }),
    });

    const report = await service.saveWeeklyReport({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      entries: [],
      generated: generatedReport,
      existingReport,
    });

    expect(report.id).toBe(existingReport.id);
    expect(report.createdAt).toBe(existingReport.createdAt);
    expect(saveReport).toHaveBeenCalledWith(report);
  });

  it('regenerates a weekly preview for an existing report range', async () => {
    const existingReport = createReport({
      id: 'existing-weekly-report',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
    });
    const generateRangeReport = vi
      .fn<ReportAIService['generateRangeReport']>()
      .mockResolvedValue(generatedReport);
    const service = createService({
      entries: [createEntry('e1', '2026-05-26', '梳理报告流程')],
      generateRangeReport,
      reportRepository: createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
      }),
    });

    await expect(service.generateWeeklyReportForRange(existingReport)).resolves.toEqual({
      reportType: 'weekly',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      entries: [
        { occurredOn: '2026-05-26', content: '梳理报告流程', clarifications: [], threadTitle: null },
      ],
      generated: generatedReport,
      existingReport,
    });
    expect(generateRangeReport).toHaveBeenCalledWith({
      reportType: 'weekly',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      entries: [
        { occurredOn: '2026-05-26', content: '梳理报告流程', clarifications: [], threadTitle: null },
      ],
    });
  });

  it('surfaces a friendly error when AI output cannot be parsed', async () => {
    const service = createService({
      entries: [createEntry('e1', '2026-06-01', '对接订单接口')],
      generateRangeReport: vi.fn().mockRejectedValue(new Error('AI 返回内容不是合法 JSON，请重试。')),
    });

    await expect(service.generateCurrentWeeklyReport()).rejects.toThrow(
      'AI 返回内容不是合法 JSON，请重试。',
    );
  });
});

function createService({
  entries = [],
  clarifications = [],
  threads = [],
  existingReport = null,
  generateRangeReport = vi
    .fn<ReportAIService['generateRangeReport']>()
    .mockResolvedValue(generatedReport),
  reportRepository,
}: {
  entries?: Entry[];
  clarifications?: Clarification[];
  threads?: Thread[];
  existingReport?: Report | null;
  generateRangeReport?: ReportAIService['generateRangeReport'];
  reportRepository?: ReportRepository;
} = {}) {
  return createReportService({
    now: () => new Date('2026-06-03T10:00:00.000Z'),
    entryRepository: {
      listRange: vi.fn().mockResolvedValue(entries),
    },
    clarificationRepository: {
      listByEntryIds: vi.fn().mockResolvedValue(clarifications),
    },
    threadRepository: {
      list: vi.fn().mockResolvedValue(threads),
    },
    aiService: { generateRangeReport },
    reportRepository:
      reportRepository ??
      createReportRepository({
        getReportByTypeAndRange: vi.fn().mockResolvedValue(existingReport),
      }),
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

function createEntry(
  id: string,
  occurredOn: string,
  content: string,
  threadId: string | null = null,
): Entry {
  return {
    id,
    content,
    occurredAt: `${occurredOn}T03:00:00.000Z`,
    occurredOn,
    threadId,
    difficulty: null,
    effort: null,
    createdAt: `${occurredOn}T03:00:00.000Z`,
    updatedAt: `${occurredOn}T03:00:00.000Z`,
  };
}

function createClarification(id: string, entryId: string, answer: string): Clarification {
  return {
    id,
    entryId,
    question: null,
    answer,
    createdAt: '2026-06-01T04:00:00.000Z',
    updatedAt: '2026-06-01T04:00:00.000Z',
  };
}

function createThread(id: string, title: string): Thread {
  return {
    id,
    title,
    status: 'open',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
  };
}
