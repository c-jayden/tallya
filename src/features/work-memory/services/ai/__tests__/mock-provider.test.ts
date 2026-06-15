import { describe, expect, it } from 'vitest';
import { mockProvider } from '../mock-provider';
import type { ReportSourceEntry } from '../../../types';

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
    const entry = createEntry('2026-06-08');

    await expect(
      mockProvider.generateWeeklyReport(
        {
          startDate: '2026-06-08',
          endDate: '2026-06-14',
          reportLength: 'brief',
          reportTone: 'natural',
          reportFocus: 'outcomes',
          reportStyleHint: '',
          entries: [entry],
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
          reportStyleHint: '',
          entries: [entry],
        },
        { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' },
      ),
    ).resolves.toMatchObject({
      title: expect.stringContaining('2026-06-08'),
      markdown: expect.any(String),
    });
  });

  it('analyzes report style for development tests', async () => {
    await expect(
      mockProvider.analyzeReportStyle?.(
        { sampleText: '今日完成：整理需求。' },
        { codexCommand: 'codex', codexModel: 'gpt-5.4-mini' },
      ),
    ).resolves.toMatchObject({
      summary: expect.any(String),
      promptHint: expect.any(String),
    });
  });
});

function createEntry(date: string): ReportSourceEntry {
  return {
    occurredOn: date,
    content: '整理报告能力。',
    clarifications: ['补齐报告流程'],
    threadTitle: null,
  };
}
