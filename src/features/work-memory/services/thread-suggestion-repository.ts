import type { CreateThreadSuggestionInput, ThreadSuggestion } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
import { createFriendlyError } from './service-error';

const STORAGE_KEY = 'tallya.thread-suggestions.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

export type ThreadSuggestionRepository = {
  // One pending suggestion per entry: upsert replaces any prior suggestion for
  // the same entry (e.g. a re-analysis after an edit).
  upsert(input: CreateThreadSuggestionInput): Promise<ThreadSuggestion>;
  getByEntryId(entryId: string): Promise<ThreadSuggestion | null>;
  listAll(): Promise<ThreadSuggestion[]>;
  remove(entryId: string): Promise<void>;
  removeByEntryIds(entryIds: string[]): Promise<void>;
  clearLocalData(): Promise<void>;
};

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function buildSuggestion(input: CreateThreadSuggestionInput, now: Clock): ThreadSuggestion {
  const timestamp = now().toISOString();

  return {
    entryId: input.entryId,
    relatedEntryId: input.relatedEntryId,
    proposedThreadTitle: input.proposedThreadTitle.trim(),
    existingThreadId: input.existingThreadId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function compareByCreatedAtAsc(first: ThreadSuggestion, second: ThreadSuggestion) {
  return first.createdAt.localeCompare(second.createdAt);
}

export class LocalStorageThreadSuggestionRepository implements ThreadSuggestionRepository {
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

  async upsert(input: CreateThreadSuggestionInput) {
    const items = this.readAll();
    const existing = items.find((item) => item.entryId === input.entryId);
    const suggestion = buildSuggestion(input, this.now);

    // Preserve the original createdAt so the soft-expiry clock isn't reset by a
    // re-analysis of the same entry.
    if (existing) {
      suggestion.createdAt = existing.createdAt;
    }

    this.writeAll([...items.filter((item) => item.entryId !== input.entryId), suggestion]);

    return suggestion;
  }

  async getByEntryId(entryId: string) {
    return this.readAll().find((item) => item.entryId === entryId) ?? null;
  }

  async listAll() {
    return this.readAll().sort(compareByCreatedAtAsc);
  }

  async remove(entryId: string) {
    this.writeAll(this.readAll().filter((item) => item.entryId !== entryId));
  }

  async removeByEntryIds(entryIds: string[]) {
    if (entryIds.length === 0) {
      return;
    }

    const ids = new Set(entryIds);
    this.writeAll(this.readAll().filter((item) => !ids.has(item.entryId)));
  }

  async clearLocalData() {
    this.writeAll([]);
  }

  private readAll(): ThreadSuggestion[] {
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
        ? parsed.map(normalizeSuggestion).filter((item): item is ThreadSuggestion => item !== null)
        : [];
    } catch {
      return [];
    }
  }

  private writeAll(items: ThreadSuggestion[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

type ThreadSuggestionRow = {
  entry_id: string;
  related_entry_id: string;
  proposed_thread_title: string;
  existing_thread_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ThreadSuggestionRow): ThreadSuggestion {
  return {
    entryId: row.entry_id,
    relatedEntryId: row.related_entry_id,
    proposedThreadTitle: row.proposed_thread_title,
    existingThreadId: row.existing_thread_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteThreadSuggestionRepository implements ThreadSuggestionRepository {
  private now: Clock;
  private databasePromise: Promise<DatabaseClient> | null;

  constructor(database?: Promise<DatabaseClient>, options: RepositoryOptions = {}) {
    this.databasePromise = database ?? null;
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async upsert(input: CreateThreadSuggestionInput) {
    const suggestion = buildSuggestion(input, this.now);

    await this.write((database) =>
      // ON CONFLICT keeps the original created_at (soft-expiry clock) while
      // refreshing the suggestion's target and updated_at.
      database.execute(
        `INSERT INTO thread_suggestions (entry_id, related_entry_id, proposed_thread_title, existing_thread_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(entry_id) DO UPDATE SET
           related_entry_id = excluded.related_entry_id,
           proposed_thread_title = excluded.proposed_thread_title,
           existing_thread_id = excluded.existing_thread_id,
           updated_at = excluded.updated_at`,
        [
          suggestion.entryId,
          suggestion.relatedEntryId,
          suggestion.proposedThreadTitle,
          suggestion.existingThreadId,
          suggestion.createdAt,
          suggestion.updatedAt,
        ],
      ),
    );

    return (await this.getByEntryId(suggestion.entryId)) ?? suggestion;
  }

  async getByEntryId(entryId: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<ThreadSuggestionRow[]>(
        'SELECT * FROM thread_suggestions WHERE entry_id = $1 LIMIT 1',
        [entryId],
      );

      return rows[0] ? mapRow(rows[0]) : null;
    }, null);
  }

  async listAll() {
    return this.safeRead(async (database) => {
      const rows = await database.select<ThreadSuggestionRow[]>(
        'SELECT * FROM thread_suggestions ORDER BY created_at ASC, rowid ASC',
      );

      return rows.map(mapRow);
    }, []);
  }

  async remove(entryId: string) {
    await this.write((database) =>
      database.execute('DELETE FROM thread_suggestions WHERE entry_id = $1', [entryId]),
    );
  }

  async removeByEntryIds(entryIds: string[]) {
    if (entryIds.length === 0) {
      return;
    }

    await this.write((database) => {
      const placeholders = entryIds.map((_, index) => `$${index + 1}`).join(', ');

      return database.execute(
        `DELETE FROM thread_suggestions WHERE entry_id IN (${placeholders})`,
        entryIds,
      );
    });
  }

  async clearLocalData() {
    await this.write((database) => database.execute('DELETE FROM thread_suggestions'));
  }

  private async safeRead<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      logger.error('sqlite', 'thread_suggestion.read_failed', 'Failed to read thread suggestions from SQLite', {
        operation: 'select',
        table: 'thread_suggestions',
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
      logger.error('sqlite', 'thread_suggestion.write_failed', 'Failed to write thread suggestion to SQLite', {
        operation: 'write',
        table: 'thread_suggestions',
        error,
      });
      throw createFriendlyError('归并建议保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

function isThreadSuggestionLike(value: unknown): value is ThreadSuggestion {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.entryId === 'string' &&
    typeof candidate.relatedEntryId === 'string' &&
    typeof candidate.proposedThreadTitle === 'string'
  );
}

function normalizeSuggestion(value: unknown): ThreadSuggestion | null {
  if (!isThreadSuggestionLike(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const timestamp =
    typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString();

  return {
    entryId: value.entryId,
    relatedEntryId: value.relatedEntryId,
    proposedThreadTitle: value.proposedThreadTitle,
    existingThreadId:
      typeof candidate.existingThreadId === 'string' ? candidate.existingThreadId : null,
    createdAt: timestamp,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : timestamp,
  };
}

export const threadSuggestionRepository: ThreadSuggestionRepository =
  new SQLiteThreadSuggestionRepository();
