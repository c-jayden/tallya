import { describe, expect, it } from 'vitest';
import type { DatabaseClient } from '../database';
import { runMigrations } from '../migrations';
import { SCHEMA_VERSION } from '../schema';
import { TestDatabaseClient } from '../test-database';

describe('database migrations', () => {
  it('creates the local persistence tables', async () => {
    const database = new TestDatabaseClient();

    await runMigrations(database);

    expect(database.createdTables).toEqual(
      new Set([
        'daily_memories',
        'reports',
        'app_settings',
        'entries',
        'entry_clarifications',
        'threads',
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

  it('runs schema migrations incrementally from the stored user_version', async () => {
    const database = new VersionedMigrationDatabase(0);

    await runMigrations(database);

    expect(database.userVersionReads).toBe(1);
    expect(database.writtenUserVersions).toEqual([1, 2, 3, 4, 5, 6, SCHEMA_VERSION]);
    expect(database.userVersion).toBe(SCHEMA_VERSION);
  });

  it('does not rerun schema migrations when user_version is current', async () => {
    const database = new VersionedMigrationDatabase(SCHEMA_VERSION);

    await runMigrations(database);

    expect(database.userVersionReads).toBe(1);
    expect(database.writtenUserVersions).toEqual([]);
  });

  it('drops the legacy report_sources table when upgrading to schema version 7', async () => {
    const database = new LockedLegacyCleanupDatabase();
    database.userVersion = 6;

    await runMigrations(database);

    expect(database.executedQueries).toContain('DROP TABLE IF EXISTS report_sources');
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

  async transaction<T>(operation: (database: DatabaseClient) => Promise<T>): Promise<T> {
    return operation(this);
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

class VersionedMigrationDatabase extends TestDatabaseClient {
  userVersionReads = 0;
  writtenUserVersions: number[] = [];

  constructor(public userVersion: number) {
    super();
  }

  override async execute(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = normalizeQuery(query);
    const userVersionMatch = normalizedQuery.match(/^PRAGMA user_version = (\d+)$/);

    if (userVersionMatch) {
      const version = Number(userVersionMatch[1]);
      this.writtenUserVersions.push(version);
      this.userVersion = version;
      return;
    }

    return super.execute(query, bindValues);
  }

  override async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    if (normalizeQuery(query) === 'PRAGMA user_version') {
      this.userVersionReads += 1;
      return [{ user_version: this.userVersion }] as T;
    }

    return super.select<T>(query, bindValues);
  }
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim();
}
