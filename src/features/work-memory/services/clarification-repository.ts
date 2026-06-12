import type { Clarification, CreateClarificationInput } from '../types';
import type { DatabaseClient } from './database/database';
import { getDatabase } from './database/database';
import { logger } from './logger/logger';
import { createFriendlyError } from './service-error';

const STORAGE_KEY = 'tallya.entry-clarifications.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

export type ClarificationRepository = {
  create(input: CreateClarificationInput): Promise<Clarification>;
  listByEntry(entryId: string): Promise<Clarification[]>;
  listByEntryIds(entryIds: string[]): Promise<Clarification[]>;
  listAll(): Promise<Clarification[]>;
  replaceAll(clarifications: Clarification[]): Promise<void>;
  update(id: string, answer: string): Promise<Clarification | null>;
  remove(id: string): Promise<void>;
  removeByEntry(entryId: string): Promise<void>;
  search(keyword: string): Promise<Clarification[]>;
  clearLocalData(): Promise<void>;
};

function buildClarificationId(): string {
  return `clar_${crypto.randomUUID()}`;
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function normalizeQuestion(question: string | null | undefined): string | null {
  const trimmed = question?.trim();

  return trimmed ? trimmed : null;
}

function compareByCreatedAtAsc(first: Clarification, second: Clarification) {
  // No id tiebreaker: ids are random, so equal timestamps must keep insertion
  // order via the stable sort (matches the SQL `ORDER BY created_at, rowid`).
  return first.createdAt.localeCompare(second.createdAt);
}

function buildClarification(input: CreateClarificationInput, now: Clock): Clarification {
  const timestamp = now().toISOString();

  return {
    id: buildClarificationId(),
    entryId: input.entryId,
    question: normalizeQuestion(input.question),
    answer: input.answer.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class LocalStorageClarificationRepository implements ClarificationRepository {
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

  async create(input: CreateClarificationInput) {
    const clarification = buildClarification(input, this.now);
    const items = this.readAll();

    items.push(clarification);
    this.writeAll(items);

    return clarification;
  }

  async listByEntry(entryId: string) {
    return this.readAll()
      .filter((item) => item.entryId === entryId)
      .sort(compareByCreatedAtAsc);
  }

  async listByEntryIds(entryIds: string[]) {
    const ids = new Set(entryIds);

    return this.readAll()
      .filter((item) => ids.has(item.entryId))
      .sort(compareByCreatedAtAsc);
  }

  async listAll() {
    return this.readAll().sort(compareByCreatedAtAsc);
  }

  async replaceAll(clarifications: Clarification[]) {
    this.writeAll(
      clarifications
        .map(normalizeClarification)
        .filter((item): item is Clarification => item !== null),
    );
  }

  async update(id: string, answer: string) {
    const items = this.readAll();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated: Clarification = {
      ...items[index],
      answer: answer.trim(),
      updatedAt: this.now().toISOString(),
    };

    items[index] = updated;
    this.writeAll(items);

    return updated;
  }

  async remove(id: string) {
    this.writeAll(this.readAll().filter((item) => item.id !== id));
  }

  async removeByEntry(entryId: string) {
    this.writeAll(this.readAll().filter((item) => item.entryId !== entryId));
  }

  async search(keyword: string) {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return this.readAll().filter(
      (item) =>
        item.answer.toLowerCase().includes(normalized) ||
        (item.question?.toLowerCase().includes(normalized) ?? false),
    );
  }

  async clearLocalData() {
    this.writeAll([]);
  }

  private readAll(): Clarification[] {
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
        ? parsed.map(normalizeClarification).filter((item): item is Clarification => item !== null)
        : [];
    } catch {
      return [];
    }
  }

  private writeAll(items: Clarification[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

type ClarificationRow = {
  id: string;
  entry_id: string;
  question: string | null;
  answer: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ClarificationRow): Clarification {
  return {
    id: row.id,
    entryId: row.entry_id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLikePattern(keyword: string) {
  return keyword.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class SQLiteClarificationRepository implements ClarificationRepository {
  private now: Clock;
  private databasePromise: Promise<DatabaseClient> | null;

  constructor(database?: Promise<DatabaseClient>, options: RepositoryOptions = {}) {
    this.databasePromise = database ?? null;
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async create(input: CreateClarificationInput) {
    const clarification = buildClarification(input, this.now);

    await this.write((database) =>
      database.execute(
        `INSERT INTO entry_clarifications (id, entry_id, question, answer, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          clarification.id,
          clarification.entryId,
          clarification.question,
          clarification.answer,
          clarification.createdAt,
          clarification.updatedAt,
        ],
      ),
    );

    return clarification;
  }

  async listByEntry(entryId: string) {
    return this.safeRead(async (database) => {
      const rows = await database.select<ClarificationRow[]>(
        'SELECT * FROM entry_clarifications WHERE entry_id = $1 ORDER BY created_at ASC, rowid ASC',
        [entryId],
      );

      return rows.map(mapRow);
    }, []);
  }

  async listByEntryIds(entryIds: string[]) {
    if (entryIds.length === 0) {
      return [];
    }

    return this.safeRead(async (database) => {
      const placeholders = entryIds.map((_, index) => `$${index + 1}`).join(', ');
      const rows = await database.select<ClarificationRow[]>(
        `SELECT * FROM entry_clarifications WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC, rowid ASC`,
        entryIds,
      );

      return rows.map(mapRow);
    }, []);
  }

  async listAll() {
    return this.safeRead(async (database) => {
      const rows = await database.select<ClarificationRow[]>(
        'SELECT * FROM entry_clarifications ORDER BY created_at ASC, rowid ASC',
      );

      return rows.map(mapRow);
    }, []);
  }

  async replaceAll(clarifications: Clarification[]) {
    await this.write(async (database) => {
      await database.execute('DELETE FROM entry_clarifications');

      for (const clarification of clarifications) {
        const normalizedClarification = normalizeClarification(clarification);

        if (normalizedClarification) {
          await insertClarificationRow(database, normalizedClarification);
        }
      }
    });
  }

  async update(id: string, answer: string) {
    const trimmed = answer.trim();

    await this.write((database) =>
      database.execute(
        'UPDATE entry_clarifications SET answer = $1, updated_at = $2 WHERE id = $3',
        [trimmed, this.now().toISOString(), id],
      ),
    );

    return this.safeRead(async (database) => {
      const rows = await database.select<ClarificationRow[]>(
        'SELECT * FROM entry_clarifications WHERE id = $1 LIMIT 1',
        [id],
      );

      return rows[0] ? mapRow(rows[0]) : null;
    }, null);
  }

  async remove(id: string) {
    await this.write((database) =>
      database.execute('DELETE FROM entry_clarifications WHERE id = $1', [id]),
    );
  }

  async removeByEntry(entryId: string) {
    await this.write((database) =>
      database.execute('DELETE FROM entry_clarifications WHERE entry_id = $1', [entryId]),
    );
  }

  async search(keyword: string) {
    const normalized = keyword.trim();

    if (!normalized) {
      return [];
    }

    return this.safeRead(async (database) => {
      const pattern = `%${escapeLikePattern(normalized)}%`;
      const rows = await database.select<ClarificationRow[]>(
        `SELECT * FROM entry_clarifications WHERE answer LIKE $1 ESCAPE '\\' OR question LIKE $1 ESCAPE '\\' ORDER BY created_at DESC`,
        [pattern],
      );

      return rows.map(mapRow);
    }, []);
  }

  async clearLocalData() {
    await this.write((database) => database.execute('DELETE FROM entry_clarifications'));
  }

  private async safeRead<T>(operation: (database: DatabaseClient) => Promise<T>, fallback: T) {
    try {
      const database = await this.getReadyDatabase();

      return await operation(database);
    } catch (error) {
      logger.error('sqlite', 'clarification.read_failed', 'Failed to read clarifications from SQLite', {
        operation: 'select',
        table: 'entry_clarifications',
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
      logger.error('sqlite', 'clarification.write_failed', 'Failed to write clarification to SQLite', {
        operation: 'write',
        table: 'entry_clarifications',
        error,
      });
      throw createFriendlyError('补充保存失败，请稍后重试。', error);
    }
  }

  private async getReadyDatabase() {
    this.databasePromise ??= getDatabase();

    return this.databasePromise;
  }
}

function isClarificationLike(value: unknown): value is Clarification {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.entryId === 'string' &&
    typeof candidate.answer === 'string'
  );
}

function normalizeClarification(value: unknown): Clarification | null {
  if (!isClarificationLike(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return {
    id: value.id,
    entryId: value.entryId,
    question: typeof candidate.question === 'string' ? candidate.question : null,
    answer: value.answer,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString(),
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : typeof candidate.createdAt === 'string'
          ? candidate.createdAt
          : new Date(0).toISOString(),
  };
}

async function insertClarificationRow(database: DatabaseClient, clarification: Clarification) {
  await database.execute(
    `INSERT INTO entry_clarifications (id, entry_id, question, answer, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      clarification.id,
      clarification.entryId,
      clarification.question,
      clarification.answer,
      clarification.createdAt,
      clarification.updatedAt,
    ],
  );
}

export const clarificationRepository: ClarificationRepository = new SQLiteClarificationRepository();
