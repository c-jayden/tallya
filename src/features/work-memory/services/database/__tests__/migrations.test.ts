import { describe, expect, it } from 'vitest';
import type { DatabaseClient } from '../database';
import { runMigrations } from '../migrations';
import { TestDatabaseClient } from '../test-database';

describe('database migrations', () => {
  it('creates the local persistence tables', async () => {
    const database = new TestDatabaseClient();

    await runMigrations(database);

    expect(database.createdTables).toEqual(
      new Set([
        'daily_memories',
        'reports',
        'report_sources',
        'app_settings',
        'entries',
        'entry_clarifications',
      ]),
    );
  });

  it('drops the old JSON app settings tables during development migration', async () => {
    const database = new LegacyJsonAppSettingsDatabase();

    await runMigrations(database);

    expect(database.executedQueries).toContain('DROP TABLE app_settings');
    expect(database.executedQueries).toContain('DROP TABLE IF EXISTS app_settings_legacy_json');
    expect(database.executedQueries.some((query) => query.startsWith('ALTER TABLE'))).toBe(false);
  });

  it('drops the column app settings table during development migration', async () => {
    const database = new ColumnAppSettingsDatabase();

    await runMigrations(database);

    expect(database.executedQueries).toContain('DROP TABLE app_settings');
    expect(database.executedQueries).toContain(
      'CREATE TABLE IF NOT EXISTS app_settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL )',
    );
  });

  it('does not fail startup when the legacy JSON settings cleanup is locked', async () => {
    const database = new LockedLegacyCleanupDatabase();

    await expect(runMigrations(database)).resolves.toBeUndefined();
    expect(database.executedQueries).toContain('DROP TABLE IF EXISTS app_settings_legacy_json');
  });
});

class LegacyJsonAppSettingsDatabase implements DatabaseClient {
  readonly executedQueries: string[] = [];

  async execute(query: string) {
    this.executedQueries.push(normalizeQuery(query));
  }

  async select<T>(query: string) {
    if (normalizeQuery(query) === 'PRAGMA table_info(app_settings)') {
      return [{ name: 'key' }, { name: 'value_json' }] as T;
    }

    return [] as T;
  }
}

class ColumnAppSettingsDatabase extends LegacyJsonAppSettingsDatabase {
  override async select<T>(query: string) {
    if (normalizeQuery(query) === 'PRAGMA table_info(app_settings)') {
      return [{ name: 'key' }, { name: 'theme' }, { name: 'close_to_tray' }] as T;
    }

    return [] as T;
  }
}

class LockedLegacyCleanupDatabase extends TestDatabaseClient {
  readonly executedQueries: string[] = [];

  override async execute(query: string, bindValues: unknown[] = []) {
    this.executedQueries.push(normalizeQuery(query));

    if (normalizeQuery(query) === 'DROP TABLE IF EXISTS app_settings_legacy_json') {
      throw new Error('database is locked');
    }

    return super.execute(query, bindValues);
  }
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim();
}
