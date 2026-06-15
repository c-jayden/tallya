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
  const execute = (query: string, bindValues?: unknown[]) => database.execute(query, bindValues);
  const select = <T>(query: string, bindValues?: unknown[]) => database.select<T>(query, bindValues);

  // Tauri's SQL plugin runs over a connection pool, and BEGIN/COMMIT are issued
  // as separate statements. Two overlapping transactions therefore race on
  // BEGIN ("cannot start a transaction within a transaction") and on the write
  // lock ("database is locked"). Chain every transaction onto the previous one
  // so they run strictly one at a time.
  let tail: Promise<unknown> = Promise.resolve();

  // Passed to a transaction's operation: a nested transaction() call reuses the
  // running transaction instead of issuing a second BEGIN (which would deadlock
  // against the queue).
  const transactionClient: DatabaseClient = {
    execute,
    select,
    transaction: (operation) => operation(transactionClient),
  };

  const client: DatabaseClient = {
    execute,
    select,
    transaction<T>(operation: (database: DatabaseClient) => Promise<T>) {
      const run = async (): Promise<T> => {
        await execute('BEGIN IMMEDIATE');

        try {
          const result = await operation(transactionClient);
          await execute('COMMIT');

          return result;
        } catch (error) {
          try {
            await execute('ROLLBACK');
          } catch (rollbackError) {
            logger.warn('sqlite', 'database.transaction_rollback_failed', 'Failed to roll back SQLite transaction', {
              error: rollbackError,
            });
          }

          throw error;
        }
      };

      const result = tail.then(run, run);
      // Keep the queue alive regardless of this transaction's outcome.
      tail = result.then(noop, noop);

      return result;
    },
  };

  return client;
}

function noop() {}
