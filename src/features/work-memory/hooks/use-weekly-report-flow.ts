import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { copyReportMarkdown, copyReportPlainText } from '../services/report-clipboard';
import {
  formatReportDateRange,
  getCurrentWeekRange,
  getDefaultCustomReportRange,
  isValidReportDateRange,
} from '../services/report-date';
import { reportService } from '../services/report-service';
import type { GapAnswer, ReportContext, ReportDraft } from '../services/report-service';
import { normalizeReportContent } from '../report-view-model';
import type { Report, ReportGap, ReportGenerationType } from '../types';

export function useWeeklyReportFlow() {
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

  function openGenerateDialog() {
    const range = getDefaultCustomReportRange();

    setReportType('weekly');
    setCustomStartDate(range.startDate);
    setCustomEndDate(range.endDate);
    setReportContext(null);
    setIsGenerateDialogOpen(true);
    void loadContext('weekly', range.startDate, range.endDate);
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

  function getActiveRange() {
    return reportType === 'custom'
      ? { startDate: customStartDate, endDate: customEndDate }
      : currentWeekRange;
  }

  // Run the actual AI report generation (the gap-fill step happens before this).
  async function runGenerate() {
    setIsGeneratingReport(true);

    try {
      const draft =
        reportType === 'custom'
          ? await reportService.generateCustomRangeReport(customStartDate, customEndDate)
          : await reportService.generateCurrentWeeklyReport();

      setReportDraft(draft as ReportDraft);
      setIsGapDialogOpen(false);
      setIsGenerateDialogOpen(false);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '整理失败，请稍后重试。';

      toast.error(message);
      await loadContext();
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function generateReport() {
    if (isGeneratingReport || isDetectingGaps) {
      return;
    }

    if (reportType === 'custom' && !isValidReportDateRange(customStartDate, customEndDate)) {
      return;
    }

    // First ask the AI whether any important-but-thin thread is worth fleshing
    // out; if so, surface the gap dialog instead of generating right away.
    setIsDetectingGaps(true);

    let gaps: ReportGap[];

    try {
      const { startDate, endDate } = getActiveRange();
      gaps = await reportService.getReportGaps(startDate, endDate);
    } finally {
      setIsDetectingGaps(false);
    }

    if (gaps.length > 0) {
      setReportGaps(gaps);
      setIsGapDialogOpen(true);
      return;
    }

    await runGenerate();
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

    await runGenerate();
  }

  async function skipGaps() {
    if (isGeneratingReport) {
      return;
    }

    await runGenerate();
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
      toast.success(reportDraft.reportType === 'custom' ? '总结已保存' : '本周回顾已保存');
      setIsPreviewDialogOpen(false);
      setReportDraft(null);
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

    try {
      const draft = await reportService.generateReportForRange(selectedReport);

      setReportDraft(draft);
      setIsReportDetailOpen(false);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '整理失败，请稍后重试。';

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
    submitGapAnswers,
    skipGaps,
    hasSavedReports: reportListItems.length > 0,
    hasCurrentWeekReport,
    openGenerateDialog,
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

function getReportCopyTitle(draft: ReportDraft) {
  const fallbackTitle = draft.reportType === 'custom' ? '工作总结' : '本周回顾';
  const title = draft.generated.title || fallbackTitle;

  return `${title}（${formatReportDateRange(draft.startDate, draft.endDate)}）`;
}

function getSavedReportCopyTitle(report: Report) {
  const fallbackTitle = report.type === 'custom' ? '工作总结' : '本周回顾';

  return `${report.title || fallbackTitle}（${formatReportDateRange(report.startDate, report.endDate)}）`;
}
