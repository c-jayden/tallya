import { useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
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
import { formatReportDateRange, isValidReportDateRange } from '../services/report-date';
import type { ReportContext } from '../services/report-service';
import type { ReportGenerationType } from '../types';
import {
  getReportGenerateDialogState,
  preventReportDialogDismissWhenBusy,
  shouldAllowReportDialogOpenChange,
} from './report-dialog-state';
import { DatePickerPopover } from './date-picker-popover';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportGenerateDialogProps = {
  open: boolean;
  context: ReportContext | null;
  reportType: ReportGenerationType;
  customStartDate: string;
  customEndDate: string;
  isLoading: boolean;
  isGenerating: boolean;
  onOpenChange: (open: boolean) => void;
  onReportTypeChange: (reportType: ReportGenerationType) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onGenerate: () => void;
  onViewReports: () => void;
};

export function ReportGenerateDialog({
  open,
  context,
  reportType,
  customStartDate,
  customEndDate,
  isLoading,
  isGenerating,
  onOpenChange,
  onReportTypeChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onGenerate,
  onViewReports,
}: ReportGenerateDialogProps) {
  const [isOverwriteConfirmOpen, setIsOverwriteConfirmOpen] = useState(false);
  const availableMemoryCount = context?.entries.length ?? 0;
  const availableDayCount = context
    ? new Set(context.entries.map((entry) => entry.occurredOn)).size
    : 0;
  const hasAvailableMemories = availableMemoryCount > 0;
  const hasExistingReport = Boolean(context?.existingReport);
  const isRangeValid =
    reportType === 'weekly' || isValidReportDateRange(customStartDate, customEndDate);
  const dialogState = getReportGenerateDialogState({
    availableMemoryCount,
    hasExistingReport,
    isGenerating,
    isLoading,
    isRangeValid,
    reportType,
  });
  const existingReportCopy =
    reportType === 'custom'
      ? '这个时间范围已保存过整理结果，重新整理会覆盖原内容。'
      : '本周已经保存过整理结果，重新整理会覆盖原内容。';
  const countCopy =
    reportType === 'custom'
      ? `该范围内 ${availableDayCount} 天 · ${availableMemoryCount} 条记录`
      : `本周 ${availableDayCount} 天 · ${availableMemoryCount} 条记录`;

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
              整理一段时间
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              把这段时间的记录收拢成一份可保存的总结。
            </DialogDescription>
          </DialogHeader>
          <div className="grid shrink-0 gap-3.5 px-6 pb-4">
            <div className="inline-flex w-fit rounded-xl bg-app-surface-muted p-1">
              <ReportTypeButton
                active={reportType === 'weekly'}
                label="本周回顾"
                onClick={() => onReportTypeChange('weekly')}
              />
              <ReportTypeButton
                active={reportType === 'custom'}
                label="自定义时间"
                onClick={() => onReportTypeChange('custom')}
              />
            </div>
            {reportType === 'custom' ? (
              <div className="grid gap-2.5">
                <span className="text-sm leading-5 font-semibold text-app-ink">时间范围</span>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
                  <ReportDateInput
                    ariaLabel="选择开始日期"
                    value={customStartDate}
                    side="right"
                    onChange={onCustomStartDateChange}
                  />
                  <span className="text-[13px] text-app-ink-subtle">至</span>
                  <ReportDateInput
                    ariaLabel="选择结束日期"
                    value={customEndDate}
                    side="left"
                    onChange={onCustomEndDateChange}
                  />
                </div>
              </div>
            ) : null}
            {reportType === 'weekly' ? (
              <ReportMetaRow
                label="时间范围"
                value={
                  context
                    ? formatReportDateRange(context.startDate, context.endDate)
                    : '正在读取时间范围'
                }
              />
            ) : null}
          </div>
          <TallyaScrollArea className="min-h-0 flex-1 px-6 pb-5">
            <div className="grid gap-4">
              <ReportMetaRow
                label="可整理内容"
                value={isLoading ? '正在统计可整理的记录' : countCopy}
              />
              {reportType === 'custom' && !isRangeValid ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  开始日期不能晚于结束日期。
                </p>
              ) : null}
              {!isLoading && availableMemoryCount === 1 ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  记录较少，整理结果可能会短一些。
                </p>
              ) : null}
              {!isLoading && !hasAvailableMemories ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  这个时间范围里还没有可整理的记录。
                </p>
              ) : null}
              {!isLoading && hasExistingReport ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  {existingReportCopy}
                </p>
              ) : null}
            </div>
          </TallyaScrollArea>
          <TallyaDialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onViewReports}
              disabled={!dialogState.canClose}
            >
              查看整理记录
            </Button>
            <div className="flex items-center gap-2">
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
                  className="h-9 min-w-24 cursor-pointer gap-2 rounded-xl bg-app-accent px-3.5 text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-ink-muted disabled:opacity-100 disabled:hover:bg-app-surface-muted"
                  onClick={handleGenerateClick}
                  disabled={dialogState.primaryDisabled}
                  aria-busy={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : null}
                  {dialogState.primaryLabel}
                </Button>
              ) : null}
            </div>
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isOverwriteConfirmOpen} onOpenChange={setIsOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reportType === 'custom' ? '重新整理这段时间？' : '重新整理本周？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              重新整理会覆盖当前保存的内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleConfirmOverwrite}>
              重新整理
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

function ReportTypeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        'h-8 cursor-pointer rounded-lg px-3 text-[13px] leading-5 transition-colors duration-150',
        active
          ? 'bg-app-surface text-app-ink shadow-[0_1px_2px_rgb(15_23_42/0.06)]'
          : 'bg-transparent text-app-ink-muted hover:text-app-ink',
      ].join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ReportDateInput({
  ariaLabel,
  value,
  side,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  side: 'left' | 'right';
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <DatePickerPopover
        ariaLabel={ariaLabel}
        value={value}
        side={side}
        align="center"
        triggerClassName="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-app-border bg-app-surface px-3 text-left text-[13px] text-app-ink outline-none transition-colors duration-150 hover:border-app-border-strong focus-visible:border-app-border-strong focus-visible:outline-none"
        onChange={onChange}
      >
        <span>{formatReportDatePickerValue(value)}</span>
        <CalendarDays className="size-3.5 shrink-0 text-app-ink-subtle" aria-hidden="true" />
      </DatePickerPopover>
    </div>
  );
}

function formatReportDatePickerValue(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return `${year}年${month}月${day}日`;
}
