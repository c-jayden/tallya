import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../services/ai/ai-service';
import { assembleDailyReportSource, assemblePlainDailyReport } from '../services/daily-report';
import type { Clarification, Entry } from '../types';
import {
  createAiTask,
  type AiTaskCoordinatorControls,
} from './use-ai-task-coordinator';

type OpenInput = {
  date: string;
  entries: Entry[];
  clarificationsByEntry: Record<string, Clarification[]>;
};

type UseDailyReportFlowOptions = {
  aiTaskCoordinator?: AiTaskCoordinatorControls;
};

export function useDailyReportFlow({ aiTaskCoordinator }: UseDailyReportFlowOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Keep the day's material around so "用 AI 整理" can run without re-opening.
  const [source, setSource] = useState<OpenInput | null>(null);

  const open = useCallback((input: OpenInput) => {
    // Show an instant, paste-ready draft immediately; AI polish is opt-in.
    setSource(input);
    setReportText(assemblePlainDailyReport(input.entries, input.clarificationsByEntry));
    setIsGenerating(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const generateWithAI = useCallback(async () => {
    if (!source || isGenerating) {
      return;
    }

    const rawContent = assembleDailyReportSource(source.entries, source.clarificationsByEntry);

    if (!rawContent.trim()) {
      return;
    }

    setIsGenerating(true);
    await aiTaskCoordinator?.beginTask('daily-report');

    try {
      const generated = await aiService.generateDailyMemory({
        date: source.date,
        rawContent,
        supplements: {},
      });
      const text = generated.dailyReportText?.trim() || generated.summary.trim();

      if (text) {
        setReportText(text);
        await aiTaskCoordinator?.updateTask(createAiTask('daily-report', 'completed'));
      } else {
        toast.warning('AI 没有返回可用内容，已保留当前整理。');
        await aiTaskCoordinator?.updateTask(
          createAiTask('daily-report', 'failed', 'AI 没有返回可用内容，已保留当前整理。'),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI 整理失败，可以直接使用或编辑当前文本。';

      await aiTaskCoordinator?.updateTask(createAiTask('daily-report', 'failed', message));
      toast.error(
        message,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [aiTaskCoordinator, isGenerating, source]);

  const copy = useCallback(async () => {
    const text = reportText.trim();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制，可粘贴到需要同步的地方');
    } catch {
      toast.error('复制失败，可以手动选择文本复制。');
    }
  }, [reportText]);

  return {
    isOpen,
    reportText,
    isGenerating,
    open,
    close,
    generateWithAI,
    copy,
    setReportText,
  };
}
