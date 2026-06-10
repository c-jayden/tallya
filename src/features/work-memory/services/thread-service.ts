import type { CreateThreadInput, Entry, Thread, ThreadSummary, UpdateThreadInput } from '../types';
import { entryRepository as defaultEntryRepository } from './entry-repository';
import { threadRepository as defaultThreadRepository } from './thread-repository';

type EntryThreadRepository = {
  listByThread(threadId: string): Promise<Entry[]>;
  setThread(id: string, threadId: string | null): Promise<Entry | null>;
};

type ThreadStoreRepository = {
  create(input: CreateThreadInput): Promise<Thread>;
  getById(id: string): Promise<Thread | null>;
  list(): Promise<Thread[]>;
  update(id: string, input: UpdateThreadInput): Promise<Thread | null>;
};

type ThreadServiceOptions = {
  threadRepository?: ThreadStoreRepository;
  entryRepository?: EntryThreadRepository;
};

export type ThreadStoryline = {
  thread: Thread;
  entries: Entry[];
};

export function createThreadService({
  threadRepository = defaultThreadRepository,
  entryRepository = defaultEntryRepository,
}: ThreadServiceOptions = {}) {
  return {
    // Each thread row carries its entry count and day span so the browser can
    // render without loading entries. Empty threads (every entry removed) are
    // dropped: a thread with nothing in it is noise, not a storyline.
    async listThreadSummaries(): Promise<ThreadSummary[]> {
      const threads = await threadRepository.list();
      const summaries = await Promise.all(
        threads.map(async (thread) => {
          const entries = await entryRepository.listByThread(thread.id);

          if (entries.length === 0) {
            return null;
          }

          // listByThread returns entries in chronological order, so the span is
          // the first and last entry.
          return {
            ...thread,
            entryCount: entries.length,
            firstOccurredOn: entries[0].occurredOn,
            lastOccurredOn: entries[entries.length - 1].occurredOn,
          } satisfies ThreadSummary;
        }),
      );

      return summaries.filter((summary): summary is ThreadSummary => summary !== null);
    },

    async getStoryline(threadId: string): Promise<ThreadStoryline | null> {
      const thread = await threadRepository.getById(threadId);

      if (!thread) {
        return null;
      }

      const entries = await entryRepository.listByThread(threadId);

      return { thread, entries };
    },

    async createThreadFromEntries(title: string, entryIds: string[]): Promise<Thread> {
      const thread = await threadRepository.create({ title });

      for (const entryId of entryIds) {
        await entryRepository.setThread(entryId, thread.id);
      }

      return thread;
    },

    // Joining an existing storyline bumps the thread's updatedAt so it floats to
    // the top of the browser, mirroring "most recently touched first".
    async addEntryToThread(threadId: string, entryId: string): Promise<void> {
      await entryRepository.setThread(entryId, threadId);
      await threadRepository.update(threadId, {});
    },
  };
}

export const threadService = createThreadService();
