import type { Report, ReportStatus, ReportType } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
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

  async saveReport(report: Report) {
    await this.write(async (database) => {
      await saveReportRow(database, report);
    });
  }

  async updateReport(report: Report) {
    await this.saveReport(report);
  }

  async clearReports() {
    await this.write(async (database) => {
      await database.execute('DELETE FROM reports');
    });
  }

  async replaceAll(reports: Report[]) {
    await this.write(async (database) => {
      await database.execute('DELETE FROM reports');

      for (const report of reports) {
        await saveReportRow(database, report);
      }
    });
  }

  private async read<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      logger.error('report', 'report-repository.read_failed', 'Failed to read reports from SQLite', {
        operation: 'select',
        table: 'reports',
        error,
      });

      return fallback;
    }
  }

  private async write(operation: (database: DatabaseClient) => Promise<void>) {
    try {
      const database = await this.getReadyDatabase();

      await operation(database);
    } catch (error) {
      logger.error('report', 'report-repository.write_failed', 'Failed to write reports to SQLite', {
        operation: 'write',
        table: 'reports',
        error,
      });
      throw createFriendlyError('报告保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

export const reportRepository = new SQLiteReportRepository();

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
