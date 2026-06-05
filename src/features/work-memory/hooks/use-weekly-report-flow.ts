import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { copyReportMarkdown } from '../services/report-clipboard';
import { reportService } from '../services/report-service';
import type { WeeklyReportContext, WeeklyReportDraft } from '../services/report-service';

export function useWeeklyReportFlow() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [weeklyReportContext, setWeeklyReportContext] = useState<WeeklyReportContext | null>(null);
  const [weeklyReportDraft, setWeeklyReportDraft] = useState<WeeklyReportDraft | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

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

  function openGenerateDialog() {
    setIsGenerateDialogOpen(true);
    void loadContext();
  }

  function closeReportDialogs() {
    setIsGenerateDialogOpen(false);
    setIsPreviewDialogOpen(false);
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
      const message =
        error instanceof Error
          ? error.message
          : '周报生成失败，请稍后重试。';

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
      toast.success('周报已复制');
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '周报保存失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsSavingReport(false);
    }
  }

  return {
    closeReportDialogs,
    copyMarkdown,
    generateWeeklyReport,
    isGenerateDialogOpen,
    isGeneratingReport,
    isLoadingContext,
    isPreviewDialogOpen,
    isSavingReport,
    openGenerateDialog,
    saveWeeklyReport,
    setIsGenerateDialogOpen,
    setIsPreviewDialogOpen,
    weeklyReportContext,
    weeklyReportDraft,
  };
}
