import type { DatabaseClient } from './database';
import {
  SCHEMA_VERSION,
  createAppSettingsTableSql,
  createDailyMemoriesTableSql,
  createReportSourcesTableSql,
  createReportsTableSql,
} from './schema';
import { logger } from '../logger/logger';

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

  if (columnNames.has('value_json') || (columnNames.has('key') && !columnNames.has('value'))) {
    await database.execute('DROP TABLE app_settings');
    await database.execute(createAppSettingsTableSql);
    await dropLegacyAppSettingsJsonTable(database);
    return;
  }

  if (!columnNames.has('key')) {
    await database.execute(createAppSettingsTableSql);
  }

  await dropLegacyAppSettingsJsonTable(database);
}

async function dropLegacyAppSettingsJsonTable(database: DatabaseClient) {
  try {
    await database.execute('DROP TABLE IF EXISTS app_settings_legacy_json');
  } catch (error) {
    // The legacy cleanup is not required for current reads/writes. SQLite
    // inspection tools can hold read locks, so cleanup must not block startup.
    logger.warn('sqlite', 'database.legacy_app_settings_cleanup_failed', 'Failed to clean up legacy app settings table', {
      table: 'app_settings_legacy_json',
      error,
    });
  }
}
