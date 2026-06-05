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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizeReportContent } from '../report-view-model';
import type { Report } from '../types';
import {
  preventReportDialogDismissWhenBusy,
  shouldAllowReportDialogOpenChange,
} from './report-dialog-state';
import { ReportDocument } from './report-document';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportDetailDialogProps = {
  open: boolean;
  report: Report | null;
  isRegenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyText: () => void;
  onCopyMarkdown: () => void;
  onRegenerate: () => void;
};

export function ReportDetailDialog({
  open,
  report,
  isRegenerating,
  onOpenChange,
  onCopyText,
  onCopyMarkdown,
  onRegenerate,
}: ReportDetailDialogProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const content = report ? normalizeReportContent(report.content) : null;

  function handleConfirmRegenerate() {
    setIsConfirmOpen(false);
    onRegenerate();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (shouldAllowReportDialogOpenChange(nextOpen, isRegenerating)) {
      onOpenChange(nextOpen);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          closeButtonDisabled={isRegenerating}
          onEscapeKeyDown={(event) => preventReportDialogDismissWhenBusy(isRegenerating, event)}
          onPointerDownOutside={(event) =>
            preventReportDialogDismissWhenBusy(isRegenerating, event)
          }
          className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              {report?.title || '周报详情'}
            </DialogTitle>
          </DialogHeader>
          <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
            <ReportDocument content={content} fallbackTitle={report?.title} showTitle={false} />
          </TallyaScrollArea>
          <TallyaDialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => handleOpenChange(false)}
              disabled={isRegenerating}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyText}
              disabled={!content || isRegenerating}
            >
              复制文本
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyMarkdown}
              disabled={!content?.markdown || isRegenerating}
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
              {isRegenerating ? '重新生成中...' : '重新生成'}
            </Button>
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成周报？</AlertDialogTitle>
            <AlertDialogDescription>重新生成会覆盖当前保存的周报。</AlertDialogDescription>
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
