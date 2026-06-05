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

  async getWeeklyReportByRange(startDate: string, endDate: string) {
    return this.read(async (database) => {
      const rows = await database.select<ReportRow[]>(
        `
          SELECT * FROM reports
          WHERE type = $1 AND start_date = $2 AND end_date = $3
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        ['weekly', startDate, endDate],
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

  async saveReport(report: Report) {
    await this.write(async (database) => {
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
    });
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
            getReportSourceId(reportId, memory.id),
            reportId,
            memory.id,
            memory.updatedAt,
          ],
        );
      }
    });
  }

  async clearReports() {
    await this.write(async (database) => {
      await database.execute('DELETE FROM report_sources');
      await database.execute('DELETE FROM reports');
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
