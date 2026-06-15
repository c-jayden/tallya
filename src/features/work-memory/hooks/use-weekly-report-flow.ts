import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { copyReportMarkdown, copyReportPlainText } from '../services/report-clipboard';
import {
  formatReportDateRange,
  getCurrentWeekRange,
  getDefaultCustomReportRange,
  isValidReportDateRange,
} from '../services/report-date';
import { reportDraftRepository } from '../services/report-draft-repository';
import type { ReportProgress } from '../services/report-draft-repository';
import { reportService } from '../services/report-service';
import type {
  GapAnswer,
  ReportContext,
  ReportDraft,
  ReportSaveMode,
} from '../services/report-service';
import { normalizeReportContent } from '../report-view-model';
import type { Report, ReportGap, ReportGenerationType } from '../types';
import {
  createAiTask,
  type AiTaskCoordinatorControls,
} from './use-ai-task-coordinator';

type UseWeeklyReportFlowOptions = {
  aiTaskCoordinator?: AiTaskCoordinatorControls;
};

type ReportSaveIntent = {
  saveMode?: ReportSaveMode;
  overwriteReportId?: string;
};

export function useWeeklyReportFlow({ aiTaskCoordinator }: UseWeeklyReportFlowOptions = {}) {
  const defaultCustomRange = getDefaultCustomReportRange();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [reportType, setReportType] = useState<ReportGenerationType>('weekly');
  const [customStartDate, setCustomStartDate] = useState(defaultCustomRange.startDate);
  const [customEndDate, setCustomEndDate] = useState(defaultCustomRange.endDate);
  const [reportContext, setReportContext] = useState<ReportContext | null>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [reportListItems, setReportListItems] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isReportListOpen, setIsReportListOpen] = useState(false);
  const [isReportDetailOpen, setIsReportDetailOpen] = useState(false);
  const [reportGaps, setReportGaps] = useState<ReportGap[]>([]);
  const [isGapDialogOpen, setIsGapDialogOpen] = useState(false);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);
  const [reportSaveIntent, setReportSaveIntent] = useState<ReportSaveIntent | null>(null);
  // In-flight report progress recovered from a previous session; surfaced as a
  // restore prompt the next time the user clicks 整理.
  const [restoreProgress, setRestoreProgress] = useState<ReportProgress | null>(null);
  const [isRestorePromptOpen, setIsRestorePromptOpen] = useState(false);
  const currentWeekRange = getCurrentWeekRange();
  const hasCurrentWeekReport = reportListItems.some(
    (report) =>
      report.type === 'weekly' &&
      report.startDate === currentWeekRange.startDate &&
      report.endDate === currentWeekRange.endDate,
  );

  const loadContext = useCallback(async (
    nextReportType: ReportGenerationType = reportType,
    nextStartDate: string = customStartDate,
    nextEndDate: string = customEndDate,
  ) => {
    if (
      nextReportType === 'custom' &&
      !isValidReportDateRange(nextStartDate, nextEndDate)
    ) {
      setReportContext(null);
      return;
    }

    setIsLoadingContext(true);

    try {
      if (nextReportType === 'weekly') {
        const context = await reportService.getCurrentWeeklyReportContext();
        setReportContext({
          reportType: 'weekly',
          ...context,
        });
      } else {
        setReportContext(
          await reportService.getReportContext('custom', nextStartDate, nextEndDate),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '整理信息读取失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsLoadingContext(false);
    }
  }, [customEndDate, customStartDate, reportType]);

  const loadReports = useCallback(async () => {
    try {
      setReportListItems(await reportService.getAllReports());
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存记录读取失败，请稍后重试。';

      toast.error(message);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void reportService
      .getAllReports()
      .then((reports) => {
        if (isMounted) {
          setReportListItems(reports);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '保存记录读取失败，请稍后重试。';

        toast.error(message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function openGenerateDialogFresh() {
    const range = getDefaultCustomReportRange();

    setReportType('weekly');
    setCustomStartDate(range.startDate);
    setCustomEndDate(range.endDate);
    setReportContext(null);
    setIsGenerateDialogOpen(true);
    void loadContext('weekly', range.startDate, range.endDate);
  }

  function openGenerateDialog() {
    // If a previous session reached gap-fill or preview without saving, offer
    // to pick it back up instead of silently starting over.
    const pending = reportDraftRepository.get();

    if (pending) {
      setRestoreProgress(pending);
      setIsRestorePromptOpen(true);
      return;
    }

    openGenerateDialogFresh();
  }

  function restoreLastReport() {
    if (!restoreProgress) {
      return;
    }

    if (restoreProgress.stage === 'gap') {
      setReportType(restoreProgress.reportType);
      setCustomStartDate(restoreProgress.startDate);
      setCustomEndDate(restoreProgress.endDate);
      setReportSaveIntent(getReportSaveIntentFromProgress(restoreProgress));
      setReportGaps(restoreProgress.gaps);
      setIsGenerateDialogOpen(false);
      setIsRestorePromptOpen(false);
      setRestoreProgress(null);
      setIsGapDialogOpen(true);
      return;
    }

    setReportDraft(restoreProgress.draft);
    setReportSaveIntent(getReportSaveIntentFromDraft(restoreProgress.draft));
    setReportType(restoreProgress.draft.reportType);
    setCustomStartDate(restoreProgress.draft.startDate);
    setCustomEndDate(restoreProgress.draft.endDate);
    setIsRestorePromptOpen(false);
    setRestoreProgress(null);
    setIsPreviewDialogOpen(true);
  }

  function discardLastReport() {
    reportDraftRepository.clear();
    setRestoreProgress(null);
    setIsRestorePromptOpen(false);
    openGenerateDialogFresh();
  }

  function updateReportType(nextReportType: ReportGenerationType) {
    setReportType(nextReportType);
    void loadContext(nextReportType);
  }

  function updateCustomStartDate(nextStartDate: string) {
    setCustomStartDate(nextStartDate);
    void loadContext('custom', nextStartDate, customEndDate);
  }

  function updateCustomEndDate(nextEndDate: string) {
    setCustomEndDate(nextEndDate);
    void loadContext('custom', customStartDate, nextEndDate);
  }

  function openReportList() {
    setIsReportListOpen(true);
    void loadReports();
  }

  function openReportDetail(report: Report) {
    setSelectedReport(report);
    setIsReportListOpen(false);
    setIsReportDetailOpen(true);
  }

  function closeReportDialogs() {
    if (isGeneratingReport || isSavingReport || isDetectingGaps) {
      return;
    }

    setIsGenerateDialogOpen(false);
    setIsPreviewDialogOpen(false);
    setIsReportListOpen(false);
    setIsReportDetailOpen(false);
    setIsGapDialogOpen(false);
  }

  function backToGenerateFromGaps() {
    if (isGeneratingReport) {
      return;
    }

    setIsGapDialogOpen(false);
    setIsGenerateDialogOpen(true);
    void loadContext(reportType, customStartDate, customEndDate);
  }

  function getActiveRange() {
    return reportType === 'custom'
      ? { startDate: customStartDate, endDate: customEndDate }
      : currentWeekRange;
  }

  // Run the actual AI report generation (the gap-fill step happens before this).
  async function runGenerate(nextSaveIntent: ReportSaveIntent | null = reportSaveIntent) {
    setIsGeneratingReport(true);
    await aiTaskCoordinator?.beginTask('range-report');

    try {
      const draft =
        reportType === 'custom'
          ? await reportService.generateCustomRangeReport(customStartDate, customEndDate)
          : await reportService.generateCurrentWeeklyReport();

      const draftWithSaveIntent = applyReportSaveIntent(draft as ReportDraft, nextSaveIntent);

      setReportDraft(draftWithSaveIntent);
      // Persist immediately so a crash/refresh between here and save can be
      // recovered on the next 整理.
      reportDraftRepository.save({ stage: 'preview', draft: draftWithSaveIntent });
      setIsGapDialogOpen(false);
      setIsGenerateDialogOpen(false);
      setIsPreviewDialogOpen(true);
      await aiTaskCoordinator?.updateTask(createAiTask('range-report', 'completed'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '整理失败，请稍后重试。';

      await aiTaskCoordinator?.updateTask(createAiTask('range-report', 'failed', message));
      toast.error(message);
      await loadContext();
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function generateReport(nextSaveIntent: ReportSaveIntent | null = null) {
    if (isGeneratingReport || isDetectingGaps) {
      return;
    }

    if (reportType === 'custom' && !isValidReportDateRange(customStartDate, customEndDate)) {
      return;
    }

    // First ask the AI whether any important-but-thin thread is worth fleshing
    // out; if so, surface the gap dialog instead of generating right away.
    setIsDetectingGaps(true);
    await aiTaskCoordinator?.beginTask('report-gaps');

    let gaps: ReportGap[];
    const { startDate, endDate } = getActiveRange();
    setReportSaveIntent(nextSaveIntent);

    try {
      gaps = await reportService.getReportGaps(startDate, endDate);
    } finally {
      setIsDetectingGaps(false);
    }

    if (gaps.length > 0) {
      reportDraftRepository.save({
        stage: 'gap',
        reportType,
        startDate,
        endDate,
        ...nextSaveIntent,
        gaps,
      });
      setReportGaps(gaps);
      setIsGapDialogOpen(true);
      await aiTaskCoordinator?.updateTask(createAiTask('report-gaps', 'needs-input'));
      return;
    }

    await runGenerate(nextSaveIntent);
  }

  async function submitGapAnswers(answers: GapAnswer[]) {
    if (isGeneratingReport) {
      return;
    }

    try {
      await reportService.saveGapAnswers(answers);
    } catch (error) {
      const message = error instanceof Error ? error.message : '补充保存失败，请稍后重试。';

      toast.error(message);
      return;
    }

    await runGenerate(reportSaveIntent);
  }

  async function skipGaps() {
    if (isGeneratingReport) {
      return;
    }

    await runGenerate(reportSaveIntent);
  }

  async function copyMarkdown() {
    if (!reportDraft) {
      return;
    }

    try {
      await copyReportMarkdown(reportDraft.generated.markdown);
      toast.success('已复制 Markdown');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function copyPlainText() {
    if (!reportDraft) {
      return;
    }

    try {
      await copyReportPlainText(reportDraft.generated, {
        title: getReportCopyTitle(reportDraft),
      });
      toast.success('已复制纯文本');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function saveReportPreview() {
    if (!reportDraft || isSavingReport) {
      return;
    }

    setIsSavingReport(true);

    try {
      await reportService.saveReport(reportDraft);
      reportDraftRepository.clear();
      toast.success(reportDraft.reportType === 'custom' ? '总结已保存' : '本周回顾已保存');
      setIsPreviewDialogOpen(false);
      setReportDraft(null);
      setReportSaveIntent(null);
      setReportContext(null);
      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsSavingReport(false);
    }
  }

  async function copySavedReportMarkdown() {
    if (!selectedReport) {
      return;
    }

    try {
      const markdown = normalizeReportContent(selectedReport.content).markdown;

      await copyReportMarkdown(markdown);
      toast.success('已复制 Markdown');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function copySavedReportPlainText() {
    if (!selectedReport) {
      return;
    }

    try {
      await copyReportPlainText(normalizeReportContent(selectedReport.content), {
        title: getSavedReportCopyTitle(selectedReport),
      });
      toast.success('已复制纯文本');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function regenerateSelectedReport() {
    if (!selectedReport || isGeneratingReport) {
      return;
    }

    setIsGeneratingReport(true);
    await aiTaskCoordinator?.beginTask('range-report');

    try {
      const draft = await reportService.generateReportForRange(selectedReport);

      setReportDraft(draft);
      reportDraftRepository.save({ stage: 'preview', draft });
      setIsReportDetailOpen(false);
      setIsPreviewDialogOpen(true);
      await aiTaskCoordinator?.updateTask(createAiTask('range-report', 'completed'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '整理失败，请稍后重试。';

      await aiTaskCoordinator?.updateTask(createAiTask('range-report', 'failed', message));
      toast.error(message);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  return {
    closeReportDialogs,
    copyMarkdown,
    copyPlainText,
    copySavedReportMarkdown,
    copySavedReportPlainText,
    customEndDate,
    customStartDate,
    generateReport,
    isGenerateDialogOpen,
    isGeneratingReport,
    isLoadingContext,
    isPreviewDialogOpen,
    isReportDetailOpen,
    isReportListOpen,
    isSavingReport,
    isDetectingGaps,
    isReportBusy: isGeneratingReport || isSavingReport || isDetectingGaps,
    reportGaps,
    isGapDialogOpen,
    setIsGapDialogOpen,
    backToGenerateFromGaps,
    submitGapAnswers,
    skipGaps,
    hasSavedReports: reportListItems.length > 0,
    hasCurrentWeekReport,
    openGenerateDialog,
    isRestorePromptOpen,
    setIsRestorePromptOpen,
    restoreLastReport,
    discardLastReport,
    openReportDetail,
    openReportList,
    reloadReports: loadReports,
    regenerateSelectedReport,
    reportListItems,
    reportContext,
    reportDraft,
    reportType,
    saveReportPreview,
    selectedReport,
    setIsGenerateDialogOpen,
    setIsPreviewDialogOpen,
    setIsReportDetailOpen,
    setIsReportListOpen,
    setReportType: updateReportType,
    updateCustomEndDate,
    updateCustomStartDate,
  };
}

function applyReportSaveIntent(
  draft: ReportDraft,
  saveIntent: ReportSaveIntent | null,
): ReportDraft {
  if (!saveIntent?.saveMode && !saveIntent?.overwriteReportId) {
    return draft;
  }

  return {
    ...draft,
    existingReport: saveIntent.saveMode === 'create' ? null : draft.existingReport,
    saveMode: saveIntent.saveMode,
    overwriteReportId: saveIntent.overwriteReportId,
  };
}

function getReportSaveIntentFromProgress(progress: ReportProgress): ReportSaveIntent | null {
  if (progress.stage === 'preview') {
    return getReportSaveIntentFromDraft(progress.draft);
  }

  if (!progress.saveMode && !progress.overwriteReportId) {
    return null;
  }

  return {
    saveMode: progress.saveMode,
    overwriteReportId: progress.overwriteReportId,
  };
}

function getReportSaveIntentFromDraft(draft: ReportDraft): ReportSaveIntent | null {
  if (!draft.saveMode && !draft.overwriteReportId) {
    return null;
  }

  return {
    saveMode: draft.saveMode,
    overwriteReportId: draft.overwriteReportId,
  };
}

function getReportCopyTitle(draft: ReportDraft) {
  const fallbackTitle = draft.reportType === 'custom' ? '工作总结' : '本周回顾';
  const title = draft.generated.title || fallbackTitle;

  return `${title}（${formatReportDateRange(draft.startDate, draft.endDate)}）`;
}

function getSavedReportCopyTitle(report: Report) {
  const fallbackTitle = report.type === 'custom' ? '工作总结' : '本周回顾';

  return `${report.title || fallbackTitle}（${formatReportDateRange(report.startDate, report.endDate)}）`;
}
