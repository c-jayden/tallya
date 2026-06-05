import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { normalizeReportContent } from '../report-view-model';
import type { Report } from '../types';
import { ReportDocument } from './report-document';

type ReportDetailDialogProps = {
  open: boolean;
  report: Report | null;
  isRegenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyMarkdown: () => void;
  onRegenerate: () => void;
};

export function ReportDetailDialog({
  open,
  report,
  isRegenerating,
  onOpenChange,
  onCopyMarkdown,
  onRegenerate,
}: ReportDetailDialogProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const content = report ? normalizeReportContent(report.content) : null;

  function handleConfirmRegenerate() {
    setIsConfirmOpen(false);
    onRegenerate();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              {report?.title || '周报详情'}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              这是已保存的工作报告。
            </DialogDescription>
          </DialogHeader>
          <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
            <ReportDocument content={content} fallbackTitle={report?.title} />
          </TallyaScrollArea>
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => onOpenChange(false)}
              disabled={isRegenerating}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyMarkdown}
              disabled={!content?.markdown}
            >
              复制 Markdown
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={() => setIsConfirmOpen(true)}
              disabled={!report || isRegenerating}
            >
              {isRegenerating ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              重新生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成报告</AlertDialogTitle>
            <AlertDialogDescription>重新生成会覆盖当前报告。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleConfirmRegenerate}>
              重新生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
