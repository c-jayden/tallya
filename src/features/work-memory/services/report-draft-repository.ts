import type { ReportDraft } from './report-service';
import type { ReportSaveMode } from './report-service';
import type { ReportGap, ReportGenerationType } from '../types';

// Persists in-flight report progress so a refresh, crash, or app restart doesn't
// throw away work the user hasn't saved yet. Two stages are recoverable:
//   - 'gap':     the AI found thin threads and the supplement dialog is showing
//                (no result generated yet).
//   - 'preview': a report has been generated and is waiting to be saved.
// Cleared the moment the report is saved (or the user chooses to start over).
const STORAGE_KEY = 'tallya.report.unsaved-draft.v1';

export type ReportProgress =
  | {
      stage: 'gap';
      reportType: ReportGenerationType;
      startDate: string;
      endDate: string;
      saveMode?: ReportSaveMode;
      overwriteReportId?: string;
      gaps: ReportGap[];
    }
  | {
      stage: 'preview';
      draft: ReportDraft;
    };

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export type ReportDraftRepository = {
  get(): ReportProgress | null;
  save(progress: ReportProgress): void;
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

        if (isReportProgress(parsed)) {
          return parsed;
        }

        if (isReportDraft(parsed)) {
          return { stage: 'preview', draft: parsed };
        }

        return null;
      } catch {
        return null;
      }
    },
    save(progress: ReportProgress) {
      storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
    },
    clear() {
      storage?.removeItem(STORAGE_KEY);
    },
  };
}

function isReportProgress(value: unknown): value is ReportProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.stage === 'gap') {
    return (
      (candidate.reportType === 'weekly' || candidate.reportType === 'custom') &&
      typeof candidate.startDate === 'string' &&
      typeof candidate.endDate === 'string' &&
      Array.isArray(candidate.gaps)
    );
  }

  if (candidate.stage === 'preview') {
    const draft = candidate.draft as Record<string, unknown> | undefined;

    return (
      Boolean(draft) &&
      typeof draft === 'object' &&
      (draft.reportType === 'weekly' || draft.reportType === 'custom') &&
      typeof draft.startDate === 'string' &&
      typeof draft.endDate === 'string' &&
      Boolean(draft.generated) &&
      typeof draft.generated === 'object'
    );
  }

  return false;
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
