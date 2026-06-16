import type {
  CreateThreadSuggestionInput,
  Entry,
  PendingMergeSuggestion,
  Thread,
  ThreadSuggestion,
} from '../types';
import { differenceInCalendarDays } from './memory-date';
import { entryRepository as defaultEntryRepository } from './entry-repository';
import { threadRepository as defaultThreadRepository } from './thread-repository';
import { threadSuggestionRepository as defaultSuggestionRepository } from './thread-suggestion-repository';
import { threadService as defaultThreadService } from './thread-service';

// Drop suggestions left unreviewed this long so the hub never piles up into a
// "收件箱" of stale decisions.
const SUGGESTION_MAX_AGE_DAYS = 14;

type SuggestionEntryRepository = {
  getById(id: string): Promise<Entry | null>;
};

type SuggestionThreadRepository = {
  list(): Promise<Thread[]>;
};

type SuggestionStore = {
  upsert(input: CreateThreadSuggestionInput): Promise<ThreadSuggestion>;
  getByEntryId(entryId: string): Promise<ThreadSuggestion | null>;
  listAll(): Promise<ThreadSuggestion[]>;
  remove(entryId: string): Promise<void>;
  removeByEntryIds(entryIds: string[]): Promise<void>;
  clearLocalData(): Promise<void>;
};

type SuggestionMergeService = {
  addEntryToThread(threadId: string, entryId: string): Promise<void>;
  createThreadFromEntries(title: string, entryIds: string[]): Promise<Thread>;
};

type ThreadSuggestionServiceOptions = {
  suggestionRepository?: SuggestionStore;
  entryRepository?: SuggestionEntryRepository;
  threadRepository?: SuggestionThreadRepository;
  threadService?: SuggestionMergeService;
};

export function createThreadSuggestionService({
  suggestionRepository = defaultSuggestionRepository,
  entryRepository = defaultEntryRepository,
  threadRepository = defaultThreadRepository,
  threadService = defaultThreadService,
}: ThreadSuggestionServiceOptions = {}) {
  return {
    async save(input: CreateThreadSuggestionInput) {
      return suggestionRepository.upsert(input);
    },

    // Returns only valid suggestions for the hub, pruning stale ones as it goes:
    // a suggestion is dead once its entry is gone, already in a thread, or its
    // matched entry is gone; expired ones are dropped too. referenceDate is today
    // (YYYY-MM-DD) for the age check.
    async listPending(referenceDate?: string): Promise<PendingMergeSuggestion[]> {
      const suggestions = await suggestionRepository.listAll();

      if (suggestions.length === 0) {
        return [];
      }

      const threads = await threadRepository.list();
      const threadById = new Map(threads.map((thread) => [thread.id, thread]));

      const valid: PendingMergeSuggestion[] = [];
      const staleEntryIds: string[] = [];

      for (const suggestion of suggestions) {
        if (isExpired(suggestion, referenceDate)) {
          staleEntryIds.push(suggestion.entryId);
          continue;
        }

        const [entry, relatedEntry] = await Promise.all([
          entryRepository.getById(suggestion.entryId),
          entryRepository.getById(suggestion.relatedEntryId),
        ]);

        // Dead once the entry is gone, already threaded, or its match is gone.
        if (!entry || entry.threadId || !relatedEntry) {
          staleEntryIds.push(suggestion.entryId);
          continue;
        }

        // If the suggested existing thread vanished, fall back to proposing a new
        // one rather than dropping a still-useful suggestion.
        const existingThread = suggestion.existingThreadId
          ? threadById.get(suggestion.existingThreadId) ?? null
          : null;

        valid.push({
          entryId: suggestion.entryId,
          entryContent: entry.content,
          relatedEntryContent: relatedEntry.content,
          proposedThreadTitle: suggestion.proposedThreadTitle,
          existingThreadId: existingThread ? existingThread.id : null,
          existingThreadTitle: existingThread ? existingThread.title : null,
        });
      }

      if (staleEntryIds.length > 0) {
        await suggestionRepository.removeByEntryIds(staleEntryIds);
      }

      return valid;
    },

    async confirm(entryId: string) {
      const suggestion = await suggestionRepository.getByEntryId(entryId);

      if (!suggestion) {
        return;
      }

      // Re-check the target thread still exists; otherwise create a fresh one so a
      // confirm never silently fails on a deleted thread.
      const existingThread = suggestion.existingThreadId
        ? (await threadRepository.list()).find((thread) => thread.id === suggestion.existingThreadId)
        : undefined;

      if (existingThread) {
        await threadService.addEntryToThread(existingThread.id, entryId);
      } else {
        await threadService.createThreadFromEntries(suggestion.proposedThreadTitle, [
          suggestion.relatedEntryId,
          entryId,
        ]);
      }

      await suggestionRepository.remove(entryId);
    },

    async dismiss(entryId: string) {
      await suggestionRepository.remove(entryId);
    },

    async removeForEntries(entryIds: string[]) {
      await suggestionRepository.removeByEntryIds(entryIds);
    },

    async clearLocalData() {
      await suggestionRepository.clearLocalData();
    },
  };
}

function isExpired(suggestion: ThreadSuggestion, referenceDate?: string) {
  if (!referenceDate) {
    return false;
  }

  const createdOn = suggestion.createdAt.slice(0, 10);

  return differenceInCalendarDays(createdOn, referenceDate) > SUGGESTION_MAX_AGE_DAYS;
}

export const threadSuggestionService = createThreadSuggestionService();
