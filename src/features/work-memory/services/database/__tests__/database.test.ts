import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../database';

describe('DatabaseClient transactions', () => {
  it('commits successful operations', async () => {
    const executedQueries: string[] = [];
    const database = createDatabaseClient({
      execute: async (query: string) => {
        executedQueries.push(query);
      },
      select: async <T>() => [] as T,
    });

    await database.transaction(async (transactionDatabase) => {
      await transactionDatabase.execute('INSERT INTO app_settings');
    });

    expect(executedQueries).toEqual(['BEGIN IMMEDIATE', 'INSERT INTO app_settings', 'COMMIT']);
  });

  it('rolls back failed operations', async () => {
    const executedQueries: string[] = [];
    const database = createDatabaseClient({
      execute: async (query: string) => {
        executedQueries.push(query);
      },
      select: async <T>() => [] as T,
    });

    await expect(
      database.transaction(async (transactionDatabase) => {
        await transactionDatabase.execute('INSERT INTO app_settings');
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');

    expect(executedQueries).toEqual(['BEGIN IMMEDIATE', 'INSERT INTO app_settings', 'ROLLBACK']);
  });
});
