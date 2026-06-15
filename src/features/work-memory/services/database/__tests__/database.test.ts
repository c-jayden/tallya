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

  it('serializes concurrent transactions so BEGIN/COMMIT never interleave', async () => {
    const executedQueries: string[] = [];
    const database = createDatabaseClient({
      execute: async (query: string) => {
        executedQueries.push(query);
      },
      select: async <T>() => [] as T,
    });

    // The first transaction yields to the event loop mid-flight; without
    // serialization the second transaction's BEGIN would slip in between.
    const first = database.transaction(async (transactionDatabase) => {
      await transactionDatabase.execute('A1');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await transactionDatabase.execute('A2');
    });
    const second = database.transaction(async (transactionDatabase) => {
      await transactionDatabase.execute('B1');
    });

    await Promise.all([first, second]);

    expect(executedQueries).toEqual([
      'BEGIN IMMEDIATE',
      'A1',
      'A2',
      'COMMIT',
      'BEGIN IMMEDIATE',
      'B1',
      'COMMIT',
    ]);
  });

  it('keeps the queue alive after a failed transaction', async () => {
    const executedQueries: string[] = [];
    const database = createDatabaseClient({
      execute: async (query: string) => {
        executedQueries.push(query);
      },
      select: async <T>() => [] as T,
    });

    await expect(
      database.transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await database.transaction(async (transactionDatabase) => {
      await transactionDatabase.execute('NEXT');
    });

    expect(executedQueries).toEqual([
      'BEGIN IMMEDIATE',
      'ROLLBACK',
      'BEGIN IMMEDIATE',
      'NEXT',
      'COMMIT',
    ]);
  });
});
