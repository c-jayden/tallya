import { describe, expect, it } from 'vitest';
import {
  LocalStorageClarificationRepository,
  SQLiteClarificationRepository,
} from '../clarification-repository';
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
  return new LocalStorageClarificationRepository(new MemoryStorage(), { now });
}

describe('LocalStorageClarificationRepository', () => {
  it('stores an AI-asked clarification with its question and trims the answer', async () => {
    const repository = createLocalRepository();

    const clarification = await repository.create({
      entryId: 'entry_1',
      question: '难点在哪？',
      answer: '  字段映射对不上  ',
    });

    expect(clarification).toMatchObject({
      entryId: 'entry_1',
      question: '难点在哪？',
      answer: '字段映射对不上',
    });
    expect(clarification.id).toMatch(/^clar_/);
  });

  it('treats a blank question as a manual clarification (null question)', async () => {
    const repository = createLocalRepository();

    const clarification = await repository.create({
      entryId: 'entry_1',
      question: '   ',
      answer: '联调了两个小时',
    });

    expect(clarification.question).toBeNull();
  });

  it('lists clarifications by entry and by a set of entry ids, oldest first', async () => {
    const repository = createLocalRepository();

    await repository.create({ entryId: 'entry_1', answer: 'first' });
    await repository.create({ entryId: 'entry_2', answer: 'second' });
    await repository.create({ entryId: 'entry_1', answer: 'third' });

    expect((await repository.listByEntry('entry_1')).map((item) => item.answer)).toEqual([
      'first',
      'third',
    ]);
    expect((await repository.listByEntryIds(['entry_1', 'entry_2'])).map((item) => item.answer)).toEqual(
      ['first', 'second', 'third'],
    );
  });

  it('updates, removes, and cascades removal by entry', async () => {
    const repository = createLocalRepository();
    const keep = await repository.create({ entryId: 'entry_2', answer: 'keep' });
    const target = await repository.create({ entryId: 'entry_1', answer: 'draft' });

    await repository.update(target.id, 'final');
    expect((await repository.listByEntry('entry_1'))[0]?.answer).toBe('final');

    await repository.removeByEntry('entry_1');
    expect(await repository.listByEntry('entry_1')).toEqual([]);
    expect((await repository.listByEntry('entry_2'))[0]?.id).toBe(keep.id);
  });

  it('searches answers and questions case-insensitively', async () => {
    const repository = createLocalRepository();

    await repository.create({ entryId: 'e1', question: '难点？', answer: '字段映射' });
    await repository.create({ entryId: 'e2', answer: '无关内容' });

    expect((await repository.search('映射')).map((item) => item.entryId)).toEqual(['e1']);
    expect((await repository.search('难点')).map((item) => item.entryId)).toEqual(['e1']);
    expect(await repository.search('  ')).toEqual([]);
  });

  it('lists and replaces all clarifications for backup restore', async () => {
    const repository = createLocalRepository();
    const oldClarification = await repository.create({ entryId: 'entry_old', answer: 'old' });
    const restoredClarification = {
      ...oldClarification,
      id: 'clar_restored',
      entryId: 'entry_restored',
      question: '补充？',
      answer: 'restored',
    };

    await repository.replaceAll([restoredClarification]);

    await expect(repository.listAll()).resolves.toEqual([restoredClarification]);
    await expect(repository.listByEntry('entry_old')).resolves.toEqual([]);
  });
});

describe('SQLiteClarificationRepository', () => {
  function createSqliteRepository() {
    const database = new TestDatabaseClient();
    const repository = new SQLiteClarificationRepository(Promise.resolve(database), {
      now: () => new Date('2026-06-10T09:00:00+08:00'),
    });

    return { database, repository };
  }

  it('persists and reads clarifications through SQL', async () => {
    const { repository } = createSqliteRepository();

    const created = await repository.create({
      entryId: 'entry_1',
      question: '卡了多久？',
      answer: '两个小时',
    });

    const byEntry = await repository.listByEntry('entry_1');
    expect(byEntry).toHaveLength(1);
    expect(byEntry[0]).toMatchObject({ question: '卡了多久？', answer: '两个小时' });

    await repository.update(created.id, '其实是一上午');
    expect((await repository.listByEntry('entry_1'))[0]?.answer).toBe('其实是一上午');

    await repository.removeByEntry('entry_1');
    expect(await repository.listByEntry('entry_1')).toEqual([]);
  });

  it('searches clarifications and supports multi-entry lookup', async () => {
    const { repository } = createSqliteRepository();

    await repository.create({ entryId: 'e1', answer: '字段映射对不上' });
    await repository.create({ entryId: 'e2', answer: '无关内容' });

    expect((await repository.search('映射')).map((item) => item.entryId)).toEqual(['e1']);
    expect((await repository.listByEntryIds(['e1', 'e2'])).map((item) => item.entryId)).toEqual([
      'e1',
      'e2',
    ]);
    expect(await repository.listByEntryIds([])).toEqual([]);
  });

  it('lists and replaces all clarifications through SQL for backup restore', async () => {
    const { repository } = createSqliteRepository();
    const oldClarification = await repository.create({ entryId: 'entry_old', answer: 'old' });
    const restoredClarification = {
      ...oldClarification,
      id: 'clar_restored',
      entryId: 'entry_restored',
      question: '补充？',
      answer: 'restored',
    };

    await repository.replaceAll([restoredClarification]);

    await expect(repository.listAll()).resolves.toEqual([restoredClarification]);
    await expect(repository.listByEntry('entry_old')).resolves.toEqual([]);
  });
});
