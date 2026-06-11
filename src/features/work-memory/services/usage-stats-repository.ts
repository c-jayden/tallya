// Minimal, local-only usage counters for retention validation. Never uploaded;
// stored in the webview's localStorage. The point is to answer three questions
// while dogfooding: are entries still being logged week-over-week, is search
// actually used, and does it find anything.

const STORAGE_KEY = 'tallya.usage-stats.v1';
const RECENT_WINDOW_DAYS = 7;
const MS_PER_DAY = 86_400_000;

type Clock = () => Date;

export type UsageDay = {
  entries: number;
  searchSessions: number;
  searchHits: number;
  retrievals: number;
};

export type UsageStats = {
  firstUseDate: string | null;
  days: Record<string, UsageDay>;
};

export type UsageSummary = {
  firstUseDate: string | null;
  totalDays: number;
  activeDays: number;
  totalEntries: number;
  recentSearchSessions: number;
  recentRetrievals: number;
  searchHitRate: number | null;
};

function localDay(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function emptyDay(): UsageDay {
  return { entries: 0, searchSessions: 0, searchHits: 0, retrievals: 0 };
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export class UsageStatsRepository {
  private now: Clock;

  constructor(
    private readonly storage: Storage | null = getBrowserStorage(),
    options: { now?: Clock } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  recordEntryCreated() {
    this.bump((day) => {
      day.entries += 1;
    });
  }

  recordSearchSession(hadResults: boolean) {
    this.bump((day) => {
      day.searchSessions += 1;

      if (hadResults) {
        day.searchHits += 1;
      }
    });
  }

  recordRetrieval() {
    this.bump((day) => {
      day.retrievals += 1;
    });
  }

  getStats(): UsageStats {
    return this.read();
  }

  getSummary(): UsageSummary {
    const stats = this.read();
    const today = this.now();
    const dayEntries = Object.entries(stats.days);

    let activeDays = 0;
    let totalEntries = 0;
    let totalSessions = 0;
    let totalHits = 0;
    let recentSearchSessions = 0;
    let recentRetrievals = 0;

    for (const [date, day] of dayEntries) {
      if (day.entries > 0) {
        activeDays += 1;
      }

      totalEntries += day.entries;
      totalSessions += day.searchSessions;
      totalHits += day.searchHits;

      if (this.isWithinRecentWindow(date, today)) {
        recentSearchSessions += day.searchSessions;
        recentRetrievals += day.retrievals;
      }
    }

    return {
      firstUseDate: stats.firstUseDate,
      totalDays: this.calendarDaysSince(stats.firstUseDate, today),
      activeDays,
      totalEntries,
      recentSearchSessions,
      recentRetrievals,
      searchHitRate: totalSessions === 0 ? null : totalHits / totalSessions,
    };
  }

  private isWithinRecentWindow(date: string, today: Date) {
    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const diffDays = Math.floor((localDayStart(today).getTime() - parsed.getTime()) / MS_PER_DAY);

    return diffDays >= 0 && diffDays < RECENT_WINDOW_DAYS;
  }

  private calendarDaysSince(firstUseDate: string | null, today: Date) {
    if (!firstUseDate) {
      return 0;
    }

    const first = new Date(`${firstUseDate}T00:00:00`);

    if (Number.isNaN(first.getTime())) {
      return 0;
    }

    return Math.floor((localDayStart(today).getTime() - first.getTime()) / MS_PER_DAY) + 1;
  }

  private bump(mutate: (day: UsageDay) => void) {
    const stats = this.read();
    const today = localDay(this.now());

    stats.firstUseDate ??= today;
    const day = stats.days[today] ?? emptyDay();

    mutate(day);
    stats.days[today] = day;
    this.write(stats);
  }

  private read(): UsageStats {
    if (!this.storage) {
      return { firstUseDate: null, days: {} };
    }

    const raw = this.storage.getItem(STORAGE_KEY);

    if (!raw) {
      return { firstUseDate: null, days: {} };
    }

    try {
      const parsed = JSON.parse(raw) as UsageStats;

      return {
        firstUseDate: typeof parsed.firstUseDate === 'string' ? parsed.firstUseDate : null,
        days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
      };
    } catch {
      return { firstUseDate: null, days: {} };
    }
  }

  private write(stats: UsageStats) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(stats));
  }
}

function localDayStart(date: Date) {
  return new Date(`${localDay(date)}T00:00:00`);
}

export const usageStatsRepository = new UsageStatsRepository();
