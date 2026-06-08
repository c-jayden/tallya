import { describe, expect, it, vi } from 'vitest';
import { copyReportMarkdown, copyReportPlainText } from '../report-clipboard';
import type { GeneratedReportContent } from '../../types';

const content: GeneratedReportContent = {
  title: '本周周报',
  summary: '完成报告复制能力。',
  highlights: ['新增纯文本复制'],
  completedItems: ['补充复制测试'],
  problems: '',
  nextWeekPlan: '',
  markdown: '# 本周周报\n\n## 总结\n\n完成报告复制能力。',
};

describe('copyReportMarkdown', () => {
  it('writes markdown to clipboard without calling save logic', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const saveWeeklyReport = vi.fn();

    await copyReportMarkdown('# 本周周报', { writeText });

    expect(writeText).toHaveBeenCalledWith('# 本周周报');
    expect(saveWeeklyReport).not.toHaveBeenCalled();
  });

  it('normalizes markdown before copying it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyReportMarkdown('# 本周周报\n\n\n\n## 总结', { writeText });

    expect(writeText).toHaveBeenCalledWith('# 本周周报\n\n## 总结');
  });

  it('returns a friendly error when clipboard is unavailable', async () => {
    const originalClipboard = globalThis.navigator.clipboard;

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(copyReportMarkdown('# 本周周报')).rejects.toThrow('复制失败，请稍后重试。');
    } finally {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });
});

describe('copyReportPlainText', () => {
  it('writes plain text report content without markdown syntax', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyReportPlainText(
      content,
      { title: '本周周报（2026年6月1日 - 2026年6月7日）' },
      { writeText },
    );

    expect(writeText).toHaveBeenCalledWith(
      [
        '本周周报（2026年6月1日 - 2026年6月7日）',
        '',
        '总结：',
        '完成报告复制能力。',
        '',
        '本周重点：',
        '1. 新增纯文本复制',
        '',
        '完成事项：',
        '1. 补充复制测试',
      ].join('\n'),
    );
  });
});
