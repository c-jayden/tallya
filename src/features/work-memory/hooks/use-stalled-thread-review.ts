import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../services/logger/logger';
import { planStalledReviewNudge } from '../services/stalled-review';
import { stalledReviewRepository } from '../services/stalled-review-repository';
import { selectStalledThreads } from '../services/stalled-threads';
import { threadService } from '../services/thread-service';

type UseStalledThreadReviewOptions = {
  currentDate: string;
};

// Drives the passive review nudge: a quiet dot on the threads button when stalled
// threads exist. The check runs at most once per calendar day (first window show),
// never pushes anything, and snoozes per-thread so it does not nag. The panel
// itself owns marking which threads are stalled; this hook owns only the nudge.
export function useStalledThreadReview({ currentDate }: UseStalledThreadReviewOptions) {
  const [hasReviewNudge, setHasReviewNudge] = useState(false);
  // Cleared for the rest of the session once the user opens the threads panel.
  const reviewedThisSessionRef = useRef(false);

  // Returns whether a fresh nudge should light the dot, leaving the setState to
  // the caller so this stays a pure-ish async data step (no state writes inside).
  const runDailyCheck = useCallback(async (): Promise<boolean> => {
    if (reviewedThisSessionRef.current) {
      return false;
    }

    try {
      const state = await stalledReviewRepository.getState();

      // Once per day: the first window show of the day does the work, later shows
      // (tray re-open, focus) are no-ops.
      if (state.lastCheckedDate === currentDate) {
        return false;
      }

      const summaries = await threadService.listThreadSummaries();
      const stalledThreadIds = selectStalledThreads(summaries, currentDate).map(
        (stalled) => stalled.summary.id,
      );
      const { nextState, hasFreshNudge } = planStalledReviewNudge(
        state,
        stalledThreadIds,
        currentDate,
      );

      await stalledReviewRepository.saveState(nextState);

      return hasFreshNudge;
    } catch (error) {
      logger.warn('report', 'stalled-review.check_failed', 'Stalled review check failed', {
        currentDate,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }, [currentDate]);

  useEffect(() => {
    const applyCheck = () => {
      void runDailyCheck().then((shouldNudge) => {
        // Re-read the ref: the user may have opened the panel while the async
        // check was in flight, in which case the dot should stay clear.
        if (shouldNudge && !reviewedThisSessionRef.current) {
          setHasReviewNudge(true);
        }
      });
    };

    applyCheck();

    // A tray app stays open across days; re-check when the window comes forward so
    // the first show on a new day still fires (mirrors the reminder resync).
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        applyCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [runDailyCheck]);

  // Opening the threads panel counts as seeing the review, so the dot clears for
  // the rest of the session. The per-thread snooze (saved at check time) keeps it
  // from re-lighting on the next few days.
  const markReviewed = useCallback(() => {
    reviewedThisSessionRef.current = true;
    setHasReviewNudge(false);
  }, []);

  return { hasReviewNudge, markReviewed };
}
