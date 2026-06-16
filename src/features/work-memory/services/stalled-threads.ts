import type { ReportGap, ThreadSummary } from '../types';

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

// Picks the stalled threads from thread summaries and turns each into a report
// gap with a fixed question (no AI needed). referenceDate is "today" (YYYY-MM-DD);
// a thread qualifies only when its silence falls inside [minSilentDays, maxSilentDays].
export function selectStalledThreadGaps(
  summaries: ThreadSummary[],
  referenceDate: string,
  thresholds: StalledThreadThresholds = DEFAULT_STALLED_THREAD_THRESHOLDS,
): ReportGap[] {
  const gaps: ReportGap[] = [];

  for (const summary of summaries) {
    // ① real cross-day momentum, not a single stray note.
    if (summary.entryCount < thresholds.minEntryCount) {
      continue;
    }

    if (summary.firstOccurredOn === summary.lastOccurredOn) {
      continue;
    }

    // ②③ the thread must be quiet, but not so long that it's clearly dropped.
    const silentDays = daysBetween(summary.lastOccurredOn, referenceDate);

    if (silentDays < thresholds.minSilentDays || silentDays > thresholds.maxSilentDays) {
      continue;
    }

    gaps.push({
      entryId: summary.lastEntryId,
      threadTitle: summary.title,
      question: `《${summary.title}》最近 ${silentDays} 天没再记了，还在进行吗？现在到哪一步了？`,
    });
  }

  return gaps;
}

// Calendar-day difference between two YYYY-MM-DD dates, computed in UTC so it is
// not skewed by local DST or time-of-day.
function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((parseYmd(toDate) - parseYmd(fromDate)) / 86_400_000);
}

function parseYmd(value: string): number {
  const [year, month, day] = value.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}
