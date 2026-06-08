import type { DailyMemory, Report, ReportSource, ReportStatus, ReportType } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { createFriendlyError } from './service-error';

type ReportRow = {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string;
  content_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
};

type ReportSourceRow = {
  id: string;
  report_id: string;
  daily_memory_id: string;
  daily_memory_updated_at_snapshot: string;
};

export class SQLiteReportRepository {
  private databasePromise: Promise<DatabaseClient> | null;

  constructor(database?: Promise<DatabaseClient>) {
    this.databasePromise = database ?? null;
  }

  async getAllReports() {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        `
          SELECT * FROM reports
          ORDER BY COALESCE(generated_at, created_at) DESC, created_at DESC
        `,
      );

      return rows
        .map(normalizeReportRow)
        .filter((report): report is Report => report !== null);
    }, []);
  }

  async getReportsByType(type: ReportType) {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        `
          SELECT * FROM reports
          WHERE type = $1
          ORDER BY COALESCE(generated_at, created_at) DESC, created_at DESC
        `,
        [type],
      );

      return rows
        .map(normalizeReportRow)
        .filter((report): report is Report => report !== null);
    }, []);
  }

  async getWeeklyReportByRange(startDate: string, endDate: string) {
    return this.getReportByTypeAndRange('weekly', startDate, endDate);
  }

  async getReportByTypeAndRange(type: ReportType, startDate: string, endDate: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        `
          SELECT * FROM reports
          WHERE type = $1 AND start_date = $2 AND end_date = $3
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [type, startDate, endDate],
      );

      return normalizeReportRow(rows[0]) ?? null;
    }, null);
  }

  async getReportById(id: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        'SELECT * FROM reports WHERE id = $1 LIMIT 1',
        [id],
      );

      return normalizeReportRow(rows[0]) ?? null;
    }, null);
  }

  async getReportSources(reportId: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportSourceRow[]>(
        'SELECT * FROM report_sources WHERE report_id = $1 ORDER BY id ASC',
        [reportId],
      );

      return rows
        .map(normalizeReportSourceRow)
        .filter((source): source is ReportSource => source !== null);
    }, []);
  }

  async getAllReportSources() {
    return this.read(async (database) => {
      const rows = await database.select<ReportSourceRow[]>(
        'SELECT * FROM report_sources ORDER BY report_id ASC, id ASC',
      );

      return rows
        .map(normalizeReportSourceRow)
        .filter((source): source is ReportSource => source !== null);
    }, []);
  }

  async getReportSourcesByDailyMemoryId(dailyMemoryId: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportSourceRow[]>(
        'SELECT * FROM report_sources WHERE daily_memory_id = $1 ORDER BY id ASC',
        [dailyMemoryId],
      );

      return rows
        .map(normalizeReportSourceRow)
        .filter((source): source is ReportSource => source !== null);
    }, []);
  }

  async hasReportSourceForDailyMemory(dailyMemoryId: string) {
    return this.hasReportsUsingDailyMemory(dailyMemoryId);
  }

  async hasReportsUsingDailyMemory(dailyMemoryId: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportSourceRow[]>(
        'SELECT * FROM report_sources WHERE daily_memory_id = $1 LIMIT 1',
        [dailyMemoryId],
      );

      return rows.length > 0;
    }, false);
  }

  async getReportsUsingDailyMemory(dailyMemoryId: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        `
          SELECT reports.*
          FROM reports
          INNER JOIN report_sources ON report_sources.report_id = reports.id
          WHERE report_sources.daily_memory_id = $1
          ORDER BY COALESCE(reports.generated_at, reports.created_at) DESC, reports.created_at DESC
        `,
        [dailyMemoryId],
      );

      return rows
        .map(normalizeReportRow)
        .filter((report): report is Report => report !== null);
    }, []);
  }

  async markReportsStaleByDailyMemoryId(dailyMemoryId: string) {
    await this.write(async (database) => {
      await database.execute(
        `
          UPDATE reports
          SET status = 'stale',
              updated_at = $2
          WHERE id IN (
            SELECT report_id
            FROM report_sources
            WHERE daily_memory_id = $1
          )
        `,
        [dailyMemoryId, new Date().toISOString()],
      );
    });
  }

  async saveReport(report: Report) {
    await this.write(async (database) => {
      await saveReportRow(database, report);
    });
  }

  async updateReport(report: Report) {
    await this.saveReport(report);
  }

  async deleteReportSources(reportId: string) {
    await this.write(async (database) => {
      await database.execute('DELETE FROM report_sources WHERE report_id = $1', [reportId]);
    });
  }

  async saveReportSources(reportId: string, dailyMemories: DailyMemory[]) {
    await this.deleteReportSources(reportId);
    await this.write(async (database) => {
      for (const memory of dailyMemories) {
        await saveReportSourceRow(database, {
          id: getReportSourceId(reportId, memory.id),
          reportId,
          dailyMemoryId: memory.id,
          dailyMemoryUpdatedAtSnapshot: memory.updatedAt,
        });
      }
    });
  }

  async clearReports() {
    await this.write(async (database) => {
      await database.execute('DELETE FROM report_sources');
      await database.execute('DELETE FROM reports');
    });
  }

  async replaceAll(reports: Report[], reportSources: ReportSource[]) {
    await this.write(async (database) => {
      await database.execute('DELETE FROM report_sources');
      await database.execute('DELETE FROM reports');

      for (const report of reports) {
        await saveReportRow(database, report);
      }

      for (const source of reportSources) {
        const normalizedSource = normalizeReportSource(source);

        if (normalizedSource) {
          await saveReportSourceRow(database, normalizedSource);
        }
      }
    });
  }

  private async read<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      console.error('Failed to read reports from SQLite', error);

      return fallback;
    }
  }

  private async write(operation: (database: DatabaseClient) => Promise<void>) {
    try {
      const database = await this.getReadyDatabase();

      await operation(database);
    } catch (error) {
      console.error('Failed to write reports to SQLite', error);
      throw createFriendlyError('报告保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

export const reportRepository = new SQLiteReportRepository();

function getReportSourceId(reportId: string, dailyMemoryId: string) {
  return `report-source-${reportId}-${dailyMemoryId}`;
}

async function saveReportRow(database: DatabaseClient, report: Report) {
  await database.execute(
    `
      INSERT INTO reports (
        id,
        type,
        title,
        start_date,
        end_date,
        content_json,
        status,
        created_at,
        updated_at,
        generated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        content_json = excluded.content_json,
        status = excluded.status,
        updated_at = excluded.updated_at,
        generated_at = excluded.generated_at
    `,
    [
      report.id,
      report.type,
      report.title,
      report.startDate,
      report.endDate,
      JSON.stringify(report.content),
      report.status,
      report.createdAt,
      report.updatedAt,
      report.generatedAt ?? null,
    ],
  );
}

async function saveReportSourceRow(database: DatabaseClient, source: ReportSource) {
  await database.execute(
    `
      INSERT INTO report_sources (
        id,
        report_id,
        daily_memory_id,
        daily_memory_updated_at_snapshot
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      source.id,
      source.reportId,
      source.dailyMemoryId,
      source.dailyMemoryUpdatedAtSnapshot,
    ],
  );
}

function normalizeReportRow(row: ReportRow | undefined): Report | null {
  if (
    !row ||
    typeof row.id !== 'string' ||
    !isReportType(row.type) ||
    typeof row.title !== 'string' ||
    typeof row.start_date !== 'string' ||
    typeof row.end_date !== 'string' ||
    typeof row.content_json !== 'string' ||
    !isReportStatus(row.status) ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    content: parseReportContent(row.content_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    generatedAt: row.generated_at ?? undefined,
  };
}

function normalizeReportSourceRow(row: ReportSourceRow | undefined): ReportSource | null {
  if (
    !row ||
    typeof row.id !== 'string' ||
    typeof row.report_id !== 'string' ||
    typeof row.daily_memory_id !== 'string' ||
    typeof row.daily_memory_updated_at_snapshot !== 'string'
  ) {
    return null;
  }

  return {
    id: row.id,
    reportId: row.report_id,
    dailyMemoryId: row.daily_memory_id,
    dailyMemoryUpdatedAtSnapshot: row.daily_memory_updated_at_snapshot,
  };
}

function normalizeReportSource(value: unknown): ReportSource | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<ReportSource>;

  if (
    typeof source.id !== 'string' ||
    typeof source.reportId !== 'string' ||
    typeof source.dailyMemoryId !== 'string' ||
    typeof source.dailyMemoryUpdatedAtSnapshot !== 'string'
  ) {
    return null;
  }

  return {
    id: source.id,
    reportId: source.reportId,
    dailyMemoryId: source.dailyMemoryId,
    dailyMemoryUpdatedAtSnapshot: source.dailyMemoryUpdatedAtSnapshot,
  };
}

function parseReportContent(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function isReportType(value: string): value is ReportType {
  return (
    value === 'weekly' ||
    value === 'monthly' ||
    value === 'yearly' ||
    value === 'custom' ||
    value === 'performance' ||
    value === 'handoff'
  );
}

function isReportStatus(value: string): value is ReportStatus {
  return value === 'generated' || value === 'stale' || value === 'locked';
}
