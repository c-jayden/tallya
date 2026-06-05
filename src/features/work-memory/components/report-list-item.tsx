import {
  getReportGeneratedAtLabel,
  getReportRangeLabel,
  getReportTypeLabel,
} from '../report-view-model';
import type { Report } from '../types';
import { ReportStatusBadge } from './report-status-badge';

type ReportListItemProps = {
  report: Report;
  onOpen: (report: Report) => void;
};

export function ReportListItem({ report, onOpen }: ReportListItemProps) {
  const generatedAt = getReportGeneratedAtLabel(report);

  return (
    <button
      type="button"
      className="block w-full cursor-pointer rounded-xl border border-transparent bg-transparent px-3.5 py-3 text-left transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
      onClick={() => onOpen(report)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[14.5px] leading-[1.45] font-semibold text-app-ink">
            {report.title}
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.45] text-app-ink-muted">
            {getReportTypeLabel(report.type)} · {getReportRangeLabel(report)}
          </p>
          {generatedAt ? (
            <p className="mt-1 text-xs leading-[1.45] text-app-ink-subtle">
              生成时间：{generatedAt}
            </p>
          ) : null}
        </div>
        <ReportStatusBadge status={report.status} />
      </div>
    </button>
  );
}
