import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageThreadSuggestionRepository } from '../thread-suggestion-repository';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe('LocalStorageThreadSuggestionRepository', () => {
  let storage: MemoryStorage;
  let repository: LocalStorageThreadSuggestionRepository;
  let clock: number;

  beforeEach(() => {
    storage = new MemoryStorage();
    clock = Date.parse('2026-06-15T08:00:00.000Z');
    repository = new LocalStorageThreadSuggestionRepository(storage as unknown as Storage, {
      now: () => new Date(clock),
    });
  });

  it('upserts and reads back a suggestion', async () => {
    const saved = await repository.upsert({
      entryId: 'e2',
      relatedEntryId: 'e1',
      proposedThreadTitle: '  支付重构  ',
      existingThreadId: null,
    });

    expect(saved).toMatchObject({
      entryId: 'e2',
      relatedEntryId: 'e1',
      proposedThreadTitle: '支付重构',
      existingThreadId: null,
    });
    await expect(repository.getByEntryId('e2')).resolves.toMatchObject({ entryId: 'e2' });
    await expect(repository.listAll()).resolves.toHaveLength(1);
  });

  it('keeps one suggestion per entry and preserves the original createdAt on re-upsert', async () => {
    const first = await repository.upsert({
      entryId: 'e2',
      relatedEntryId: 'e1',
      proposedThreadTitle: '支付重构',
    });

    clock = Date.parse('2026-06-18T08:00:00.000Z');
    const second = await repository.upsert({
      entryId: 'e2',
      relatedEntryId: 'e1',
      proposedThreadTitle: '支付重构联调',
      existingThreadId: 'thread_pay',
    });

    const all = await repository.listAll();

    expect(all).toHaveLength(1);
    expect(second.proposedThreadTitle).toBe('支付重构联调');
    expect(second.existingThreadId).toBe('thread_pay');
    // Soft-expiry clock is not reset by re-analysis.
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it('removes by single id and by id list', async () => {
    await repository.upsert({ entryId: 'e1', relatedEntryId: 'e0', proposedThreadTitle: 'A' });
    await repository.upsert({ entryId: 'e2', relatedEntryId: 'e0', proposedThreadTitle: 'B' });
    await repository.upsert({ entryId: 'e3', relatedEntryId: 'e0', proposedThreadTitle: 'C' });

    await repository.remove('e1');
    await repository.removeByEntryIds(['e3', 'missing']);

    const all = await repository.listAll();
    expect(all.map((item) => item.entryId)).toEqual(['e2']);
  });

  it('clears all suggestions', async () => {
    await repository.upsert({ entryId: 'e1', relatedEntryId: 'e0', proposedThreadTitle: 'A' });
    await repository.clearLocalData();

    await expect(repository.listAll()).resolves.toEqual([]);
  });
});
