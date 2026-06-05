import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { Button } from '@/components/ui/button';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatReportDateRange } from '../services/report-date';
import type { WeeklyReportContext } from '../services/report-service';
import {
  getReportGenerateDialogState,
  preventReportDialogDismissWhenBusy,
  shouldAllowReportDialogOpenChange,
} from './report-dialog-state';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportGenerateDialogProps = {
  open: boolean;
  context: WeeklyReportContext | null;
  isLoading: boolean;
  isGenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: () => void;
};

export function ReportGenerateDialog({
  open,
  context,
  isLoading,
  isGenerating,
  onOpenChange,
  onGenerate,
}: ReportGenerateDialogProps) {
  const [isOverwriteConfirmOpen, setIsOverwriteConfirmOpen] = useState(false);
  const availableMemoryCount = context?.memories.length ?? 0;
  const hasAvailableMemories = availableMemoryCount > 0;
  const hasExistingReport = Boolean(context?.existingReport);
  const dialogState = getReportGenerateDialogState({
    availableMemoryCount,
    hasExistingReport,
    isGenerating,
    isLoading,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (shouldAllowReportDialogOpenChange(nextOpen, !dialogState.canClose)) {
      onOpenChange(nextOpen);
    }
  }

  function handleGenerateClick() {
    if (!dialogState.showPrimary || dialogState.primaryDisabled) {
      return;
    }

    if (hasExistingReport) {
      setIsOverwriteConfirmOpen(true);
      return;
    }

    onGenerate();
  }

  function handleConfirmOverwrite() {
    setIsOverwriteConfirmOpen(false);
    onGenerate();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          closeButtonDisabled={!dialogState.canClose}
          onEscapeKeyDown={(event) =>
            preventReportDialogDismissWhenBusy(!dialogState.canClose, event)
          }
          onPointerDownOutside={(event) =>
            preventReportDialogDismissWhenBusy(!dialogState.canClose, event)
          }
          className="tallya-dialog-content flex max-h-[calc(100vh-72px)] w-[min(540px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(540px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              生成报告
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              从已沉淀的工作记忆中整理一份报告。
            </DialogDescription>
          </DialogHeader>
          <TallyaScrollArea className="min-h-0 flex-1 px-6 pb-5">
            <div className="grid gap-5">
              <ReportMetaRow label="报告类型" value="本周周报" />
              <ReportMetaRow
                label="时间范围"
                value={
                  context
                    ? formatReportDateRange(context.startDate, context.endDate)
                    : '正在读取本周范围'
                }
              />
              <ReportMetaRow
                label="可用记忆"
                value={
                  isLoading ? '正在统计工作记忆' : `本周可用 ${availableMemoryCount} 条工作记忆`
                }
              />
              {!isLoading && availableMemoryCount === 1 ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  记忆较少时，周报内容可能偏简短。
                </p>
              ) : null}
              {!isLoading && !hasAvailableMemories ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  这个时间范围内还没有可用于生成报告的工作记忆。
                </p>
              ) : null}
              {!isLoading && hasExistingReport ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  本周周报已存在，重新生成会覆盖原报告。
                </p>
              ) : null}
            </div>
          </TallyaScrollArea>
          <TallyaDialogFooter>
            {dialogState.showCancel ? (
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
                onClick={() => handleOpenChange(false)}
                disabled={dialogState.cancelDisabled}
              >
                取消
              </Button>
            ) : null}
            {dialogState.showPrimary ? (
              <Button
                type="button"
                className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
                onClick={handleGenerateClick}
                disabled={dialogState.primaryDisabled}
              >
                {isGenerating ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {dialogState.primaryLabel}
              </Button>
            ) : null}
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isOverwriteConfirmOpen} onOpenChange={setIsOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成周报？</AlertDialogTitle>
            <AlertDialogDescription>重新生成会覆盖当前保存的周报。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleConfirmOverwrite}>
              重新生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReportMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm leading-5 font-semibold text-app-ink">{label}</span>
      <span className="text-[13px] leading-[1.5] text-app-ink-muted">{value}</span>
    </div>
  );
}
