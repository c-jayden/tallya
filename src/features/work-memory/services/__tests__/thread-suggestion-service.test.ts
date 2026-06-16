import { describe, expect, it, vi } from 'vitest';
import type { Entry, Thread, ThreadSuggestion } from '../../types';
import { createThreadSuggestionService } from '../thread-suggestion-service';

function buildEntry(id: string, content: string, threadId: string | null = null): Entry {
  return {
    id,
    content,
    occurredAt: '2026-06-11T03:00:00.000Z',
    occurredOn: '2026-06-11',
    threadId,
    difficulty: null,
    effort: null,
    createdAt: '2026-06-11T03:00:00.000Z',
    updatedAt: '2026-06-11T03:00:00.000Z',
  };
}

function buildThread(id: string, title: string): Thread {
  return {
    id,
    title,
    status: 'open',
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

function buildSuggestion(overrides: Partial<ThreadSuggestion> = {}): ThreadSuggestion {
  return {
    entryId: 'e2',
    relatedEntryId: 'e1',
    proposedThreadTitle: '支付重构',
    existingThreadId: null,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

function createDeps({
  suggestions = [] as ThreadSuggestion[],
  entries = [] as Entry[],
  threads = [] as Thread[],
} = {}) {
  const suggestionStore = new Map(suggestions.map((item) => [item.entryId, item]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  const suggestionRepository = {
    upsert: vi.fn(),
    getByEntryId: vi.fn(async (entryId: string) => suggestionStore.get(entryId) ?? null),
    listAll: vi.fn(async () => Array.from(suggestionStore.values())),
    remove: vi.fn(async (entryId: string) => {
      suggestionStore.delete(entryId);
    }),
    removeByEntryIds: vi.fn(async (entryIds: string[]) => {
      entryIds.forEach((id) => suggestionStore.delete(id));
    }),
    clearLocalData: vi.fn(),
  };
  const entryRepository = { getById: vi.fn(async (id: string) => entryById.get(id) ?? null) };
  const threadRepository = { list: vi.fn(async () => threads) };
  const threadService = {
    addEntryToThread: vi.fn(async () => undefined),
    createThreadFromEntries: vi.fn(async () => buildThread('thread_new', '支付重构')),
  };

  return { suggestionRepository, entryRepository, threadRepository, threadService, suggestionStore };
}

describe('threadSuggestionService.listPending', () => {
  it('returns valid suggestions enriched with entry and thread titles', async () => {
    const deps = createDeps({
      suggestions: [buildSuggestion({ existingThreadId: 'thread_pay' })],
      entries: [buildEntry('e2', '继续支付重构'), buildEntry('e1', '对接支付重构接口', 'thread_pay')],
      threads: [buildThread('thread_pay', '支付重构')],
    });
    const service = createThreadSuggestionService(deps);

    await expect(service.listPending('2026-06-16')).resolves.toEqual([
      {
        entryId: 'e2',
        entryContent: '继续支付重构',
        relatedEntryContent: '对接支付重构接口',
        proposedThreadTitle: '支付重构',
        existingThreadId: 'thread_pay',
        existingThreadTitle: '支付重构',
      },
    ]);
  });

  it('prunes suggestions whose entry is gone, already threaded, or whose match is gone', async () => {
    const deps = createDeps({
      suggestions: [
        buildSuggestion({ entryId: 'gone', relatedEntryId: 'e1' }),
        buildSuggestion({ entryId: 'threaded', relatedEntryId: 'e1' }),
        buildSuggestion({ entryId: 'e2', relatedEntryId: 'missing' }),
      ],
      entries: [buildEntry('threaded', '已归并', 'thread_x'), buildEntry('e2', '继续'), buildEntry('e1', '起点')],
    });
    const service = createThreadSuggestionService(deps);

    await expect(service.listPending()).resolves.toEqual([]);
    expect(deps.suggestionRepository.removeByEntryIds).toHaveBeenCalledWith([
      'gone',
      'threaded',
      'e2',
    ]);
  });

  it('drops the existing thread reference when that thread no longer exists', async () => {
    const deps = createDeps({
      suggestions: [buildSuggestion({ existingThreadId: 'thread_deleted' })],
      entries: [buildEntry('e2', '继续'), buildEntry('e1', '起点')],
      threads: [],
    });
    const service = createThreadSuggestionService(deps);

    const pending = await service.listPending();
    expect(pending[0]).toMatchObject({ existingThreadId: null, existingThreadTitle: null });
  });

  it('expires suggestions older than the max age', async () => {
    const deps = createDeps({
      suggestions: [buildSuggestion({ createdAt: '2026-06-01T08:00:00.000Z' })],
      entries: [buildEntry('e2', '继续'), buildEntry('e1', '起点')],
    });
    const service = createThreadSuggestionService(deps);

    // 2026-06-01 -> 2026-06-16 is 15 days (> 14).
    await expect(service.listPending('2026-06-16')).resolves.toEqual([]);
    expect(deps.suggestionRepository.removeByEntryIds).toHaveBeenCalledWith(['e2']);
  });
});

describe('threadSuggestionService.confirm', () => {
  it('joins an existing thread when the suggestion targets one', async () => {
    const deps = createDeps({
      suggestions: [buildSuggestion({ existingThreadId: 'thread_pay' })],
      threads: [buildThread('thread_pay', '支付重构')],
    });
    const service = createThreadSuggestionService(deps);

    await service.confirm('e2');

    expect(deps.threadService.addEntryToThread).toHaveBeenCalledWith('thread_pay', 'e2');
    expect(deps.threadService.createThreadFromEntries).not.toHaveBeenCalled();
    expect(deps.suggestionRepository.remove).toHaveBeenCalledWith('e2');
  });

  it('creates a new thread from both entries when there is no existing thread', async () => {
    const deps = createDeps({ suggestions: [buildSuggestion()] });
    const service = createThreadSuggestionService(deps);

    await service.confirm('e2');

    expect(deps.threadService.createThreadFromEntries).toHaveBeenCalledWith('支付重构', ['e1', 'e2']);
    expect(deps.suggestionRepository.remove).toHaveBeenCalledWith('e2');
  });

  it('falls back to creating a thread when the targeted thread was deleted', async () => {
    const deps = createDeps({
      suggestions: [buildSuggestion({ existingThreadId: 'thread_deleted' })],
      threads: [],
    });
    const service = createThreadSuggestionService(deps);

    await service.confirm('e2');

    expect(deps.threadService.createThreadFromEntries).toHaveBeenCalledWith('支付重构', ['e1', 'e2']);
    expect(deps.threadService.addEntryToThread).not.toHaveBeenCalled();
  });

  it('does nothing when the suggestion is missing', async () => {
    const deps = createDeps();
    const service = createThreadSuggestionService(deps);

    await service.confirm('missing');

    expect(deps.threadService.addEntryToThread).not.toHaveBeenCalled();
    expect(deps.threadService.createThreadFromEntries).not.toHaveBeenCalled();
  });
});

describe('threadSuggestionService.dismiss', () => {
  it('removes the suggestion', async () => {
    const deps = createDeps({ suggestions: [buildSuggestion()] });
    const service = createThreadSuggestionService(deps);

    await service.dismiss('e2');

    expect(deps.suggestionRepository.remove).toHaveBeenCalledWith('e2');
  });
});
