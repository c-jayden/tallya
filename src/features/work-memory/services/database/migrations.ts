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
  await migrateAppSettingsTable(database);
  await database.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

type TableColumnRow = {
  name: string;
};

async function migrateAppSettingsTable(database: DatabaseClient) {
  const columns = await database.select<TableColumnRow[]>('PRAGMA table_info(app_settings)');
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.has('value_json')) {
    await database.execute('ALTER TABLE app_settings RENAME TO app_settings_legacy_json');
    await database.execute(createAppSettingsTableSql);
    return;
  }

  if (!columnNames.has('key')) {
    await database.execute(createAppSettingsTableSql);
  }
}
