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

export function getReportGenerateActionLabel(hasExistingReport: boolean, isGenerating: boolean) {
  if (isGenerating) {
    return hasExistingReport ? '重新生成中...' : '生成中...';
  }

  return hasExistingReport ? '重新生成' : '生成周报';
}

export type ReportGenerateDialogState = {
  kind: 'emptyRange' | 'ready' | 'reportExists' | 'generating';
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
}: {
  availableMemoryCount: number;
  hasExistingReport: boolean;
  isGenerating: boolean;
  isLoading?: boolean;
}): ReportGenerateDialogState {
  if (isGenerating) {
    return {
      kind: 'generating',
      canClose: false,
      showCancel: true,
      cancelDisabled: true,
      showPrimary: true,
      primaryDisabled: true,
      primaryLabel: getReportGenerateActionLabel(hasExistingReport, true),
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
    primaryLabel: getReportGenerateActionLabel(hasExistingReport, false),
  };
}
