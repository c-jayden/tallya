import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrations';
import { TestDatabaseClient } from './test-database';

describe('database migrations', () => {
  it('creates the local persistence tables', async () => {
    const database = new TestDatabaseClient();

    await runMigrations(database);

    expect(database.createdTables).toEqual(
      new Set(['daily_memories', 'reports', 'report_sources', 'app_settings']),
    );
  });
});
