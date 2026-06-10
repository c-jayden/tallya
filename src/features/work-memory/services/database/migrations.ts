import type { DatabaseClient } from './database';
import {
  SCHEMA_VERSION,
  createAppSettingsTableSql,
  createDailyMemoriesTableSql,
  createEntriesFtsSql,
  createEntriesFtsTriggersSql,
  createEntriesIndexSql,
  createEntriesTableSql,
  createReportSourcesTableSql,
  createReportsTableSql,
} from './schema';
import { logger } from '../logger/logger';

export async function runMigrations(database: DatabaseClient) {
  await database.execute(createDailyMemoriesTableSql);
  await database.execute(createReportsTableSql);
  await database.execute(createReportSourcesTableSql);
  await database.execute(createEntriesTableSql);
  await database.execute(createEntriesIndexSql);
  await setupEntriesFts(database);
  await migrateAppSettingsTable(database);
  await migrateDailyMemoriesToEntries(database);
  await database.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

type EntryCountRow = {
  count: number;
};

type DailyMemoryContentRow = {
  id: string;
  date: string;
  raw_content: string;
  created_at: string;
  updated_at: string;
};

// FTS5 + its sync triggers are best-effort: if the bundled SQLite lacks the
// trigram tokenizer, search degrades to LIKE rather than blocking startup.
async function setupEntriesFts(database: DatabaseClient) {
  try {
    await database.execute(createEntriesFtsSql);

    for (const triggerSql of createEntriesFtsTriggersSql) {
      await database.execute(triggerSql);
    }
  } catch (error) {
    logger.warn('sqlite', 'database.entries_fts_setup_failed', 'Failed to set up entries FTS index; search will fall back to LIKE', {
      table: 'entries_fts',
      error,
    });
  }
}

// One-time, best-effort backfill: each legacy daily memory becomes one entry so
// existing history stays searchable. Early data is not critical, so any failure
// is logged and swallowed instead of blocking startup. The old table is kept.
async function migrateDailyMemoriesToEntries(database: DatabaseClient) {
  try {
    const entryCountRows = await database.select<EntryCountRow[]>(
      'SELECT COUNT(*) AS count FROM entries',
    );

    if ((entryCountRows[0]?.count ?? 0) > 0) {
      return;
    }

    const memories = await database.select<DailyMemoryContentRow[]>(
      'SELECT id, date, raw_content, created_at, updated_at FROM daily_memories ORDER BY date ASC',
    );

    for (const memory of memories) {
      const content = memory.raw_content?.trim();

      if (!content) {
        continue;
      }

      const occurredAt = memory.created_at || `${memory.date}T00:00:00.000Z`;

      await database.execute(
        `INSERT INTO entries (id, content, occurred_at, occurred_on, thread_id, difficulty, effort, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          `entry-migrated-${memory.id}`,
          content,
          occurredAt,
          memory.date,
          null,
          null,
          null,
          memory.created_at || occurredAt,
          memory.updated_at || occurredAt,
        ],
      );
    }
  } catch (error) {
    logger.warn('sqlite', 'database.daily_memories_to_entries_failed', 'Failed to migrate legacy daily memories into entries', {
      table: 'entries',
      error,
    });
  }
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
