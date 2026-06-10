import type { CreateThreadInput, Thread, ThreadStatus, UpdateThreadInput } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
import { createFriendlyError } from './service-error';

const STORAGE_KEY = 'tallya.threads.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

export type ThreadRepository = {
  create(input: CreateThreadInput): Promise<Thread>;
  getById(id: string): Promise<Thread | null>;
  list(): Promise<Thread[]>;
  update(id: string, input: UpdateThreadInput): Promise<Thread | null>;
  remove(id: string): Promise<void>;
  clearLocalData(): Promise<void>;
};

function buildThreadId(): string {
  return `thread_${crypto.randomUUID()}`;
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function normalizeStatus(status: ThreadStatus | undefined): ThreadStatus {
  return status === 'archived' ? 'archived' : 'open';
}

function compareByUpdatedAtDesc(first: Thread, second: Thread) {
  return (
    second.updatedAt.localeCompare(first.updatedAt) || second.id.localeCompare(first.id)
  );
}

function buildThread(input: CreateThreadInput, now: Clock): Thread {
  const timestamp = now().toISOString();

  return {
    id: buildThreadId(),
    title: input.title.trim(),
    status: normalizeStatus(input.status),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class LocalStorageThreadRepository implements ThreadRepository {
  private now: Clock;

  constructor(
    private readonly storage: Storage | null = getBrowserStorage(),
    options: RepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async create(input: CreateThreadInput) {
    const thread = buildThread(input, this.now);
    const threads = this.readAll();

    threads.push(thread);
    this.writeAll(threads);

    return thread;
  }

  async getById(id: string) {
    return this.readAll().find((thread) => thread.id === id) ?? null;
  }

  async list() {
    return this.readAll().sort(compareByUpdatedAtDesc);
  }

  async update(id: string, input: UpdateThreadInput) {
    const threads = this.readAll();
    const index = threads.findIndex((thread) => thread.id === id);

    if (index === -1) {
      return null;
    }

    const current = threads[index];
    const updated: Thread = {
      ...current,
      title: input.title?.trim() ?? current.title,
      status: input.status ?? current.status,
      updatedAt: this.now().toISOString(),
    };

    threads[index] = updated;
    this.writeAll(threads);

    return updated;
  }

  async remove(id: string) {
    this.writeAll(this.readAll().filter((thread) => thread.id !== id));
  }

  async clearLocalData() {
    this.writeAll([]);
  }

  private readAll(): Thread[] {
    if (!this.storage) {
      return [];
    }

    const raw = this.storage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((thread): thread is Thread => isThreadLike(thread))
        : [];
    } catch {
      return [];
    }
  }

  private writeAll(threads: Thread[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(threads));
  }
}

type ThreadRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    status: row.status === 'archived' ? 'archived' : 'open',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteThreadRepository implements ThreadRepository {
  private now: Clock;
  private databasePromise: Promise<DatabaseClient> | null;

  constructor(database?: Promise<DatabaseClient>, options: RepositoryOptions = {}) {
    this.databasePromise = database ?? null;
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async create(input: CreateThreadInput) {
    const thread = buildThread(input, this.now);

    await this.write((database) =>
      database.execute(
        `INSERT INTO threads (id, title, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [thread.id, thread.title, thread.status, thread.createdAt, thread.updatedAt],
      ),
    );

    return thread;
  }

  async getById(id: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<ThreadRow[]>(
        'SELECT * FROM threads WHERE id = $1 LIMIT 1',
        [id],
      );

      return rows[0] ? mapRow(rows[0]) : null;
    }, null);
  }

  async list() {
    return this.safeRead(async (database) => {
      const rows = await database.select<ThreadRow[]>(
        'SELECT * FROM threads ORDER BY updated_at DESC',
      );

      return rows.map(mapRow);
    }, []);
  }

  async update(id: string, input: UpdateThreadInput) {
    const existing = await this.getById(id);

    if (!existing) {
      return null;
    }

    const updated: Thread = {
      ...existing,
      title: input.title?.trim() ?? existing.title,
      status: input.status ?? existing.status,
      updatedAt: this.now().toISOString(),
    };

    await this.write((database) =>
      database.execute(
        'UPDATE threads SET title = $1, status = $2, updated_at = $3 WHERE id = $4',
        [updated.title, updated.status, updated.updatedAt, updated.id],
      ),
    );

    return updated;
  }

  async remove(id: string) {
    await this.write((database) =>
      database.execute('DELETE FROM threads WHERE id = $1', [id]),
    );
  }

  async clearLocalData() {
    await this.write((database) => database.execute('DELETE FROM threads'));
  }

  private async safeRead<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      logger.error('sqlite', 'thread.read_failed', 'Failed to read threads from SQLite', {
        operation: 'select',
        table: 'threads',
        error,
      });

      return fallback;
    }
  }

  private async write(operation: (database: DatabaseClient) => Promise<unknown>) {
    try {
      const database = await this.getReadyDatabase();

      await operation(database);
    } catch (error) {
      logger.error('sqlite', 'thread.write_failed', 'Failed to write thread to SQLite', {
        operation: 'write',
        table: 'threads',
        error,
      });
      throw createFriendlyError('线索保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

function isThreadLike(value: unknown): value is Thread {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === 'string' && typeof candidate.title === 'string';
}

export const threadRepository: ThreadRepository = new SQLiteThreadRepository();
