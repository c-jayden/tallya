import type { DatabaseClient } from './database';
import {
  SCHEMA_VERSION,
  createAppSettingsTableSql,
  createDailyMemoriesTableSql,
  createReportSourcesTableSql,
  createReportsTableSql,
} from './schema';

export async function runMigrations(database: DatabaseClient) {
  await database.execute(createDailyMemoriesTableSql);
  await database.execute(createReportsTableSql);
  await database.execute(createReportSourcesTableSql);
  await database.execute(createAppSettingsTableSql);
  await database.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
