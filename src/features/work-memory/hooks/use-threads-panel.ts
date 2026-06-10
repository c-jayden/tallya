import { useCallback, useEffect, useRef, useState } from 'react';
import { threadService, type ThreadStoryline } from '../services/thread-service';
import type { ThreadSummary } from '../types';

export function useThreadsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [threadSummaries, setThreadSummaries] = useState<ThreadSummary[]>([]);
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
  // emptied by deletes) stay in sync without a manual refresh.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    void threadService.listThreadSummaries().then((summaries) => {
      if (isMounted) {
        setThreadSummaries(summaries);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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
    selectedThread,
    threadsButtonRef,
    openThreadsPanel: openPanel,
    closeThreadsPanel: closePanel,
    openThread,
    backToThreadList,
  };
}
