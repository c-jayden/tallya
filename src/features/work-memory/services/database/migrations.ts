import type { DatabaseClient } from './database';
import {
  SCHEMA_VERSION,
  createAppSettingsTableSql,
  createDailyMemoriesTableSql,
  createEntriesFtsSql,
  createEntriesFtsTriggersSql,
  createEntriesIndexSql,
  createEntriesTableSql,
  createEntriesThreadIndexSql,
  createEntryClarificationsIndexSql,
  createEntryClarificationsTableSql,
  createReportSourcesTableSql,
  createReportsTableSql,
  createThreadsIndexSql,
  createThreadsTableSql,
} from './schema';
import { buildEntryFromDailyMemory } from '../daily-memory-entry-migration';
import { logger } from '../logger/logger';

export async function runMigrations(database: DatabaseClient) {
  await database.execute(createDailyMemoriesTableSql);
  await database.execute(createReportsTableSql);
  await database.execute(createReportSourcesTableSql);
  await database.execute(createEntriesTableSql);
  await database.execute(createEntriesIndexSql);
  await database.execute(createEntriesThreadIndexSql);
  await database.execute(createThreadsTableSql);
  await database.execute(createThreadsIndexSql);
  await database.execute(createEntryClarificationsTableSql);
  await database.execute(createEntryClarificationsIndexSql);
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

// One-time-migration markers live in their own table: putting them into
// app_settings would make hasSavedSettings() misread a marker-only database as
// "user already has settings" and skip the legacy localStorage migration.
const createInternalFlagsTableSql = `
  CREATE TABLE IF NOT EXISTS internal_flags (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

// "entries is empty" alone is not a safe trigger for the daily-memory backfill:
// a user who deletes every entry by hand would otherwise get the legacy daily
// memories resurrected on the next startup.
const DAILY_MEMORIES_MIGRATION_MARKER_KEY = 'dailyMemoriesMigratedToEntries.v1';

type InternalFlagValueRow = {
  value: string;
};

// One-time, best-effort backfill: each legacy daily memory becomes one entry so
// existing history stays searchable. Early data is not critical, so any failure
// is logged and swallowed instead of blocking startup. The old table is kept.
async function migrateDailyMemoriesToEntries(database: DatabaseClient) {
  try {
    await database.execute(createInternalFlagsTableSql);

    const markerRows = await database.select<InternalFlagValueRow[]>(
      'SELECT value FROM internal_flags WHERE key = $1',
      [DAILY_MEMORIES_MIGRATION_MARKER_KEY],
    );

    if (markerRows[0]?.value === '1') {
      return;
    }

    const entryCountRows = await database.select<EntryCountRow[]>(
      'SELECT COUNT(*) AS count FROM entries',
    );

    if ((entryCountRows[0]?.count ?? 0) > 0) {
      await writeDailyMemoriesMigrationMarker(database);
      return;
    }

    const memories = await database.select<DailyMemoryContentRow[]>(
      'SELECT id, date, raw_content, created_at, updated_at FROM daily_memories ORDER BY date ASC',
    );

    for (const memory of memories) {
      const entry = buildEntryFromDailyMemory({
        id: memory.id,
        date: memory.date,
        rawContent: memory.raw_content,
        createdAt: memory.created_at,
        updatedAt: memory.updated_at,
      });

      if (!entry) {
        continue;
      }

      await database.execute(
        `INSERT INTO entries (id, content, occurred_at, occurred_on, thread_id, difficulty, effort, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.id,
          entry.content,
          entry.occurredAt,
          entry.occurredOn,
          entry.threadId,
          entry.difficulty,
          entry.effort,
          entry.createdAt,
          entry.updatedAt,
        ],
      );
    }

    await writeDailyMemoriesMigrationMarker(database);
  } catch (error) {
    logger.warn('sqlite', 'database.daily_memories_to_entries_failed', 'Failed to migrate legacy daily memories into entries', {
      table: 'entries',
      error,
    });
  }
}

async function writeDailyMemoriesMigrationMarker(database: DatabaseClient) {
  await database.execute(
    `
      INSERT INTO internal_flags (key, value, updated_at)
      VALUES ($1, '1', $2)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    [DAILY_MEMORIES_MIGRATION_MARKER_KEY, new Date().toISOString()],
  );
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
