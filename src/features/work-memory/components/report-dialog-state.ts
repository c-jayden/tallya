import type { ReportGenerationType } from '../types';

export function shouldAllowReportDialogOpenChange(nextOpen: boolean, isBusy: boolean) {
  return nextOpen || !isBusy;
}

export function preventReportDialogDismissWhenBusy(
  isBusy: boolean,
  event: { preventDefault: () => void },
) {
  if (isBusy) {
    event.preventDefault();
  }
}

export function getReportGenerateActionLabel(
  hasExistingReport: boolean,
  isGenerating: boolean,
  reportType: ReportGenerationType = 'weekly',
) {
  if (isGenerating) {
    return hasExistingReport ? '重新整理中...' : '整理中...';
  }

  if (hasExistingReport) {
    return '重新整理';
  }

  return reportType === 'custom' ? '整理这段时间' : '整理本周';
}

export type ReportGenerateDialogState = {
  kind: 'emptyRange' | 'invalidRange' | 'ready' | 'reportExists' | 'generating';
  canClose: boolean;
  showCancel: boolean;
  cancelDisabled: boolean;
  showPrimary: boolean;
  primaryDisabled: boolean;
  primaryLabel: string;
};

export function getReportGenerateDialogState({
  availableMemoryCount,
  hasExistingReport,
  isGenerating,
  isLoading = false,
  isRangeValid = true,
  reportType = 'weekly',
}: {
  availableMemoryCount: number;
  hasExistingReport: boolean;
  isGenerating: boolean;
  isLoading?: boolean;
  isRangeValid?: boolean;
  reportType?: ReportGenerationType;
}): ReportGenerateDialogState {
  if (isGenerating) {
    return {
      kind: 'generating',
      canClose: false,
      showCancel: true,
      cancelDisabled: true,
      showPrimary: true,
      primaryDisabled: true,
      primaryLabel: getReportGenerateActionLabel(hasExistingReport, true, reportType),
    };
  }

  if (!isRangeValid) {
    return {
      kind: 'invalidRange',
      canClose: true,
      showCancel: true,
      cancelDisabled: false,
      showPrimary: true,
      primaryDisabled: true,
      primaryLabel: getReportGenerateActionLabel(hasExistingReport, false, reportType),
    };
  }

  if (isLoading || availableMemoryCount === 0) {
    return {
      kind: 'emptyRange',
      canClose: true,
      showCancel: true,
      cancelDisabled: false,
      showPrimary: false,
      primaryDisabled: false,
      primaryLabel: '',
    };
  }

  return {
    kind: hasExistingReport ? 'reportExists' : 'ready',
    canClose: true,
    showCancel: true,
    cancelDisabled: false,
    showPrimary: true,
    primaryDisabled: false,
    primaryLabel: getReportGenerateActionLabel(hasExistingReport, false, reportType),
  };
}
