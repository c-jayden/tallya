import { describe, expect, it } from 'vitest';
import {
  LocalStorageThreadRepository,
  SQLiteThreadRepository,
} from '../thread-repository';
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

// updatedAt drives list ordering, so the clock advances each tick to give every
// write a distinct, increasing timestamp.
function createTickingClock(start = Date.parse('2026-06-10T09:00:00+08:00')) {
  let current = start;

  return () => new Date((current += 1000));
}

describe('LocalStorageThreadRepository', () => {
  function createRepository() {
    return new LocalStorageThreadRepository(new MemoryStorage(), { now: createTickingClock() });
  }

  it('creates a thread with a trimmed title and default open status', async () => {
    const repository = createRepository();

    const thread = await repository.create({ title: '  订单接口  ' });

    expect(thread).toMatchObject({ title: '订单接口', status: 'open' });
    expect(thread.id).toMatch(/^thread_/);
  });

  it('lists threads most-recently-updated first', async () => {
    const repository = createRepository();

    const first = await repository.create({ title: 'first' });
    await repository.create({ title: 'second' });
    // Touch the first thread so it floats back to the top.
    await repository.update(first.id, {});

    const threads = await repository.list();
    expect(threads.map((thread) => thread.title)).toEqual(['first', 'second']);
  });

  it('updates title and status, and removes threads', async () => {
    const repository = createRepository();
    const thread = await repository.create({ title: 'draft' });

    const updated = await repository.update(thread.id, { title: 'final', status: 'archived' });
    expect(updated).toMatchObject({ title: 'final', status: 'archived' });

    await repository.remove(thread.id);
    expect(await repository.getById(thread.id)).toBeNull();
  });

  it('lists and replaces all threads for backup restore', async () => {
    const repository = createRepository();
    const oldThread = await repository.create({ title: 'old thread' });
    const restoredThread = {
      ...oldThread,
      id: 'thread_restored',
      title: 'restored thread',
      status: 'archived' as const,
    };

    await repository.replaceAll([restoredThread]);

    await expect(repository.listAll()).resolves.toEqual([restoredThread]);
    await expect(repository.getById(oldThread.id)).resolves.toBeNull();
  });
});

describe('SQLiteThreadRepository', () => {
  function createRepository() {
    const database = new TestDatabaseClient();
    const repository = new SQLiteThreadRepository(Promise.resolve(database), {
      now: createTickingClock(),
    });

    return { database, repository };
  }

  it('persists, reads, updates and deletes threads through SQL', async () => {
    const { repository } = createRepository();

    const thread = await repository.create({ title: '订单接口' });
    expect(await repository.getById(thread.id)).toMatchObject({ title: '订单接口', status: 'open' });

    await repository.update(thread.id, { title: '订单结算', status: 'archived' });
    expect(await repository.getById(thread.id)).toMatchObject({
      title: '订单结算',
      status: 'archived',
    });

    await repository.remove(thread.id);
    expect(await repository.getById(thread.id)).toBeNull();
  });

  it('lists and replaces all threads through SQL for backup restore', async () => {
    const { repository } = createRepository();
    const oldThread = await repository.create({ title: 'old thread' });
    const restoredThread = {
      ...oldThread,
      id: 'thread_restored',
      title: 'restored thread',
      status: 'archived' as const,
    };

    await repository.replaceAll([restoredThread]);

    await expect(repository.listAll()).resolves.toEqual([restoredThread]);
    await expect(repository.getById(oldThread.id)).resolves.toBeNull();
  });
});
