import type { CreateEntryInput, Entry, UpdateEntryInput } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
import { createFriendlyError } from './service-error';

const STORAGE_KEY = 'tallya.entries.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

export type EntryRepository = {
  create(input: CreateEntryInput): Promise<Entry>;
  update(id: string, input: UpdateEntryInput): Promise<Entry | null>;
  remove(id: string): Promise<void>;
  getById(id: string): Promise<Entry | null>;
  listByDate(date: string): Promise<Entry[]>;
  listRange(startDate: string, endDate: string): Promise<Entry[]>;
  listByThread(threadId: string): Promise<Entry[]>;
  listRecent(limit: number): Promise<Entry[]>;
  listAll(): Promise<Entry[]>;
  replaceAll(entries: Entry[]): Promise<void>;
  setThread(id: string, threadId: string | null): Promise<Entry | null>;
  search(keyword: string): Promise<Entry[]>;
  clearLocalData(): Promise<void>;
};

export function getEntryDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildEntryId(): string {
  return `entry_${crypto.randomUUID()}`;
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

// occurredAt is the primary key, but entries backfilled onto a past day all
// share the same (noon) timestamp, so createdAt — the real wall-clock creation
// time — breaks the tie by insertion order. id (a random UUID) is the last
// resort only to keep the sort deterministic.
function compareByOccurredAtDesc(first: Entry, second: Entry) {
  return (
    second.occurredAt.localeCompare(first.occurredAt) ||
    second.createdAt.localeCompare(first.createdAt) ||
    second.id.localeCompare(first.id)
  );
}

function compareByOccurredAtAsc(first: Entry, second: Entry) {
  return (
    first.occurredAt.localeCompare(second.occurredAt) ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

// Capture is structureless: only content + timestamps are set here. thread_id /
// difficulty / effort are reserved for later milestones and stay null.
function buildEntry(input: CreateEntryInput, now: Clock): Entry {
  const occurredAt = input.occurredAt ?? now().toISOString();
  const timestamp = now().toISOString();

  return {
    id: buildEntryId(),
    content: input.content.trim(),
    occurredAt,
    occurredOn: getEntryDate(new Date(occurredAt)),
    threadId: null,
    difficulty: null,
    effort: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class LocalStorageEntryRepository implements EntryRepository {
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

  async create(input: CreateEntryInput) {
    const entry = buildEntry(input, this.now);
    const entries = this.readAll();

    entries.push(entry);
    this.writeAll(entries);

    return entry;
  }

  async update(id: string, input: UpdateEntryInput) {
    const entries = this.readAll();
    const index = entries.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return null;
    }

    const updated: Entry = {
      ...entries[index],
      content: input.content.trim(),
      updatedAt: this.now().toISOString(),
    };

    entries[index] = updated;
    this.writeAll(entries);

    return updated;
  }

  async remove(id: string) {
    this.writeAll(this.readAll().filter((entry) => entry.id !== id));
  }

  async getById(id: string) {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async listByDate(date: string) {
    return this.readAll()
      .filter((entry) => entry.occurredOn === date)
      .sort(compareByOccurredAtDesc);
  }

  async listRange(startDate: string, endDate: string) {
    return this.readAll()
      .filter((entry) => entry.occurredOn >= startDate && entry.occurredOn <= endDate)
      .sort(compareByOccurredAtDesc);
  }

  async listByThread(threadId: string) {
    return this.readAll()
      .filter((entry) => entry.threadId === threadId)
      .sort(compareByOccurredAtAsc);
  }

  async listRecent(limit: number) {
    return this.readAll().sort(compareByOccurredAtDesc).slice(0, Math.max(0, limit));
  }

  async listAll() {
    return this.readAll().sort(compareByOccurredAtDesc);
  }

  async replaceAll(entries: Entry[]) {
    this.writeAll(entries.map(normalizeEntry).filter((entry): entry is Entry => entry !== null));
  }

  async setThread(id: string, threadId: string | null) {
    const entries = this.readAll();
    const index = entries.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return null;
    }

    const updated: Entry = {
      ...entries[index],
      threadId,
      updatedAt: this.now().toISOString(),
    };

    entries[index] = updated;
    this.writeAll(entries);

    return updated;
  }

  async search(keyword: string) {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return this.readAll()
      .filter((entry) => entry.content.toLowerCase().includes(normalized))
      .sort(compareByOccurredAtDesc);
  }

  async clearLocalData() {
    this.writeAll([]);
  }

  private readAll(): Entry[] {
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
        ? parsed.map(normalizeEntry).filter((entry): entry is Entry => entry !== null)
        : [];
    } catch {
      return [];
    }
  }

  private writeAll(entries: Entry[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

type EntryRow = {
  id: string;
  content: string;
  occurred_at: string;
  occurred_on: string;
  thread_id: string | null;
  difficulty: number | null;
  effort: string | null;
  created_at: string;
  updated_at: string;
};

function mapRowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    content: row.content,
    occurredAt: row.occurred_at,
    occurredOn: row.occurred_on,
    threadId: row.thread_id,
    difficulty: row.difficulty,
    effort: row.effort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLikePattern(keyword: string) {
  return keyword.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class SQLiteEntryRepository implements EntryRepository {
  private now: Clock;
  private databasePromise: Promise<DatabaseClient> | null;

  constructor(database?: Promise<DatabaseClient>, options: RepositoryOptions = {}) {
    this.databasePromise = database ?? null;
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async create(input: CreateEntryInput) {
    const entry = buildEntry(input, this.now);

    await this.write((database) => insertEntryRow(database, entry));

    return entry;
  }

  async update(id: string, input: UpdateEntryInput) {
    const existing = await this.getById(id);

    if (!existing) {
      return null;
    }

    const updated: Entry = {
      ...existing,
      content: input.content.trim(),
      updatedAt: this.now().toISOString(),
    };

    await this.write((database) =>
      database.execute('UPDATE entries SET content = $1, updated_at = $2 WHERE id = $3', [
        updated.content,
        updated.updatedAt,
        updated.id,
      ]),
    );

    return updated;
  }

  async remove(id: string) {
    await this.write((database) =>
      database.execute('DELETE FROM entries WHERE id = $1', [id]),
    );
  }

  async getById(id: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries WHERE id = $1 LIMIT 1',
        [id],
      );

      return rows[0] ? mapRowToEntry(rows[0]) : null;
    }, null);
  }

  async listByDate(date: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries WHERE occurred_on = $1 ORDER BY occurred_at DESC, created_at DESC, id DESC',
        [date],
      );

      return rows.map(mapRowToEntry);
    }, []);
  }

  async listRange(startDate: string, endDate: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries WHERE occurred_on >= $1 AND occurred_on <= $2 ORDER BY occurred_at DESC, created_at DESC, id DESC',
        [startDate, endDate],
      );

      return rows.map(mapRowToEntry);
    }, []);
  }

  async listByThread(threadId: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries WHERE thread_id = $1 ORDER BY occurred_at ASC, created_at ASC, id ASC',
        [threadId],
      );

      return rows.map(mapRowToEntry);
    }, []);
  }

  async listRecent(limit: number) {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries ORDER BY occurred_at DESC, created_at DESC, id DESC LIMIT $1',
        [Math.max(0, limit)],
      );

      return rows.map(mapRowToEntry);
    }, []);
  }

  async listAll() {
    return this.safeRead(async (database) => {
      const rows = await database.select<EntryRow[]>(
        'SELECT * FROM entries ORDER BY occurred_at DESC, created_at DESC, id DESC',
      );

      return rows.map(mapRowToEntry);
    }, []);
  }

  async replaceAll(entries: Entry[]) {
    await this.write(async (database) => {
      await database.execute('DELETE FROM entries');

      for (const entry of entries) {
        const normalizedEntry = normalizeEntry(entry);

        if (normalizedEntry) {
          await insertEntryRow(database, normalizedEntry);
        }
      }
    });
  }

  async setThread(id: string, threadId: string | null) {
    const existing = await this.getById(id);

    if (!existing) {
      return null;
    }

    const updated: Entry = {
      ...existing,
      threadId,
      updatedAt: this.now().toISOString(),
    };

    await this.write((database) =>
      database.execute('UPDATE entries SET thread_id = $1, updated_at = $2 WHERE id = $3', [
        updated.threadId,
        updated.updatedAt,
        updated.id,
      ]),
    );

    return updated;
  }

  async search(keyword: string) {
    const normalized = keyword.trim();

    if (!normalized) {
      return [];
    }

    return this.safeRead(async (database) => {
      // The trigram tokenizer only indexes runs of 3+ characters, so a 1–2
      // character query — common for CJK words like 登录/订单 — matches nothing
      // in FTS and returns an empty set WITHOUT throwing, so the catch-based
      // fallback below would never fire. Route short queries straight to LIKE.
      if ([...normalized].length < 3) {
        return this.searchByLike(database, normalized);
      }

      try {
        const ftsQuery = `"${normalized.replace(/"/g, '""')}"`;
        const rows = await database.select<EntryRow[]>(
          `SELECT e.* FROM entries e JOIN entries_fts f ON f.rowid = e.rowid
           WHERE entries_fts MATCH $1 ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC`,
          [ftsQuery],
        );

        return rows.map(mapRowToEntry);
      } catch (error) {
        // FTS may be unavailable (no trigram tokenizer) or reject short/odd
        // queries; LIKE keeps search correct, just slower.
        logger.warn('sqlite', 'entry.search_fts_fallback', 'Entry FTS search failed; falling back to LIKE', {
          table: 'entries_fts',
          error,
        });

        return this.searchByLike(database, normalized);
      }
    }, []);
  }

  private async searchByLike(database: DatabaseClient, normalized: string) {
    const rows = await database.select<EntryRow[]>(
      `SELECT * FROM entries WHERE content LIKE $1 ESCAPE '\\' ORDER BY occurred_at DESC, created_at DESC, id DESC`,
      [`%${escapeLikePattern(normalized)}%`],
    );

    return rows.map(mapRowToEntry);
  }

  async clearLocalData() {
    await this.write((database) => database.execute('DELETE FROM entries'));
  }

  private async safeRead<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      logger.error('sqlite', 'entry.read_failed', 'Failed to read entries from SQLite', {
        operation: 'select',
        table: 'entries',
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
      logger.error('sqlite', 'entry.write_failed', 'Failed to write entry to SQLite', {
        operation: 'write',
        table: 'entries',
        error,
      });
      throw createFriendlyError('记录保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

async function insertEntryRow(database: DatabaseClient, entry: Entry) {
  await database.execute(
    `INSERT INTO entries (id, content, occurred_at, occurred_on, thread_id, difficulty, effort, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.id,
      entry.content,
      entry.occurredAt,
      entry.occurredOn,
      entry.threadId,
      entry.difficulty,
      entry.effort,
      entry.createdAt,
      entry.updatedAt,
    ],
  );
}

function normalizeEntry(value: unknown): Entry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.content !== 'string' ||
    typeof candidate.occurredAt !== 'string' ||
    typeof candidate.occurredOn !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    content: candidate.content,
    occurredAt: candidate.occurredAt,
    occurredOn: candidate.occurredOn,
    threadId: typeof candidate.threadId === 'string' ? candidate.threadId : null,
    difficulty: typeof candidate.difficulty === 'number' ? candidate.difficulty : null,
    effort: typeof candidate.effort === 'string' ? candidate.effort : null,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : candidate.occurredAt,
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : typeof candidate.createdAt === 'string'
          ? candidate.createdAt
          : candidate.occurredAt,
  };
}

export const entryRepository: EntryRepository = new SQLiteEntryRepository();
