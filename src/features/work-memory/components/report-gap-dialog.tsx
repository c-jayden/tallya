import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import type { GapAnswer } from '../services/report-service';
import type { ReportGap } from '../types';
import {
  preventReportDialogDismissWhenBusy,
  shouldAllowReportDialogOpenChange,
} from './report-dialog-state';
import { AiBusyCloseConfirmDialog } from './ai-busy-close-confirm-dialog';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportGapDialogProps = {
  open: boolean;
  gaps: ReportGap[];
  isGenerating: boolean;
  closeRequestId?: number;
  onAfterForceClose?: () => void;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onSubmit: (answers: GapAnswer[]) => void;
  onSkip: () => void;
};

// Pre-generation step: the AI flagged a few important-but-thin threads and asks
// one question each. Answers are optional — the user can flesh out what they
// want and skip the rest, or skip entirely and generate as-is.
export function ReportGapDialog({
  open,
  gaps,
  isGenerating,
  closeRequestId = 0,
  onAfterForceClose,
  onOpenChange,
  onBack,
  onSubmit,
  onSkip,
}: ReportGapDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isAppCloseRequest, setIsAppCloseRequest] = useState(false);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const afterForceCloseRef = useRef<(() => void) | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (shouldAllowReportDialogOpenChange(nextOpen, isGenerating)) {
      if (!nextOpen) {
        setAnswers({});
      }

      onOpenChange(nextOpen);
    }
  }

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

    setAnswers({});
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

  function handleSubmit() {
    const collected: GapAnswer[] = gaps
      .map((gap) => ({
        entryId: gap.entryId,
        question: gap.question,
        answer: (answers[gap.entryId] ?? '').trim(),
      }))
      .filter((answer) => answer.answer.length > 0);

    setAnswers({});
    onSubmit(collected);
  }

  function handleSkip() {
    setAnswers({});
    onSkip();
  }

  function handleForceClose() {
    const afterForceClose = afterForceCloseRef.current;

    resetPendingCloseRequest();
    setIsCloseConfirmOpen(false);
    setAnswers({});
    onOpenChange(false);
    afterForceClose?.();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          closeButtonDisabled={isGenerating}
          onEscapeKeyDown={(event) => preventReportDialogDismissWhenBusy(isGenerating, event)}
          onPointerDownOutside={(event) => preventReportDialogDismissWhenBusy(isGenerating, event)}
          className="tallya-dialog-content flex max-h-[calc(100vh-72px)] w-[min(540px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(540px,calc(100vw-48px))]"
        >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            补充几句，让整理更完整
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            这几条线索这周反复出现但记得比较简略，补一句会更好写（可跳过）。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 flex-1 px-6 pb-4">
          <div className="grid gap-3.5">
            {gaps.map((gap) => (
              <div key={gap.entryId} className="grid gap-1.5">
                {gap.threadTitle ? (
                  <p className="text-[12px] leading-[1.4] font-medium text-app-ink-subtle">
                    《{gap.threadTitle}》
                  </p>
                ) : null}
                <p className="text-[13.5px] leading-[1.5] text-app-ink">{gap.question}</p>
                <Textarea
                  className="field-sizing-content max-h-40 min-h-16 w-full resize-none rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm leading-6 text-app-ink shadow-none outline-none focus-visible:border-app-border-strong focus-visible:ring-0"
                  value={answers[gap.entryId] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [gap.entryId]: event.currentTarget.value }))
                  }
                  placeholder="写一两句就好，留空也可以跳过"
                  disabled={isGenerating}
                />
              </div>
            ))}
          </div>
        </TallyaScrollArea>
        <TallyaDialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onBack}
            disabled={isGenerating}
          >
            返回
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={handleSkip}
              disabled={isGenerating}
            >
              跳过，直接整理
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={handleSubmit}
              disabled={isGenerating}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              补充并整理
            </Button>
          </div>
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
