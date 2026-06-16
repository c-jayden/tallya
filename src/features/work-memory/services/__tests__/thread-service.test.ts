import { describe, expect, it } from 'vitest';
import { createThreadService } from '../thread-service';
import type {
  CreateThreadInput,
  Entry,
  Thread,
  UpdateThreadInput,
} from '../../types';

function buildEntry(overrides: Partial<Entry> & Pick<Entry, 'id' | 'occurredOn'>): Entry {
  return {
    content: overrides.content ?? overrides.id,
    occurredAt: overrides.occurredAt ?? `${overrides.occurredOn}T03:00:00.000Z`,
    threadId: overrides.threadId ?? null,
    difficulty: null,
    effort: null,
    createdAt: overrides.createdAt ?? `${overrides.occurredOn}T03:00:00.000Z`,
    updatedAt: overrides.updatedAt ?? `${overrides.occurredOn}T03:00:00.000Z`,
    ...overrides,
  };
}

function buildThread(id: string, title: string): Thread {
  return {
    id,
    title,
    status: 'open',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
  };
}

function createFakeThreadRepository(initial: Thread[] = []) {
  const threads = new Map(initial.map((thread) => [thread.id, thread]));
  let counter = 0;

  return {
    store: threads,
    updateCalls: [] as string[],
    async create(input: CreateThreadInput): Promise<Thread> {
      const thread = buildThread(`thread_${++counter}`, input.title);
      threads.set(thread.id, thread);
      return thread;
    },
    async getById(id: string) {
      return threads.get(id) ?? null;
    },
    async list() {
      return Array.from(threads.values());
    },
    async update(id: string, input: UpdateThreadInput) {
      void input;
      this.updateCalls.push(id);
      return threads.get(id) ?? null;
    },
  };
}

function createFakeEntryRepository(initial: Entry[] = []) {
  const entries = new Map(initial.map((entry) => [entry.id, entry]));

  return {
    store: entries,
    async listByThread(threadId: string) {
      return Array.from(entries.values())
        .filter((entry) => entry.threadId === threadId)
        .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt));
    },
    async setThread(id: string, threadId: string | null) {
      const existing = entries.get(id);
      if (!existing) {
        return null;
      }
      const updated = { ...existing, threadId };
      entries.set(id, updated);
      return updated;
    },
  };
}

describe('threadService', () => {
  it('summarizes threads with entry count and day span, dropping empty threads', async () => {
    const threadRepository = createFakeThreadRepository([
      buildThread('thread_1', '订单接口'),
      buildThread('thread_2', '空线索'),
    ]);
    const entryRepository = createFakeEntryRepository([
      buildEntry({ id: 'e1', occurredOn: '2026-06-08', threadId: 'thread_1' }),
      buildEntry({ id: 'e2', occurredOn: '2026-06-10', threadId: 'thread_1' }),
    ]);
    const service = createThreadService({ threadRepository, entryRepository });

    const summaries = await service.listThreadSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'thread_1',
      entryCount: 2,
      firstOccurredOn: '2026-06-08',
      lastOccurredOn: '2026-06-10',
      lastEntryId: 'e2',
    });
  });

  it('creates a thread from entries and assigns each entry to it', async () => {
    const threadRepository = createFakeThreadRepository();
    const entryRepository = createFakeEntryRepository([
      buildEntry({ id: 'e1', occurredOn: '2026-06-08' }),
      buildEntry({ id: 'e2', occurredOn: '2026-06-10' }),
    ]);
    const service = createThreadService({ threadRepository, entryRepository });

    const thread = await service.createThreadFromEntries('订单接口', ['e1', 'e2']);

    expect(entryRepository.store.get('e1')?.threadId).toBe(thread.id);
    expect(entryRepository.store.get('e2')?.threadId).toBe(thread.id);
  });

  it('joins an entry to an existing thread and bumps the thread', async () => {
    const threadRepository = createFakeThreadRepository([buildThread('thread_1', '订单接口')]);
    const entryRepository = createFakeEntryRepository([
      buildEntry({ id: 'e1', occurredOn: '2026-06-08', threadId: 'thread_1' }),
      buildEntry({ id: 'e2', occurredOn: '2026-06-10' }),
    ]);
    const service = createThreadService({ threadRepository, entryRepository });

    await service.addEntryToThread('thread_1', 'e2');

    expect(entryRepository.store.get('e2')?.threadId).toBe('thread_1');
    expect(threadRepository.updateCalls).toContain('thread_1');
  });
});
