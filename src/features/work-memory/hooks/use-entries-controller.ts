import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { entryRepository } from '../services/entry-repository';
import type { Entry } from '../types';

type UseEntriesControllerOptions = {
  currentDate: string;
  todayDate: string;
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

export function useEntriesController({ currentDate, todayDate }: UseEntriesControllerOptions) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(async () => {
    const items = await entryRepository.listByDate(currentDate);

    setEntries(items);
    setIsLoading(false);
  }, [currentDate]);

  useEffect(() => {
    let isMounted = true;

    // State is set only inside the async callback (never synchronously in the
    // effect body) so date switches don't trigger cascading renders.
    void entryRepository.listByDate(currentDate).then((items) => {
      if (isMounted) {
        setEntries(items);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentDate]);

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
        await reload();
        toast.success('已删除这条记录');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败，请稍后重试。');
      }
    },
    [reload],
  );

  const clearLocalData = useCallback(async () => {
    await entryRepository.clearLocalData();
    setEntries([]);
  }, []);

  return {
    entries,
    isLoading,
    isSaving,
    composerRef,
    createEntry,
    updateEntry,
    removeEntry,
    reload,
    clearLocalData,
  };
}
