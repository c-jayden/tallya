import { describe, expect, it } from 'vitest';
import { mockProvider } from '../mock-provider';
import type { DailyMemory } from '../../../types';

describe('mockProvider', () => {
  it('generates a valid daily memory shape for development tests', async () => {
    await expect(
      mockProvider.generateDailyMemory(
        {
          date: '2026-06-08',
          rawContent: '整理需求讨论内容，确认后续计划。',
          supplements: {},
        },
        { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' },
      ),
    ).resolves.toMatchObject({
      summary: expect.any(String),
      completedItems: expect.any(Array),
    });
  });

  it('generates weekly and custom report content without exposing it to the UI', async () => {
    const memory = createMemory('2026-06-08');

    await expect(
      mockProvider.generateWeeklyReport(
        {
          startDate: '2026-06-08',
          endDate: '2026-06-14',
          reportLength: 'brief',
          reportTone: 'natural',
          reportFocus: 'outcomes',
          memories: [memory],
        },
        { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' },
      ),
    ).resolves.toMatchObject({
      title: expect.any(String),
      summary: expect.any(String),
      highlights: expect.any(Array),
      completedItems: expect.any(Array),
      markdown: expect.any(String),
    });

    await expect(
      mockProvider.generateRangeReport(
        {
          reportType: 'custom',
          startDate: '2026-06-08',
          endDate: '2026-06-08',
          reportLength: 'brief',
          reportTone: 'natural',
          reportFocus: 'outcomes',
          memories: [memory],
        },
        { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' },
      ),
    ).resolves.toMatchObject({
      title: expect.stringContaining('2026-06-08'),
      markdown: expect.any(String),
    });
  });
});

function createMemory(date: string): DailyMemory {
  return {
    id: `daily-memory-${date}`,
    date,
    rawContent: `${date} work memory`,
    supplements: {
      tomorrowPlan: '继续整理报告能力。',
    },
    generated: {
      summary: '整理报告能力。',
      completedItems: ['补齐报告流程'],
    },
    status: 'generated',
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T02:00:00.000Z`,
  };
}
