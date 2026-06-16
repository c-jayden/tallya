import { useCallback, useEffect, useRef, useState } from 'react';
import { threadService, type ThreadStoryline } from '../services/thread-service';
import { selectStalledThreads } from '../services/stalled-threads';
import type { ThreadSummary } from '../types';

type UseThreadsPanelOptions = {
  currentDate: string;
};

export function useThreadsPanel({ currentDate }: UseThreadsPanelOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [threadSummaries, setThreadSummaries] = useState<ThreadSummary[]>([]);
  const [stalledThreadIds, setStalledThreadIds] = useState<Set<string>>(new Set());
  const [selectedThread, setSelectedThread] = useState<ThreadStoryline | null>(null);
  const threadsButtonRef = useRef<HTMLButtonElement>(null);

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSelectedThread(null);
    threadsButtonRef.current?.blur();
  }, []);

  // Summaries reload each time the panel opens so newly merged threads (or ones
  // emptied by deletes) stay in sync without a manual refresh. Stalled threads are
  // computed from the same data and floated to the top so review is one glance.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    void threadService.listThreadSummaries().then((summaries) => {
      if (!isMounted) {
        return;
      }

      const stalledIds = new Set(
        selectStalledThreads(summaries, currentDate).map((stalled) => stalled.summary.id),
      );
      // Stable sort keeps the repository's recency order within each group.
      const ordered = [...summaries].sort(
        (first, second) =>
          (stalledIds.has(first.id) ? 0 : 1) - (stalledIds.has(second.id) ? 0 : 1),
      );

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

  return {
    isThreadsOpen: isOpen,
    threadSummaries,
    stalledThreadIds,
    selectedThread,
    threadsButtonRef,
    openThreadsPanel: openPanel,
    closeThreadsPanel: closePanel,
    openThread,
    backToThreadList,
  };
}
