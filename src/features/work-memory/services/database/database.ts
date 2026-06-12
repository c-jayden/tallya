import { DATABASE_PATH } from './schema';
import { runMigrations } from './migrations';
import { logger } from '../logger/logger';
import { createFriendlyError } from '../service-error';

export type DatabaseClient = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  transaction<T>(operation: (database: DatabaseClient) => Promise<T>): Promise<T>;
};

let databasePromise: Promise<DatabaseClient> | null = null;

export async function initializeDatabase() {
  return getDatabase();
}

export function getDatabase() {
  databasePromise ??= loadDatabase();

  return databasePromise;
}

export function setDatabaseForTesting(database: DatabaseClient | null) {
  databasePromise = database ? Promise.resolve(database) : null;
}

async function loadDatabase() {
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const database = createDatabaseClient(await Database.load(DATABASE_PATH));

    await runMigrations(database);

    return database;
  } catch (error) {
    logger.error('sqlite', 'database.initialize_failed', 'Failed to initialize SQLite database', {
      databasePath: DATABASE_PATH,
      error,
    });
    throw createFriendlyError('本地数据库初始化失败，请稍后重试。', error);
  }
}

export function createDatabaseClient(database: Pick<DatabaseClient, 'execute' | 'select'>): DatabaseClient {
  let transactionDepth = 0;

  const client: DatabaseClient = {
    execute: (query, bindValues) => database.execute(query, bindValues),
    select: <T>(query: string, bindValues?: unknown[]) => database.select<T>(query, bindValues),
    async transaction<T>(operation: (database: DatabaseClient) => Promise<T>) {
      if (transactionDepth > 0) {
        return operation(client);
      }

      await client.execute('BEGIN IMMEDIATE');
      transactionDepth += 1;

      try {
        const result = await operation(client);
        await client.execute('COMMIT');

        return result;
      } catch (error) {
        try {
          await client.execute('ROLLBACK');
        } catch (rollbackError) {
          logger.warn('sqlite', 'database.transaction_rollback_failed', 'Failed to roll back SQLite transaction', {
            error: rollbackError,
          });
        }

        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
  };

  return client;
}
