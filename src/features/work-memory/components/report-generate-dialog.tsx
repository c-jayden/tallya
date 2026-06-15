import { useCallback, useEffect, useRef, useState } from 'react';
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
} from './report-dialog-state';
import { AiBusyCloseConfirmDialog } from './ai-busy-close-confirm-dialog';
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
  closeRequestId?: number;
  onAfterForceClose?: () => void;
  onOpenChange: (open: boolean) => void;
  onReportTypeChange: (reportType: ReportGenerationType) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onGenerate: (saveIntent?: ReportGenerateIntent) => void;
  onViewReports: () => void;
};

type ConfirmMode = 'exact' | 'overlap';

type ReportGenerateIntent =
  | {
      saveMode: 'create';
    }
  | {
      saveMode: 'overwrite';
      overwriteReportId: string;
    };

export function ReportGenerateDialog({
  open,
  context,
  reportType,
  customStartDate,
  customEndDate,
  isLoading,
  isGenerating,
  closeRequestId = 0,
  onAfterForceClose,
  onOpenChange,
  onReportTypeChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onGenerate,
  onViewReports,
}: ReportGenerateDialogProps) {
  const [confirmMode, setConfirmMode] = useState<ConfirmMode | null>(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isAppCloseRequest, setIsAppCloseRequest] = useState(false);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const afterForceCloseRef = useRef<(() => void) | null>(null);
  const availableMemoryCount = context?.entries.length ?? 0;
  const availableDayCount = context
    ? new Set(context.entries.map((entry) => entry.occurredOn)).size
    : 0;
  const hasAvailableMemories = availableMemoryCount > 0;
  const hasExistingReport = Boolean(context?.existingReport);
  const overlappingReports = context?.overlappingReports ?? [];
  const hasOverlappingReports = overlappingReports.length > 0;
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
      ? '已有相同时间范围的整理，可以覆盖原整理，也可以新增一份。'
      : '已有相同时间范围的整理，可以覆盖原整理，也可以新增一份。';
  const countCopy =
    reportType === 'custom'
      ? `该范围内 ${availableDayCount} 天 · ${availableMemoryCount} 条记录`
      : `本周 ${availableDayCount} 天 · ${availableMemoryCount} 条记录`;

  function resetPendingCloseRequest() {
    afterForceCloseRef.current = null;
    setIsAppCloseRequest(false);
  }

  const requestClose = useCallback((afterForceClose?: () => void) => {
    afterForceCloseRef.current = afterForceClose ?? null;
    setIsAppCloseRequest(Boolean(afterForceClose));

    if (!dialogState.canClose) {
      setIsCloseConfirmOpen(true);
      return;
    }

    onOpenChange(false);
    afterForceClose?.();
  }, [dialogState.canClose, onOpenChange]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(nextOpen);
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
    if (!dialogState.canClose) {
      event.preventDefault();
      requestClose();
    }
  }

  function handleGenerateClick() {
    if (!dialogState.showPrimary || dialogState.primaryDisabled) {
      return;
    }

    if (hasExistingReport) {
      setConfirmMode('exact');
      return;
    }

    if (hasOverlappingReports) {
      setConfirmMode('overlap');
      return;
    }

    onGenerate();
  }

  function handleCreateDuplicate() {
    setConfirmMode(null);
    onGenerate({ saveMode: 'create' });
  }

  function handleConfirmOverwrite() {
    if (!context?.existingReport) {
      return;
    }

    setConfirmMode(null);
    onGenerate({
      saveMode: 'overwrite',
      overwriteReportId: context.existingReport.id,
    });
  }

  function handleContinueWithOverlap() {
    setConfirmMode(null);
    onGenerate();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          onEscapeKeyDown={handleDismissAttempt}
          onPointerDownOutside={handleDismissAttempt}
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
              {!isLoading && !hasExistingReport && hasOverlappingReports ? (
                <p className="rounded-lg bg-app-surface-muted px-3 py-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  已有整理记录和这个时间范围重叠，继续整理会新增一份。
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
                  onClick={() => requestClose()}
                >
                  取消
                </Button>
              ) : null}
              {dialogState.showPrimary ? (
                <Button
                  type="button"
                  variant="accent"
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
      <AlertDialog
        open={confirmMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmMode(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMode === 'exact'
                ? '已有相同时间范围的整理'
                : '已有整理记录和这个时间范围重叠'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMode === 'exact'
                ? '可以覆盖原整理，也可以保留原内容并新增一份。'
                : '继续整理会新增一份，不会改动已有记录。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            {confirmMode === 'exact' ? (
              <>
                <AlertDialogAction
                  variant="outline"
                  className="cursor-pointer"
                  onClick={handleCreateDuplicate}
                >
                  新增一份
                </AlertDialogAction>
                <AlertDialogAction className="cursor-pointer" onClick={handleConfirmOverwrite}>
                  覆盖原整理
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction className="cursor-pointer" onClick={handleContinueWithOverlap}>
                继续整理
              </AlertDialogAction>
            )}
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
