import { describe, expect, it } from 'vitest';
import {
  LocalStorageEntryRepository,
  SQLiteEntryRepository,
  getEntryDate,
} from '../entry-repository';
import { TestDatabaseClient } from '../database/test-database';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function createLocalRepository(now = () => new Date('2026-06-10T09:00:00+08:00')) {
  return new LocalStorageEntryRepository(new MemoryStorage(), { now });
}

describe('LocalStorageEntryRepository', () => {
  it('captures a structureless entry with derived date and null reserved fields', async () => {
    const repository = createLocalRepository();

    const entry = await repository.create({ content: '  对接订单接口  ' });

    expect(entry).toMatchObject({
      content: '对接订单接口',
      occurredOn: '2026-06-10',
      threadId: null,
      difficulty: null,
      effort: null,
    });
    expect(entry.id).toMatch(/^entry_/);
    expect(entry.occurredAt).toBe('2026-06-10T01:00:00.000Z');
  });

  it('lists a day\'s entries newest first', async () => {
    const repository = createLocalRepository();

    await repository.create({ content: 'first', occurredAt: '2026-06-10T01:00:00.000Z' });
    await repository.create({ content: 'second', occurredAt: '2026-06-10T05:00:00.000Z' });
    await repository.create({ content: 'other day', occurredAt: '2026-06-09T05:00:00.000Z' });

    const todayEntries = await repository.listByDate('2026-06-10');

    expect(todayEntries.map((entry) => entry.content)).toEqual(['second', 'first']);
  });

  it('updates and removes entries', async () => {
    const repository = createLocalRepository();
    const entry = await repository.create({ content: 'draft note' });

    const updated = await repository.update(entry.id, { content: 'final note' });
    expect(updated?.content).toBe('final note');

    await repository.remove(entry.id);
    expect(await repository.getById(entry.id)).toBeNull();
  });

  it('searches by case-insensitive substring across days, newest first', async () => {
    const repository = createLocalRepository();

    await repository.create({ content: '对接订单接口', occurredAt: '2026-06-08T03:00:00.000Z' });
    await repository.create({ content: '开会讨论订单结算', occurredAt: '2026-06-10T03:00:00.000Z' });
    await repository.create({ content: '无关的事', occurredAt: '2026-06-09T03:00:00.000Z' });

    const results = await repository.search('订单');

    expect(results.map((entry) => entry.content)).toEqual(['开会讨论订单结算', '对接订单接口']);
  });

  it('returns nothing for empty search keywords', async () => {
    const repository = createLocalRepository();
    await repository.create({ content: 'something' });

    expect(await repository.search('   ')).toEqual([]);
  });

  it('filters by date range', async () => {
    const repository = createLocalRepository();

    await repository.create({ content: 'in range', occurredAt: '2026-06-09T03:00:00.000Z' });
    await repository.create({ content: 'out of range', occurredAt: '2026-06-01T03:00:00.000Z' });

    const results = await repository.listRange('2026-06-08', '2026-06-10');

    expect(results.map((entry) => entry.content)).toEqual(['in range']);
  });
});

describe('SQLiteEntryRepository', () => {
  function createSqliteRepository() {
    const database = new TestDatabaseClient();
    const repository = new SQLiteEntryRepository(Promise.resolve(database), {
      now: () => new Date('2026-06-10T09:00:00+08:00'),
    });

    return { database, repository };
  }

  it('persists, reads, updates and deletes entries through SQL', async () => {
    const { repository } = createSqliteRepository();

    const entry = await repository.create({ content: '对接订单接口' });
    expect(await repository.getById(entry.id)).toMatchObject({ content: '对接订单接口' });

    await repository.update(entry.id, { content: '完成订单接口联调' });
    expect((await repository.getById(entry.id))?.content).toBe('完成订单接口联调');

    const today = await repository.listByDate('2026-06-10');
    expect(today).toHaveLength(1);

    await repository.remove(entry.id);
    expect(await repository.getById(entry.id)).toBeNull();
  });

  it('searches entries through the FTS path', async () => {
    const { repository } = createSqliteRepository();

    await repository.create({ content: '对接订单接口', occurredAt: '2026-06-08T03:00:00.000Z' });
    await repository.create({ content: '开会讨论订单结算', occurredAt: '2026-06-10T03:00:00.000Z' });
    await repository.create({ content: '无关的事', occurredAt: '2026-06-09T03:00:00.000Z' });

    const results = await repository.search('订单');

    expect(results.map((entry) => entry.content)).toEqual(['开会讨论订单结算', '对接订单接口']);
  });
});

describe('getEntryDate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(getEntryDate(new Date('2026-06-10T23:00:00+08:00'))).toBe('2026-06-10');
  });
});
