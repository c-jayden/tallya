import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reportListEmptyState } from '../report-view-model';
import type { Report } from '../types';
import { ReportListItem } from './report-list-item';

type ReportListDialogProps = {
  open: boolean;
  reports: Report[];
  onOpenChange: (open: boolean) => void;
  onOpenReport: (report: Report) => void;
};

export function ReportListDialog({
  open,
  reports,
  onOpenChange,
  onOpenReport,
}: ReportListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            整理记录
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            查看已经保存的阶段整理。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-184px)] flex-1 px-6 pb-5">
          {reports.length > 0 ? (
            <div className="grid gap-2">
              {reports.map((report) => (
                <ReportListItem key={report.id} report={report} onOpen={onOpenReport} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <strong className="block text-sm font-semibold text-app-ink">
                {reportListEmptyState.title}
              </strong>
              <p className="mt-2 text-[13px] leading-[1.5] text-app-ink-muted">
                {reportListEmptyState.description}
              </p>
            </div>
          )}
        </TallyaScrollArea>
      </DialogContent>
    </Dialog>
  );
}
