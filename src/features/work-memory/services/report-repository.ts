import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';

export class SQLiteReportRepository {
  constructor(private readonly database: Promise<DatabaseClient> = getDatabase()) {}

  async clearReports() {
    const database = await this.database;

    await database.execute('DELETE FROM report_sources');
    await database.execute('DELETE FROM reports');
  }
}

export const reportRepository = new SQLiteReportRepository();
