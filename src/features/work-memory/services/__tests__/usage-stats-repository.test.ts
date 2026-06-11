import { describe, expect, it } from 'vitest';
import { UsageStatsRepository } from '../usage-stats-repository';

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

describe('UsageStatsRepository', () => {
  it('sets firstUseDate on the first recorded event and counts entries per day', () => {
    const storage = new MemoryStorage();
    const repo = new UsageStatsRepository(storage, { now: () => new Date('2026-06-10T09:00:00+08:00') });

    repo.recordEntryCreated();
    repo.recordEntryCreated();

    const summary = repo.getSummary();

    expect(summary.firstUseDate).toBe('2026-06-10');
    expect(summary.totalEntries).toBe(2);
    expect(summary.activeDays).toBe(1);
    expect(summary.totalDays).toBe(1);
  });

  it('computes search hit rate across sessions', () => {
    const repo = new UsageStatsRepository(new MemoryStorage(), {
      now: () => new Date('2026-06-10T09:00:00+08:00'),
    });

    repo.recordSearchSession(true);
    repo.recordSearchSession(false);
    repo.recordSearchSession(true);

    expect(repo.getSummary().searchHitRate).toBeCloseTo(2 / 3, 5);
    expect(repo.getSummary().recentSearchSessions).toBe(3);
  });

  it('returns a null hit rate when no search has run', () => {
    const repo = new UsageStatsRepository(new MemoryStorage(), {
      now: () => new Date('2026-06-10T09:00:00+08:00'),
    });

    expect(repo.getSummary().searchHitRate).toBeNull();
    expect(repo.getSummary().firstUseDate).toBeNull();
  });

  it('only counts the last 7 days for recent windows but all-time for totals', () => {
    const storage = new MemoryStorage();
    const now = { value: new Date('2026-06-01T09:00:00+08:00') };
    const repo = new UsageStatsRepository(storage, { now: () => now.value });

    repo.recordSearchSession(true);
    repo.recordRetrieval();

    // Jump 10 days forward, same storage.
    now.value = new Date('2026-06-11T09:00:00+08:00');
    repo.recordEntryCreated();

    const summary = repo.getSummary();

    expect(summary.firstUseDate).toBe('2026-06-01');
    expect(summary.totalDays).toBe(11);
    expect(summary.activeDays).toBe(1); // only 06-11 had an entry
    expect(summary.recentSearchSessions).toBe(0); // 06-01 search is outside the 7-day window
    expect(summary.recentRetrievals).toBe(0);
  });

  it('persists across repository instances sharing storage', () => {
    const storage = new MemoryStorage();
    const first = new UsageStatsRepository(storage, { now: () => new Date('2026-06-10T09:00:00+08:00') });

    first.recordEntryCreated();

    const second = new UsageStatsRepository(storage, { now: () => new Date('2026-06-10T10:00:00+08:00') });

    expect(second.getSummary().totalEntries).toBe(1);
  });
});
