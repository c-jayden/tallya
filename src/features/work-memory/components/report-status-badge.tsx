import { cn } from '@/lib/utils';
import { getReportStatusLabel } from '../report-view-model';
import type { ReportStatus } from '../types';

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const isStale = status === 'stale';

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-[11px] leading-none font-medium',
        isStale
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
          : 'bg-app-surface-muted text-app-ink-muted',
      )}
    >
      {getReportStatusLabel(status)}
    </span>
  );
}
