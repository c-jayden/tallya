import { describe, expect, it } from 'vitest';
import {
  getReportGenerateActionLabel,
  getReportGenerateDialogState,
  shouldAllowReportDialogOpenChange,
} from '../report-dialog-state';

describe('shouldAllowReportDialogOpenChange', () => {
  it('blocks close requests while a report dialog is busy', () => {
    expect(shouldAllowReportDialogOpenChange(false, true)).toBe(false);
  });

  it('allows open requests and idle close requests', () => {
    expect(shouldAllowReportDialogOpenChange(true, true)).toBe(true);
    expect(shouldAllowReportDialogOpenChange(false, false)).toBe(true);
  });
});

describe('getReportGenerateActionLabel', () => {
  it('uses regenerate labels when the current weekly report already exists', () => {
    expect(getReportGenerateActionLabel(true, false)).toBe('重新整理');
    expect(getReportGenerateActionLabel(true, true)).toBe('重新整理中...');
  });

  it('uses generate labels for a new weekly report', () => {
    expect(getReportGenerateActionLabel(false, false, 'weekly')).toBe('整理本周');
    expect(getReportGenerateActionLabel(false, false, 'custom')).toBe('整理这段时间');
    expect(getReportGenerateActionLabel(false, true)).toBe('整理中...');
  });
});

describe('getReportGenerateDialogState', () => {
  it('shows cancel and generate actions when memories are available and no report exists', () => {
    expect(
      getReportGenerateDialogState({
        availableMemoryCount: 2,
        hasExistingReport: false,
        isGenerating: false,
        reportType: 'weekly',
      }),
    ).toEqual({
      kind: 'ready',
      canClose: true,
      showCancel: true,
      cancelDisabled: false,
      showPrimary: true,
      primaryDisabled: false,
      primaryLabel: '整理本周',
    });
  });

  it('shows cancel and regenerate actions when the weekly report already exists', () => {
    expect(
      getReportGenerateDialogState({
        availableMemoryCount: 2,
        hasExistingReport: true,
        isGenerating: false,
        reportType: 'custom',
      }),
    ).toMatchObject({
      kind: 'reportExists',
      showCancel: true,
      showPrimary: true,
      primaryDisabled: false,
      primaryLabel: '重新整理',
    });
  });

  it('keeps a cancel action when the current range has no memories', () => {
    expect(
      getReportGenerateDialogState({
        availableMemoryCount: 0,
        hasExistingReport: false,
        isGenerating: false,
        reportType: 'custom',
      }),
    ).toMatchObject({
      kind: 'emptyRange',
      canClose: true,
      showCancel: true,
      showPrimary: false,
    });
  });

  it('keeps the cancel action available while generating so close can ask for confirmation', () => {
    expect(
      getReportGenerateDialogState({
        availableMemoryCount: 2,
        hasExistingReport: true,
        isGenerating: true,
        reportType: 'custom',
      }),
    ).toMatchObject({
      kind: 'generating',
      canClose: false,
      cancelDisabled: false,
      showPrimary: true,
      primaryDisabled: true,
      primaryLabel: '重新整理中...',
    });
  });

  it('disables custom report generation for an invalid range', () => {
    expect(
      getReportGenerateDialogState({
        availableMemoryCount: 2,
        hasExistingReport: false,
        isGenerating: false,
        isRangeValid: false,
        reportType: 'custom',
      }),
    ).toMatchObject({
      kind: 'invalidRange',
      canClose: true,
      showCancel: true,
      showPrimary: true,
      primaryDisabled: true,
      primaryLabel: '整理这段时间',
    });
  });
});
