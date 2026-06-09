import { DATABASE_PATH } from './schema';
import { runMigrations } from './migrations';
import { logger } from '../logger/logger';
import { createFriendlyError } from '../service-error';

export type DatabaseClient = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
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
    const database = await Database.load(DATABASE_PATH);

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
