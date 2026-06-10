import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../services/ai/ai-service';
import { clarificationRepository } from '../services/clarification-repository';
import { entryRepository } from '../services/entry-repository';
import { threadRepository } from '../services/thread-repository';
import { threadService } from '../services/thread-service';
import type { Clarification, Entry, ThreadLinkCandidate } from '../types';

// How many recent entries are offered to the AI as merge candidates. Capped to
// keep the prompt small and the background call cheap.
const THREAD_LINK_CANDIDATE_LIMIT = 20;

// A pending merge suggestion for one freshly-created entry. existingThreadId is
// set when the matched entry already belongs to a thread (join it); otherwise a
// new thread is created from both entries on confirm.
export type ThreadSuggestionView = {
  relatedEntry: Entry;
  threadTitle: string;
  existingThreadId: string | null;
  existingThreadTitle: string | null;
};

type UseEntriesControllerOptions = {
  currentDate: string;
  todayDate: string;
};

type DayData = {
  entries: Entry[];
  clarificationsByEntry: Record<string, Clarification[]>;
};

// Entries always belong to the date being viewed. For today we stamp the real
// time; for a past day we use local noon so the derived day never flips across
// timezone/DST boundaries.
function computeOccurredAt(currentDate: string, todayDate: string) {
  if (currentDate === todayDate) {
    return new Date().toISOString();
  }

  return new Date(`${currentDate}T12:00:00`).toISOString();
}

function groupByEntry(clarifications: Clarification[]): Record<string, Clarification[]> {
  const grouped: Record<string, Clarification[]> = {};

  for (const clarification of clarifications) {
    (grouped[clarification.entryId] ??= []).push(clarification);
  }

  return grouped;
}

async function loadDayData(currentDate: string): Promise<DayData> {
  const entries = await entryRepository.listByDate(currentDate);
  const clarifications = await clarificationRepository.listByEntryIds(
    entries.map((entry) => entry.id),
  );

  return { entries, clarificationsByEntry: groupByEntry(clarifications) };
}

export function useEntriesController({ currentDate, todayDate }: UseEntriesControllerOptions) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clarificationsByEntry, setClarificationsByEntry] = useState<
    Record<string, Clarification[]>
  >({});
  const [threadSuggestionByEntry, setThreadSuggestionByEntry] = useState<
    Record<string, ThreadSuggestionView>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const applyDayData = useCallback((data: DayData) => {
    setEntries(data.entries);
    setClarificationsByEntry(data.clarificationsByEntry);
    setIsLoading(false);
  }, []);

  const reload = useCallback(async () => {
    applyDayData(await loadDayData(currentDate));
  }, [applyDayData, currentDate]);

  useEffect(() => {
    let isMounted = true;

    // State is set only inside the async callback (never synchronously in the
    // effect body) so date switches don't trigger cascading renders.
    void loadDayData(currentDate).then((data) => {
      if (isMounted) {
        applyDayData(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [applyDayData, currentDate]);

  // Background, best-effort: after a new entry lands, ask the AI whether it
  // continues an existing entry/thread. Every failure path (no candidates, AI
  // not configured, network/parse errors) is swallowed so capture stays
  // zero-friction and never shows an error.
  const requestThreadSuggestion = useCallback(async (newEntry: Entry) => {
    try {
      const recent = await entryRepository.listRecent(THREAD_LINK_CANDIDATE_LIMIT + 1);
      const candidates = recent.filter((entry) => entry.id !== newEntry.id);

      if (candidates.length === 0) {
        return;
      }

      const threads = await threadRepository.list();
      const threadTitleById = new Map(threads.map((thread) => [thread.id, thread.title]));

      const candidateInputs: ThreadLinkCandidate[] = candidates.map((entry) => ({
        id: entry.id,
        content: entry.content,
        occurredOn: entry.occurredOn,
        threadId: entry.threadId,
        threadTitle: entry.threadId ? threadTitleById.get(entry.threadId) ?? null : null,
      }));

      const suggestion = await aiService.suggestThreadLink({
        content: newEntry.content,
        candidates: candidateInputs,
      });

      const relatedEntry = suggestion.relatedEntryId
        ? candidates.find((entry) => entry.id === suggestion.relatedEntryId)
        : undefined;

      if (!relatedEntry) {
        return;
      }

      const existingThreadId = relatedEntry.threadId;
      const existingThreadTitle = existingThreadId
        ? threadTitleById.get(existingThreadId) ?? null
        : null;
      const threadTitle =
        suggestion.threadTitle.trim() || existingThreadTitle || newEntry.content.slice(0, 14);

      setThreadSuggestionByEntry((current) => ({
        ...current,
        [newEntry.id]: { relatedEntry, threadTitle, existingThreadId, existingThreadTitle },
      }));
    } catch {
      // Silent by design: a missing/failed merge hint must not interrupt logging.
    }
  }, []);

  const createEntry = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (!trimmed || isSaving) {
        return false;
      }

      setIsSaving(true);

      try {
        const newEntry = await entryRepository.create({
          content: trimmed,
          occurredAt: computeOccurredAt(currentDate, todayDate),
        });
        await reload();
        // Fire-and-forget: don't block the composer on the AI round-trip.
        void requestThreadSuggestion(newEntry);

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '记录保存失败，请稍后重试。');

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentDate, isSaving, reload, requestThreadSuggestion, todayDate],
  );

  const updateEntry = useCallback(
    async (id: string, content: string) => {
      const trimmed = content.trim();

      if (!trimmed) {
        return false;
      }

      try {
        await entryRepository.update(id, { content: trimmed });
        await reload();

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '更新失败，请稍后重试。');

        return false;
      }
    },
    [reload],
  );

  const dropThreadSuggestion = useCallback((entryId: string) => {
    setThreadSuggestionByEntry((current) => {
      if (!(entryId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[entryId];

      return next;
    });
  }, []);

  const removeEntry = useCallback(
    async (id: string) => {
      try {
        await entryRepository.remove(id);
        // Clarifications are children of the entry; remove them so deleting an
        // entry never leaves orphaned detail behind.
        await clarificationRepository.removeByEntry(id);
        dropThreadSuggestion(id);
        await reload();
        toast.success('已删除这条记录');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败，请稍后重试。');
      }
    },
    [dropThreadSuggestion, reload],
  );

  const confirmThreadSuggestion = useCallback(
    async (entryId: string) => {
      const suggestion = threadSuggestionByEntry[entryId];

      if (!suggestion) {
        return;
      }

      try {
        if (suggestion.existingThreadId) {
          await threadService.addEntryToThread(suggestion.existingThreadId, entryId);
        } else {
          await threadService.createThreadFromEntries(suggestion.threadTitle, [
            suggestion.relatedEntry.id,
            entryId,
          ]);
        }

        dropThreadSuggestion(entryId);
        await reload();
        toast.success('已归并到线索');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '归并失败，请稍后重试。');
      }
    },
    [dropThreadSuggestion, reload, threadSuggestionByEntry],
  );

  const dismissThreadSuggestion = useCallback(
    (entryId: string) => {
      dropThreadSuggestion(entryId);
    },
    [dropThreadSuggestion],
  );

  const addClarification = useCallback(
    async (entryId: string, question: string | null, answer: string) => {
      const trimmed = answer.trim();

      if (!trimmed) {
        return false;
      }

      try {
        await clarificationRepository.create({ entryId, question, answer: trimmed });
        await reload();

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '补充保存失败，请稍后重试。');

        return false;
      }
    },
    [reload],
  );

  const removeClarification = useCallback(
    async (id: string) => {
      try {
        await clarificationRepository.remove(id);
        await reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除补充失败，请稍后重试。');
      }
    },
    [reload],
  );

  const suggestQuestions = useCallback(async (content: string) => {
    return aiService.suggestClarifications({ content });
  }, []);

  const clearLocalData = useCallback(async () => {
    await entryRepository.clearLocalData();
    await clarificationRepository.clearLocalData();
    await threadRepository.clearLocalData();
    setEntries([]);
    setClarificationsByEntry({});
    setThreadSuggestionByEntry({});
  }, []);

  return {
    entries,
    clarificationsByEntry,
    threadSuggestionByEntry,
    isLoading,
    isSaving,
    composerRef,
    createEntry,
    updateEntry,
    removeEntry,
    addClarification,
    removeClarification,
    confirmThreadSuggestion,
    dismissThreadSuggestion,
    suggestQuestions,
    reload,
    clearLocalData,
  };
}
