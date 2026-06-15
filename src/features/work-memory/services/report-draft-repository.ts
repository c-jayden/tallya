import type { ReportDraft } from './report-service';

// Persists a generated-but-unsaved report so a refresh, crash, or app restart
// doesn't throw away an AI run the user hasn't saved yet. Cleared the moment the
// report is saved (or the user chooses to start over).
const STORAGE_KEY = 'tallya.report.unsaved-draft.v1';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export type ReportDraftRepository = {
  get(): ReportDraft | null;
  save(draft: ReportDraft): void;
  clear(): void;
};

export function createReportDraftRepository(
  storage: Storage | null = getBrowserStorage(),
): ReportDraftRepository {
  return {
    get() {
      const raw = storage?.getItem(STORAGE_KEY);

      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;

        return isReportDraft(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(draft: ReportDraft) {
      storage?.setItem(STORAGE_KEY, JSON.stringify(draft));
    },
    clear() {
      storage?.removeItem(STORAGE_KEY);
    },
  };
}

function isReportDraft(value: unknown): value is ReportDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.reportType === 'weekly' || candidate.reportType === 'custom') &&
    typeof candidate.startDate === 'string' &&
    typeof candidate.endDate === 'string' &&
    Boolean(candidate.generated) &&
    typeof candidate.generated === 'object'
  );
}

export const reportDraftRepository = createReportDraftRepository();
