import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_STALLED_REVIEW_STATE,
  LocalStorageStalledReviewRepository,
} from '../stalled-review-repository';

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

  raw(key: string) {
    return this.store.get(key) ?? null;
  }
}

describe('LocalStorageStalledReviewRepository', () => {
  let storage: MemoryStorage;
  let repository: LocalStorageStalledReviewRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repository = new LocalStorageStalledReviewRepository(storage as unknown as Storage);
  });

  it('returns empty state when nothing is stored', async () => {
    await expect(repository.getState()).resolves.toEqual(EMPTY_STALLED_REVIEW_STATE);
  });

  it('round-trips a saved state', async () => {
    const saved = await repository.saveState({
      lastCheckedDate: '2026-06-15',
      shownByThread: { t1: '2026-06-15' },
    });

    expect(saved).toEqual({ lastCheckedDate: '2026-06-15', shownByThread: { t1: '2026-06-15' } });
    await expect(repository.getState()).resolves.toEqual(saved);
  });

  it('drops malformed dates when normalizing', async () => {
    await repository.saveState({
      lastCheckedDate: 'not-a-date',
      shownByThread: { good: '2026-06-15', bad: 'nope' },
    });

    await expect(repository.getState()).resolves.toEqual({
      lastCheckedDate: '',
      shownByThread: { good: '2026-06-15' },
    });
  });

  it('falls back to empty state on corrupt JSON', async () => {
    storage.setItem('tallya.stalled-review.v1', '{not json');

    await expect(repository.getState()).resolves.toEqual(EMPTY_STALLED_REVIEW_STATE);
  });
});
