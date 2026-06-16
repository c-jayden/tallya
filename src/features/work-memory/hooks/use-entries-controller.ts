import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../services/ai/ai-service';
import { clarificationRepository } from '../services/clarification-repository';
import { entryRepository } from '../services/entry-repository';
import { reportRepository } from '../services/report-repository';
import { threadRepository } from '../services/thread-repository';
import { threadSuggestionService } from '../services/thread-suggestion-service';
import { usageStatsRepository } from '../services/usage-stats-repository';
import type { Clarification, Entry, ThreadLinkCandidate } from '../types';

// How many recent entries are offered to the AI as merge candidates. Capped to
// keep the prompt small and the background call cheap.
const THREAD_LINK_CANDIDATE_LIMIT = 20;

// Debounce window before a freshly-logged entry triggers the thread-link call.
// Rapid logging collapses to a single call for the latest entry, so a burst of
// captures never spawns a burst of (cold-starting) Codex processes.
const THREAD_SUGGESTION_DEBOUNCE_MS = 1500;

type UseEntriesControllerOptions = {
  currentDate: string;
  todayDate: string;
  // Called after the persisted set of pending merge suggestions changes (a new
  // suggestion saved, or suggestions cleaned up), so the threads hub can refresh
  // its count/list without polling.
  onThreadSuggestionsChanged?: () => void;
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

// A meaningful content change worth re-asking for a thread link. Ignores
// whitespace-only edits and tiny tweaks (e.g. typo fixes), where one string is
// contained in the other with only a few characters added or removed.
function isSubstantialContentChange(oldContent: string, newContent: string) {
  const a = oldContent.replace(/\s+/g, ' ').trim();
  const b = newContent.replace(/\s+/g, ' ').trim();

  if (a === b) {
    return false;
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];

  return !(longer.includes(shorter) && longer.length - shorter.length < 6);
}

async function loadDayData(currentDate: string): Promise<DayData> {
  const entries = await entryRepository.listByDate(currentDate);
  const clarifications = await clarificationRepository.listByEntryIds(
    entries.map((entry) => entry.id),
  );

  return { entries, clarificationsByEntry: groupByEntry(clarifications) };
}

export function useEntriesController({
  currentDate,
  todayDate,
  onThreadSuggestionsChanged,
}: UseEntriesControllerOptions) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clarificationsByEntry, setClarificationsByEntry] = useState<
    Record<string, Clarification[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const suggestionInFlightRef = useRef(false);
  // Held in a ref so the background suggestion callbacks stay stable regardless of
  // how often the parent re-creates the handler.
  const onSuggestionsChangedRef = useRef(onThreadSuggestionsChanged);

  useEffect(() => {
    onSuggestionsChangedRef.current = onThreadSuggestionsChanged;
  }, [onThreadSuggestionsChanged]);

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

      // Persist the suggestion (not session-only) so a slow/late AI response and
      // cross-day captures are never lost; the threads hub reads it from here.
      await threadSuggestionService.save({
        entryId: newEntry.id,
        relatedEntryId: relatedEntry.id,
        proposedThreadTitle: threadTitle,
        existingThreadId,
      });
      onSuggestionsChangedRef.current?.();
    } catch {
      // Silent by design: a missing/failed merge hint must not interrupt logging.
    }
  }, []);

  // Debounced + single-flight wrapper: collapses a burst of captures into one
  // call for the latest entry, and never runs two thread-link calls at once.
  const scheduleThreadSuggestion = useCallback(
    (entry: Entry) => {
      if (suggestionTimeoutRef.current !== null) {
        window.clearTimeout(suggestionTimeoutRef.current);
      }

      suggestionTimeoutRef.current = window.setTimeout(() => {
        suggestionTimeoutRef.current = null;

        // If a call is still running, skip this one — suggestions are
        // best-effort, and never stacking a concurrent (cold-starting) call
        // matters more than catching every entry.
        if (suggestionInFlightRef.current) {
          return;
        }

        suggestionInFlightRef.current = true;
        void requestThreadSuggestion(entry).finally(() => {
          suggestionInFlightRef.current = false;
        });
      }, THREAD_SUGGESTION_DEBOUNCE_MS);
    },
    [requestThreadSuggestion],
  );

  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current !== null) {
        window.clearTimeout(suggestionTimeoutRef.current);
      }
    };
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
        usageStatsRepository.recordEntryCreated();
        await reload();
        // Fire-and-forget + debounced: don't block the composer, and don't let
        // rapid logging spawn concurrent AI calls.
        scheduleThreadSuggestion(newEntry);

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '记录保存失败，请稍后重试。');

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentDate, isSaving, reload, scheduleThreadSuggestion, todayDate],
  );

  const updateEntry = useCallback(
    async (id: string, content: string) => {
      const trimmed = content.trim();

      if (!trimmed) {
        return false;
      }

      try {
        const existing = await entryRepository.getById(id);
        const updated = await entryRepository.update(id, { content: trimmed });
        await reload();

        // Editing only re-asks for a thread link when it's worth it: the entry
        // isn't already in a thread, and the content actually changed in a
        // meaningful way (so typo/whitespace fixes never spawn an AI call).
        if (
          updated &&
          !existing?.threadId &&
          isSubstantialContentChange(existing?.content ?? '', trimmed)
        ) {
          scheduleThreadSuggestion(updated);
        }

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '更新失败，请稍后重试。');

        return false;
      }
    },
    [reload, scheduleThreadSuggestion],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      try {
        await entryRepository.remove(id);
        // Clarifications are children of the entry; remove them so deleting an
        // entry never leaves orphaned detail behind.
        await clarificationRepository.removeByEntry(id);
        // Drop any pending merge suggestion that pointed at this entry.
        await threadSuggestionService.removeForEntries([id]);
        onSuggestionsChangedRef.current?.();
        await reload();
        toast.success('已删除这条记录');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败，请稍后重试。');
      }
    },
    [reload],
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
    await threadSuggestionService.clearLocalData();
    await reportRepository.clearReports();
    setEntries([]);
    setClarificationsByEntry({});
    onSuggestionsChangedRef.current?.();
  }, []);

  return {
    entries,
    clarificationsByEntry,
    isLoading,
    isSaving,
    composerRef,
    createEntry,
    updateEntry,
    removeEntry,
    addClarification,
    removeClarification,
    suggestQuestions,
    reload,
    clearLocalData,
  };
}
