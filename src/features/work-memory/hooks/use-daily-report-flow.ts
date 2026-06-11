import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../services/ai/ai-service';
import { assembleDailyReportSource, assemblePlainDailyReport } from '../services/daily-report';
import type { Clarification, Entry } from '../types';

type OpenInput = {
  date: string;
  entries: Entry[];
  clarificationsByEntry: Record<string, Clarification[]>;
};

export function useDailyReportFlow() {
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

    try {
      const generated = await aiService.generateDailyMemory({
        date: source.date,
        rawContent,
        supplements: {},
      });
      const text = generated.dailyReportText?.trim() || generated.summary.trim();

      if (text) {
        setReportText(text);
      } else {
        toast.warning('AI 没有返回可用的日报文本，已保留原文整理。');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'AI 整理失败，可直接使用或编辑当前文本。',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, source]);

  const copy = useCallback(async () => {
    const text = reportText.trim();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('日报已复制，可粘贴到企业微信、钉钉等');
    } catch {
      toast.error('复制失败，请手动选择文本复制。');
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
