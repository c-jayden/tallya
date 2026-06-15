import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, FileText, Loader2, RefreshCw, X } from 'lucide-react';
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
import { AiBusyCloseConfirmDialog } from './ai-busy-close-confirm-dialog';
import { ReportDocument } from './report-document';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportDetailDialogProps = {
  open: boolean;
  report: Report | null;
  isRegenerating: boolean;
  closeRequestId?: number;
  onAfterForceClose?: () => void;
  onOpenChange: (open: boolean) => void;
  onCopyText: () => void;
  onCopyMarkdown: () => void;
  onRegenerate: () => void;
};

export function ReportDetailDialog({
  open,
  report,
  isRegenerating,
  closeRequestId = 0,
  onAfterForceClose,
  onOpenChange,
  onCopyText,
  onCopyMarkdown,
  onRegenerate,
}: ReportDetailDialogProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isAppCloseRequest, setIsAppCloseRequest] = useState(false);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const afterForceCloseRef = useRef<(() => void) | null>(null);
  const content = report ? normalizeReportContent(report.content) : null;
  const isCustomReport = report?.type === 'custom';
  const isStale = report?.status === 'stale';

  function handleConfirmRegenerate() {
    setIsConfirmOpen(false);
    onRegenerate();
  }

  function resetPendingCloseRequest() {
    afterForceCloseRef.current = null;
    setIsAppCloseRequest(false);
  }

  const requestClose = useCallback((afterForceClose?: () => void) => {
    afterForceCloseRef.current = afterForceClose ?? null;
    setIsAppCloseRequest(Boolean(afterForceClose));

    if (isRegenerating) {
      setIsCloseConfirmOpen(true);
      return;
    }

    onOpenChange(false);
    afterForceClose?.();
  }, [isRegenerating, onOpenChange]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    requestClose();
  }

  useEffect(() => {
    if (closeRequestId === handledCloseRequestIdRef.current) {
      return;
    }

    handledCloseRequestIdRef.current = closeRequestId;

    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => requestClose(onAfterForceClose), 0);

    return () => window.clearTimeout(timeoutId);
  }, [closeRequestId, onAfterForceClose, open, requestClose]);

  function handleForceClose() {
    const afterForceClose = afterForceCloseRef.current;

    resetPendingCloseRequest();
    setIsCloseConfirmOpen(false);
    onOpenChange(false);
    afterForceClose?.();
  }

  function handleDismissAttempt(event: { preventDefault: () => void }) {
    if (isRegenerating) {
      event.preventDefault();
      requestClose();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          onEscapeKeyDown={handleDismissAttempt}
          onPointerDownOutside={handleDismissAttempt}
          className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              {isCustomReport ? '总结详情' : '本周回顾'}
            </DialogTitle>
          </DialogHeader>
          <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
            {isStale ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-[1.5] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                这份整理引用的工作记忆已更新，可以重新整理一次。
              </p>
            ) : null}
            <ReportDocument
              content={content}
              fallbackTitle={report?.title ?? (isCustomReport ? '工作总结' : '本周回顾')}
              showTitle
            />
          </TallyaScrollArea>
          <TallyaDialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => requestClose()}
            >
              <X className="size-4" aria-hidden="true" />
              关闭
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyText}
              disabled={!content || isRegenerating}
            >
              <Copy className="size-4" aria-hidden="true" />
              复制文本
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyMarkdown}
              disabled={!content?.markdown || isRegenerating}
            >
              <FileText className="size-4" aria-hidden="true" />
              复制 Markdown
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={() => setIsConfirmOpen(true)}
              disabled={!report || isRegenerating}
              aria-busy={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {isRegenerating ? '重新整理中...' : '重新整理'}
            </Button>
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCustomReport ? '重新整理这段时间？' : '重新整理本周？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              重新整理会覆盖当前保存的内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleConfirmRegenerate}>
              重新整理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AiBusyCloseConfirmDialog
        open={isCloseConfirmOpen}
        isAppCloseRequest={isAppCloseRequest}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            resetPendingCloseRequest();
          }

          setIsCloseConfirmOpen(nextOpen);
        }}
        onConfirm={handleForceClose}
      />
    </>
  );
}
