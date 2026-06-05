import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { copyReportMarkdown, copyReportPlainText } from '../services/report-clipboard';
import { formatReportDateRange } from '../services/report-date';
import { reportService } from '../services/report-service';
import type { WeeklyReportContext, WeeklyReportDraft } from '../services/report-service';
import { normalizeReportContent } from '../report-view-model';
import type { Report } from '../types';

export function useWeeklyReportFlow() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [weeklyReportContext, setWeeklyReportContext] = useState<WeeklyReportContext | null>(null);
  const [weeklyReportDraft, setWeeklyReportDraft] = useState<WeeklyReportDraft | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [reportListItems, setReportListItems] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isReportListOpen, setIsReportListOpen] = useState(false);
  const [isReportDetailOpen, setIsReportDetailOpen] = useState(false);

  const loadContext = useCallback(async () => {
    setIsLoadingContext(true);

    try {
      setWeeklyReportContext(await reportService.getCurrentWeeklyReportContext());
    } catch (error) {
      const message = error instanceof Error ? error.message : '报告信息读取失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setReportListItems(await reportService.getAllReports());
    } catch (error) {
      const message = error instanceof Error ? error.message : '报告读取失败，请稍后重试。';

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
        const message = error instanceof Error ? error.message : '报告读取失败，请稍后重试。';

        toast.error(message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function openGenerateDialog() {
    setIsGenerateDialogOpen(true);
    void loadContext();
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
    if (isGeneratingReport || isSavingReport) {
      return;
    }

    setIsGenerateDialogOpen(false);
    setIsPreviewDialogOpen(false);
    setIsReportListOpen(false);
    setIsReportDetailOpen(false);
  }

  async function generateWeeklyReport() {
    if (isGeneratingReport) {
      return;
    }

    setIsGeneratingReport(true);

    try {
      const draft = await reportService.generateCurrentWeeklyReport();

      setWeeklyReportDraft(draft);
      setIsGenerateDialogOpen(false);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '周报生成失败，请稍后重试。';

      toast.error(message);
      await loadContext();
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function copyMarkdown() {
    if (!weeklyReportDraft) {
      return;
    }

    try {
      await copyReportMarkdown(weeklyReportDraft.generated.markdown);
      toast.success('已复制 Markdown');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function copyPlainText() {
    if (!weeklyReportDraft) {
      return;
    }

    try {
      await copyReportPlainText(weeklyReportDraft.generated, {
        title: getWeeklyReportCopyTitle(weeklyReportDraft),
      });
      toast.success('已复制纯文本');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试。';

      toast.error(message);
    }
  }

  async function saveWeeklyReport() {
    if (!weeklyReportDraft || isSavingReport) {
      return;
    }

    setIsSavingReport(true);

    try {
      await reportService.saveWeeklyReport(weeklyReportDraft);
      toast.success('周报已保存');
      setIsPreviewDialogOpen(false);
      setWeeklyReportDraft(null);
      setWeeklyReportContext(null);
      setSelectedReport(null);
      await loadReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : '周报保存失败，请稍后重试。';

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
      const draft = await reportService.generateWeeklyReportForRange(selectedReport);

      setWeeklyReportDraft(draft);
      setIsReportDetailOpen(false);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '周报生成失败，请稍后重试。';

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
    generateWeeklyReport,
    isGenerateDialogOpen,
    isGeneratingReport,
    isLoadingContext,
    isPreviewDialogOpen,
    isReportDetailOpen,
    isReportListOpen,
    isSavingReport,
    isReportBusy: isGeneratingReport || isSavingReport,
    hasSavedReports: reportListItems.length > 0,
    openGenerateDialog,
    openReportDetail,
    openReportList,
    regenerateSelectedReport,
    reportListItems,
    saveWeeklyReport,
    selectedReport,
    setIsGenerateDialogOpen,
    setIsPreviewDialogOpen,
    setIsReportDetailOpen,
    setIsReportListOpen,
    weeklyReportContext,
    weeklyReportDraft,
  };
}

function getWeeklyReportCopyTitle(draft: WeeklyReportDraft) {
  const title = draft.generated.title || '本周周报';

  return `${title}（${formatReportDateRange(draft.startDate, draft.endDate)}）`;
}

function getSavedReportCopyTitle(report: Report) {
  return `${report.title || '本周周报'}（${formatReportDateRange(report.startDate, report.endDate)}）`;
}
