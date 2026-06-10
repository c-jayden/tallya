import { describe, expect, it } from 'vitest';
import { createMemorySearch } from '../memory-search-service';
import { LocalStorageEntryRepository } from '../entry-repository';
import { LocalStorageClarificationRepository } from '../clarification-repository';

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

async function setup() {
  const entryRepository = new LocalStorageEntryRepository(new MemoryStorage(), {
    now: () => new Date('2026-06-10T09:00:00+08:00'),
  });
  const clarificationRepository = new LocalStorageClarificationRepository(new MemoryStorage(), {
    now: () => new Date('2026-06-10T09:00:00+08:00'),
  });

  const orderEntry = await entryRepository.create({
    content: '对接订单接口',
    occurredAt: '2026-06-10T03:00:00.000Z',
  });
  const meetingEntry = await entryRepository.create({
    content: '开会讨论订单结算',
    occurredAt: '2026-06-10T01:00:00.000Z',
  });

  // A clarification of the order entry also mentions 订单 (to exercise dedup),
  // and a clarification of the meeting entry holds 字段映射 only in the answer.
  await clarificationRepository.create({
    entryId: orderEntry.id,
    question: '产出？',
    answer: '订单创建联通了',
  });
  await clarificationRepository.create({
    entryId: meetingEntry.id,
    question: '难点？',
    answer: '字段映射对不上',
  });

  const search = createMemorySearch({ entryRepository, clarificationRepository });

  return { search, orderEntry, meetingEntry };
}

describe('memory search service', () => {
  it('returns content matches, newest first, de-duplicated', async () => {
    const { search, orderEntry, meetingEntry } = await setup();

    const results = await search.searchEntries('订单');

    expect(results.map((entry) => entry.id)).toEqual([orderEntry.id, meetingEntry.id]);
    expect(new Set(results.map((entry) => entry.id)).size).toBe(results.length);
  });

  it('surfaces the parent entry when only a clarification matches', async () => {
    const { search, meetingEntry } = await setup();

    const results = await search.searchEntries('字段映射');

    expect(results.map((entry) => entry.id)).toEqual([meetingEntry.id]);
  });

  it('returns nothing for blank keywords', async () => {
    const { search } = await setup();

    expect(await search.searchEntries('   ')).toEqual([]);
  });
});
