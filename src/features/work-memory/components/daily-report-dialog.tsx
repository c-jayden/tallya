import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AiTaskAlert } from '../hooks/use-ai-task-coordinator';
import { AiBusyCloseConfirmDialog } from './ai-busy-close-confirm-dialog';
import { preventReportDialogDismissWhenBusy } from './report-dialog-state';
import { TallyaDialogFooter } from './tallya-dialog-footer';
import { WorkMemoryAlerts } from './work-memory-alerts';

type DailyReportDialogProps = {
  open: boolean;
  dateLabel: string;
  reportText: string;
  isGenerating: boolean;
  aiAlert: AiTaskAlert | null;
  closeRequestId?: number;
  onOpenChange: (open: boolean) => void;
  onForceClose: () => void;
  onAfterForceClose?: () => void;
  onTextChange: (text: string) => void;
  onGenerateWithAI: () => void;
  onCopy: () => void;
};

export function DailyReportDialog({
  open,
  dateLabel,
  reportText,
  isGenerating,
  aiAlert,
  closeRequestId = 0,
  onOpenChange,
  onForceClose,
  onAfterForceClose,
  onTextChange,
  onGenerateWithAI,
  onCopy,
}: DailyReportDialogProps) {
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isAppCloseRequest, setIsAppCloseRequest] = useState(false);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const afterForceCloseRef = useRef<(() => void) | null>(null);

  function resetPendingCloseRequest() {
    afterForceCloseRef.current = null;
    setIsAppCloseRequest(false);
  }

  const requestClose = useCallback((afterForceClose?: () => void) => {
    afterForceCloseRef.current = afterForceClose ?? null;
    setIsAppCloseRequest(Boolean(afterForceClose));

    if (isGenerating) {
      setIsCloseConfirmOpen(true);
      return;
    }

    onOpenChange(false);
    afterForceClose?.();
  }, [isGenerating, onOpenChange]);

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

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    requestClose();
  }

  function handleBusyDismiss(event: { preventDefault: () => void }) {
    preventReportDialogDismissWhenBusy(isGenerating, event);

    if (isGenerating) {
      setIsCloseConfirmOpen(true);
    }
  }

  function handleForceClose() {
    const afterForceClose = afterForceCloseRef.current;

    resetPendingCloseRequest();
    setIsCloseConfirmOpen(false);
    onForceClose();
    afterForceClose?.();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          onEscapeKeyDown={handleBusyDismiss}
          onPointerDownOutside={handleBusyDismiss}
          className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(560px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(560px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              {dateLabel}整理
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              可直接编辑后复制，用在需要同步的一段文字里。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 px-6 pb-5">
            <WorkMemoryAlerts alert={aiAlert} />
            <Textarea
              className="block field-sizing-content max-h-[calc(100vh-300px)] min-h-40 w-full resize-none rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-sm leading-[1.6] text-app-ink shadow-none outline-none focus-visible:border-app-border-strong focus-visible:ring-0"
              value={reportText}
              onChange={(event) => onTextChange(event.currentTarget.value)}
              placeholder="这天还没有可整理的内容。"
            />
          </div>

          <TallyaDialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => requestClose()}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer gap-1.5 text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed [&_svg]:size-3.5"
              onClick={onGenerateWithAI}
              disabled={isGenerating || !reportText.trim()}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {isGenerating ? '整理中' : '用 AI 整理'}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={onCopy}
              disabled={!reportText.trim()}
            >
              复制
            </Button>
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
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
