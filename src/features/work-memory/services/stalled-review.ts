import { differenceInCalendarDays } from './memory-date';
import type { StalledReviewState } from './stalled-review-repository';

// Once a stalled thread has been nudged, stay quiet for this many days before
// nudging again, so the dot does not re-light every day for the same thread.
export const STALLED_REVIEW_SNOOZE_DAYS = 3;

export type StalledReviewPlan = {
  nextState: StalledReviewState;
  hasFreshNudge: boolean;
};

// Pure decision for the daily review check: given the prior state and the threads
// that are stalled today, returns the next persisted state and whether the dot
// should light. A thread keeps its earlier nudge date while snoozed and takes
// today's date when nudged now; threads no longer stalled drop out (bounds growth
// and implements "问过静默" without ever tracking completion).
export function planStalledReviewNudge(
  state: StalledReviewState,
  stalledThreadIds: string[],
  currentDate: string,
  snoozeDays: number = STALLED_REVIEW_SNOOZE_DAYS,
): StalledReviewPlan {
  const shownByThread: Record<string, string> = {};
  let hasFreshNudge = false;

  for (const threadId of stalledThreadIds) {
    const lastShown = state.shownByThread[threadId];
    const isSnoozed =
      Boolean(lastShown) && differenceInCalendarDays(lastShown, currentDate) < snoozeDays;

    if (isSnoozed) {
      shownByThread[threadId] = lastShown;
    } else {
      shownByThread[threadId] = currentDate;
      hasFreshNudge = true;
    }
  }

  return {
    nextState: { lastCheckedDate: currentDate, shownByThread },
    hasFreshNudge,
  };
}
