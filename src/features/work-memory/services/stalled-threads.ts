import type { ReportGap, ThreadSummary } from '../types';
import { differenceInCalendarDays } from './memory-date';

// Rules for deciding a thread is "停顿" (stalled) — recorded across several days
// with real momentum, then went quiet recently — so we can ask "还在进行吗？"
// without ever inferring completion. All measured from occurredOn (YYYY-MM-DD)
// calendar days, never timestamps, to avoid off-by-one across times of day.
export type StalledThreadThresholds = {
  // ① momentum: at least this many entries, so a one-off note never qualifies.
  minEntryCount: number;
  // ②③ silence window since the last entry: long enough to count as "停了",
  // short enough that the thread isn't simply abandoned/forgotten.
  minSilentDays: number;
  maxSilentDays: number;
};

export const DEFAULT_STALLED_THREAD_THRESHOLDS: StalledThreadThresholds = {
  minEntryCount: 2,
  minSilentDays: 3,
  maxSilentDays: 14,
};

// A stalled thread plus how many days it has been quiet, so callers can both mark
// it and phrase a question without recomputing.
export type StalledThread = {
  summary: ThreadSummary;
  silentDays: number;
};

// Picks the stalled threads from thread summaries. referenceDate is "today"
// (YYYY-MM-DD); a thread qualifies only when it has cross-day momentum and its
// silence falls inside [minSilentDays, maxSilentDays].
export function selectStalledThreads(
  summaries: ThreadSummary[],
  referenceDate: string,
  thresholds: StalledThreadThresholds = DEFAULT_STALLED_THREAD_THRESHOLDS,
): StalledThread[] {
  const stalled: StalledThread[] = [];

  for (const summary of summaries) {
    // ① real cross-day momentum, not a single stray note.
    if (summary.entryCount < thresholds.minEntryCount) {
      continue;
    }

    if (summary.firstOccurredOn === summary.lastOccurredOn) {
      continue;
    }

    // ②③ the thread must be quiet, but not so long that it's clearly dropped.
    const silentDays = differenceInCalendarDays(summary.lastOccurredOn, referenceDate);

    if (silentDays < thresholds.minSilentDays || silentDays > thresholds.maxSilentDays) {
      continue;
    }

    stalled.push({ summary, silentDays });
  }

  return stalled;
}

// Turns stalled threads into report gaps with a fixed question (no AI needed);
// the answer attaches to the thread's most recent entry.
export function selectStalledThreadGaps(
  summaries: ThreadSummary[],
  referenceDate: string,
  thresholds: StalledThreadThresholds = DEFAULT_STALLED_THREAD_THRESHOLDS,
): ReportGap[] {
  return selectStalledThreads(summaries, referenceDate, thresholds).map(({ summary, silentDays }) => ({
    entryId: summary.lastEntryId,
    threadTitle: summary.title,
    question: `《${summary.title}》最近 ${silentDays} 天没再记了，还在进行吗？现在到哪一步了？`,
  }));
}
