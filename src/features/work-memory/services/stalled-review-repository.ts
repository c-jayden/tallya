// Lightweight, non-critical UI state for the stalled-thread review nudge: when we
// last ran the daily check, and when each thread was last nudged (so the dot does
// not re-light every day — "问过静默"). Kept in localStorage on purpose: it is a
// disposable hint, not user content, so it needs no SQLite schema/migration, and
// losing it merely re-shows a nudge. The interface is isolated so it can move to
// SQLite later without touching callers.
export type StalledReviewState = {
  // YYYY-MM-DD of the last daily check, or '' if never run.
  lastCheckedDate: string;
  // threadId -> YYYY-MM-DD it was last surfaced as a nudge.
  shownByThread: Record<string, string>;
};

export const EMPTY_STALLED_REVIEW_STATE: StalledReviewState = {
  lastCheckedDate: '',
  shownByThread: {},
};

const STORAGE_KEY = 'tallya.stalled-review.v1';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export class LocalStorageStalledReviewRepository {
  constructor(private readonly storage: Storage | null = getBrowserStorage()) {}

  async getState(): Promise<StalledReviewState> {
    if (!this.storage) {
      return EMPTY_STALLED_REVIEW_STATE;
    }

    const rawValue = this.storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return EMPTY_STALLED_REVIEW_STATE;
    }

    try {
      return normalizeState(JSON.parse(rawValue) as unknown);
    } catch {
      return EMPTY_STALLED_REVIEW_STATE;
    }
  }

  async saveState(state: StalledReviewState): Promise<StalledReviewState> {
    const normalized = normalizeState(state);

    this.storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));

    return normalized;
  }
}

export const stalledReviewRepository = new LocalStorageStalledReviewRepository();

function normalizeState(value: unknown): StalledReviewState {
  if (!value || typeof value !== 'object') {
    return EMPTY_STALLED_REVIEW_STATE;
  }

  const input = value as Record<string, unknown>;
  const lastCheckedDate =
    typeof input.lastCheckedDate === 'string' && DATE_PATTERN.test(input.lastCheckedDate)
      ? input.lastCheckedDate
      : '';

  const shownByThread: Record<string, string> = {};

  if (input.shownByThread && typeof input.shownByThread === 'object') {
    for (const [threadId, date] of Object.entries(input.shownByThread as Record<string, unknown>)) {
      if (typeof date === 'string' && DATE_PATTERN.test(date)) {
        shownByThread[threadId] = date;
      }
    }
  }

  return { lastCheckedDate, shownByThread };
}
