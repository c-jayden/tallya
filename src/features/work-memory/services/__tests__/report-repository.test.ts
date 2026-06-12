import { describe, expect, it } from 'vitest';
import type { GeneratedReportContent, Report } from '../../types';
import { TestDatabaseClient } from '../database/test-database';
import { SQLiteReportRepository } from '../report-repository';

const generatedContent: GeneratedReportContent = {
  title: '本周周报',
  summary: '完成 SQLite 存储迁移，并补充通知与托盘能力。',
  highlights: ['完成 SQLite 存储迁移', '通知提醒正常触发'],
  completedItems: ['迁移本地存储', '补充系统通知验证'],
  problems: '',
  nextWeekPlan: '继续整理报告能力。',
  markdown: '# 本周周报\n\n完成 SQLite 存储迁移。',
};

describe('SQLiteReportRepository', () => {
  it('saves and reads a weekly report by range', async () => {
    const repository = createRepository();
    const report = createReport({ id: 'weekly-2026-06-01' });

    await repository.saveReport(report);

    await expect(repository.getWeeklyReportByRange('2026-06-01', '2026-06-07')).resolves.toEqual(
      report,
    );
    await expect(repository.getReportById(report.id)).resolves.toEqual(report);
  });

  it('replaces report content when saving the same report id', async () => {
    const repository = createRepository();

    await repository.saveReport(createReport({ title: '旧周报' }));
    await repository.saveReport(createReport({ title: '本周周报' }));

    await expect(repository.getWeeklyReportByRange('2026-06-01', '2026-06-07')).resolves.toEqual(
      expect.objectContaining({
        id: 'weekly-2026-06-01',
        title: '本周周报',
      }),
    );
  });

  it('lists all reports by generated time descending', async () => {
    const repository = createRepository();

    await repository.saveReport(
      createReport({
        id: 'weekly-2026-05-25',
        startDate: '2026-05-25',
        endDate: '2026-05-31',
        generatedAt: '2026-06-01T01:00:00.000Z',
        createdAt: '2026-06-01T01:00:00.000Z',
        updatedAt: '2026-06-01T01:00:00.000Z',
      }),
    );
    await repository.saveReport(
      createReport({
        id: 'weekly-2026-06-01',
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        generatedAt: '2026-06-08T01:00:00.000Z',
        createdAt: '2026-06-08T01:00:00.000Z',
        updatedAt: '2026-06-08T01:00:00.000Z',
      }),
    );

    await expect(repository.getAllReports()).resolves.toEqual([
      expect.objectContaining({ id: 'weekly-2026-06-01' }),
      expect.objectContaining({ id: 'weekly-2026-05-25' }),
    ]);
  });

  it('lists reports by type', async () => {
    const repository = createRepository();

    await repository.saveReport(createReport({ id: 'weekly-2026-06-01', type: 'weekly' }));
    await repository.saveReport(
      createReport({
        id: 'monthly-2026-06',
        type: 'monthly',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    );

    await expect(repository.getReportsByType('weekly')).resolves.toEqual([
      expect.objectContaining({ id: 'weekly-2026-06-01', type: 'weekly' }),
    ]);
  });

  it('reads a custom report by type and range', async () => {
    const repository = createRepository();
    const report = createReport({
      id: 'custom-2026-06-01-2026-06-03',
      type: 'custom',
      title: '阶段工作总结',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    });

    await repository.saveReport(report);

    await expect(
      repository.getReportByTypeAndRange('custom', '2026-06-01', '2026-06-03'),
    ).resolves.toEqual(report);
  });

  it('uses an empty object when report content JSON cannot be parsed', async () => {
    const database = new TestDatabaseClient();
    const repository = createRepository(database);

    database.reports.set('bad-report', {
      id: 'bad-report',
      type: 'weekly',
      title: '损坏的周报',
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      content_json: '{bad json',
      status: 'generated',
      created_at: '2026-06-08T01:00:00.000Z',
      updated_at: '2026-06-08T01:00:00.000Z',
      generated_at: '2026-06-08T01:00:00.000Z',
    });

    await expect(repository.getReportById('bad-report')).resolves.toEqual(
      expect.objectContaining({
        id: 'bad-report',
        content: {},
      }),
    );
  });

  it('replaces all reports during backup restore', async () => {
    const repository = createRepository();
    const oldReport = createReport({ id: 'weekly-2026-05-25' });
    const nextReport = createReport({ id: 'weekly-2026-06-01' });

    await repository.saveReport(oldReport);
    await repository.replaceAll([nextReport]);

    await expect(repository.getAllReports()).resolves.toEqual([
      expect.objectContaining({ id: nextReport.id }),
    ]);
    await expect(repository.getReportById(oldReport.id)).resolves.toBeNull();
  });
});

function createRepository(database = new TestDatabaseClient()) {
  return new SQLiteReportRepository(Promise.resolve(database));
}

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'weekly-2026-06-01',
    type: 'weekly',
    title: '本周周报',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    content: generatedContent,
    status: 'generated',
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T01:00:00.000Z',
    generatedAt: '2026-06-08T01:00:00.000Z',
    ...overrides,
  };
}
