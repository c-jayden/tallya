import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { copyDailyMemoryReport } from '../daily-memory-clipboard';
import type { DailyMemory } from '../../types';

describe('copyDailyMemoryReport', () => {
  it('copies formatted daily report text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyDailyMemoryReport(createMemory({ dailyReportText: '今日完成了设置页数据管理修复。' }), {
      writeText,
    });

    expect(writeText).toHaveBeenCalledWith('今日完成了设置页数据管理修复。');
  });

  it('copies fallback text for old memories without dailyReportText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyDailyMemoryReport(
      createMemory({
        summary: '整理需求讨论并同步后续计划。',
        completedItems: ['整理需求讨论内容'],
      }),
      { writeText },
    );

    expect(writeText).toHaveBeenCalledWith('整理需求讨论并同步后续计划。');
  });

  it('does not depend on the AI provider during copy', () => {
    const source = readFileSync(new URL('../daily-memory-clipboard.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('aiService');
    expect(source).not.toContain('Provider');
  });

  it('fails with a friendly message when no copyable content exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      copyDailyMemoryReport(createMemory({ summary: '', completedItems: [] }), { writeText }),
    ).rejects.toThrow('暂无可复制的日报内容');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns a friendly error when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));

    await expect(copyDailyMemoryReport(createMemory({ summary: '整理需求。' }), { writeText })).rejects.toThrow(
      '复制失败，请稍后重试',
    );
  });
});

function createMemory(generated: Partial<NonNullable<DailyMemory['generated']>>): DailyMemory {
  return {
    id: 'daily-memory-2026-06-08',
    date: '2026-06-08',
    rawContent: '',
    supplements: {},
    generated: {
      summary: generated.summary ?? '整理需求。',
      completedItems: generated.completedItems ?? [],
      dailyReportText: generated.dailyReportText,
    },
    status: 'generated',
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T02:00:00.000Z',
  };
}
