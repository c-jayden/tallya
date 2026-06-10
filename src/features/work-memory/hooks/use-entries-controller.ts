import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../services/ai/ai-service';
import { clarificationRepository } from '../services/clarification-repository';
import { entryRepository } from '../services/entry-repository';
import type { Clarification, Entry } from '../types';

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

  const createEntry = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (!trimmed || isSaving) {
        return false;
      }

      setIsSaving(true);

      try {
        await entryRepository.create({
          content: trimmed,
          occurredAt: computeOccurredAt(currentDate, todayDate),
        });
        await reload();

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '记录保存失败，请稍后重试。');

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentDate, isSaving, reload, todayDate],
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

  const removeEntry = useCallback(
    async (id: string) => {
      try {
        await entryRepository.remove(id);
        // Clarifications are children of the entry; remove them so deleting an
        // entry never leaves orphaned detail behind.
        await clarificationRepository.removeByEntry(id);
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
    setEntries([]);
    setClarificationsByEntry({});
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
