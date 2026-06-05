import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatReportDateRange } from '../services/report-date';
import type { WeeklyReportContext } from '../services/report-service';

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
  const isGenerateDisabled = isLoading || isGenerating || !hasAvailableMemories;

  function handleGenerateClick() {
    if (isGenerateDisabled) {
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
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
          <div className="grid gap-5 px-6 pb-5">
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
              value={isLoading ? '正在统计工作记忆' : `已选择 ${availableMemoryCount} 条工作记忆`}
            />
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
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              取消
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={handleGenerateClick}
              disabled={isGenerateDisabled}
            >
              {isGenerating ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              生成周报
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isOverwriteConfirmOpen} onOpenChange={setIsOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本周周报已存在</AlertDialogTitle>
            <AlertDialogDescription>
              重新生成会覆盖原报告，但不会修改用于生成报告的工作记忆。
            </AlertDialogDescription>
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
