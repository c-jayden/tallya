import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { threadService, type ThreadStoryline } from '../services/thread-service';
import { threadSuggestionService } from '../services/thread-suggestion-service';
import { selectStalledThreads } from '../services/stalled-threads';
import type { PendingMergeSuggestion, ThreadSummary } from '../types';

type UseThreadsPanelOptions = {
  currentDate: string;
};

// Stalled threads float to the top of the list so review is one glance. Stable
// sort keeps the repository's recency order within each group.
function orderByStalledFirst(summaries: ThreadSummary[], currentDate: string) {
  const stalledIds = new Set(
    selectStalledThreads(summaries, currentDate).map((stalled) => stalled.summary.id),
  );
  const ordered = [...summaries].sort(
    (first, second) => (stalledIds.has(first.id) ? 0 : 1) - (stalledIds.has(second.id) ? 0 : 1),
  );

  return { stalledIds, ordered };
}

export function useThreadsPanel({ currentDate }: UseThreadsPanelOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [threadSummaries, setThreadSummaries] = useState<ThreadSummary[]>([]);
  const [stalledThreadIds, setStalledThreadIds] = useState<Set<string>>(new Set());
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingMergeSuggestion[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadStoryline | null>(null);
  const threadsButtonRef = useRef<HTMLButtonElement>(null);

  const loadThreads = useCallback(async () => {
    const summaries = await threadService.listThreadSummaries();
    const { stalledIds, ordered } = orderByStalledFirst(summaries, currentDate);

    setStalledThreadIds(stalledIds);
    setThreadSummaries(ordered);
  }, [currentDate]);

  const refreshSuggestions = useCallback(async () => {
    setPendingSuggestions(await threadSuggestionService.listPending(currentDate));
  }, [currentDate]);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    // Imperative refresh on open so the 待归并 list is current the moment it shows.
    void refreshSuggestions();
  }, [refreshSuggestions]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSelectedThread(null);
    threadsButtonRef.current?.blur();
  }, []);

  // The pending-suggestion count drives the toolbar badge even while the panel is
  // closed, so it loads on mount / date change independently of opening.
  useEffect(() => {
    let isMounted = true;

    void threadSuggestionService.listPending(currentDate).then((pending) => {
      if (isMounted) {
        setPendingSuggestions(pending);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentDate]);

  // Summaries reload each time the panel opens so newly merged threads (or ones
  // emptied by deletes) stay in sync without a manual refresh.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    void threadService.listThreadSummaries().then((summaries) => {
      if (!isMounted) {
        return;
      }

      const { stalledIds, ordered } = orderByStalledFirst(summaries, currentDate);

      setStalledThreadIds(stalledIds);
      setThreadSummaries(ordered);
    });

    return () => {
      isMounted = false;
    };
  }, [currentDate, isOpen]);

  // Esc closes the panel (storyline first handled by callers via back), matching
  // the search palette's keyboard affordance.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePanel, isOpen]);

  const openThread = useCallback((threadId: string) => {
    void threadService.getStoryline(threadId).then((storyline) => {
      if (storyline) {
        setSelectedThread(storyline);
      }
    });
  }, []);

  const backToThreadList = useCallback(() => {
    setSelectedThread(null);
  }, []);

  const confirmSuggestion = useCallback(
    async (entryId: string) => {
      try {
        await threadSuggestionService.confirm(entryId);
        await Promise.all([loadThreads(), refreshSuggestions()]);
        toast.success('已归并到线索');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '归并失败，请稍后重试。');
      }
    },
    [loadThreads, refreshSuggestions],
  );

  const dismissSuggestion = useCallback(
    async (entryId: string) => {
      await threadSuggestionService.dismiss(entryId);
      await refreshSuggestions();
    },
    [refreshSuggestions],
  );

  return {
    isThreadsOpen: isOpen,
    threadSummaries,
    stalledThreadIds,
    pendingSuggestions,
    pendingMergeCount: pendingSuggestions.length,
    selectedThread,
    threadsButtonRef,
    openThreadsPanel: openPanel,
    closeThreadsPanel: closePanel,
    openThread,
    backToThreadList,
    refreshSuggestions,
    confirmSuggestion,
    dismissSuggestion,
  };
}
