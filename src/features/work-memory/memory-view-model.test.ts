import { describe, expect, it } from 'vitest';
import {
  formatMemoryDateLabel,
  formatRecentMemoryDate,
  getMemoryStatusSummary,
  getWeeklySnapshotFromMemories,
} from './memory-view-model';
import type { DailyMemory } from './types';

describe('formatRecentMemoryDate', () => {
  it('shows today for the current date', () => {
    expect(formatRecentMemoryDate('2026-06-08', '2026-06-08')).toBe('今天');
  });

  it('shows yesterday only for the previous calendar date', () => {
    expect(formatRecentMemoryDate('2026-06-07', '2026-06-08')).toBe('昨天');
  });

  it('shows the actual date and weekday for older records', () => {
    expect(formatRecentMemoryDate('2026-06-05', '2026-06-08')).toBe('6月5日 周五');
  });

  it('handles yesterday across month boundaries', () => {
    expect(formatRecentMemoryDate('2026-02-28', '2026-03-01')).toBe('昨天');
  });
});

describe('formatMemoryDateLabel', () => {
  it('handles cross-year yesterday correctly', () => {
    expect(formatMemoryDateLabel('2025-12-31', '2026-01-01')).toBe('昨天');
  });
});

describe('getWeeklySnapshotFromMemories', () => {
  it('uses the latest formal memory as the recent record and excludes summaries', () => {
    const snapshot = getWeeklySnapshotFromMemories(
      [
        createMemory('2026-06-05', 'generated', 'old summary'),
        createMemory('2026-06-06', 'generated', 'latest summary'),
      ],
      '2026-06-08',
    );

    expect(snapshot).toEqual({
      settledDays: 0,
      lastMemoryDate: '6月6日 周六',
    });
    expect(snapshot).not.toHaveProperty('lastMemorySummary');
  });

  it('counts only generated and locked memories in the current week', () => {
    const snapshot = getWeeklySnapshotFromMemories(
      [
        createMemory('2026-06-08', 'generated'),
        createMemory('2026-06-10', 'locked'),
        createMemory('2026-06-11', 'draft'),
        createMemory('2026-06-05', 'generated'),
      ],
      '2026-06-12',
    );

    expect(snapshot.settledDays).toBe(2);
    expect(snapshot.lastMemoryDate).toBe('6月10日 周三');
  });

  it('does not use draft memories as the recent record', () => {
    const snapshot = getWeeklySnapshotFromMemories(
      [
        createMemory('2026-06-06', 'generated'),
        createMemory('2026-06-07', 'draft'),
      ],
      '2026-06-08',
    );

    expect(snapshot.lastMemoryDate).toBe('6月6日 周六');
  });

  it('does not show a current-week count for historical-only memories', () => {
    const snapshot = getWeeklySnapshotFromMemories(
      [createMemory('2026-05-29', 'generated')],
      '2026-06-08',
    );

    expect(snapshot.settledDays).toBe(0);
    expect(snapshot.lastMemoryDate).toBe('5月29日 周五');
  });
});

describe('getMemoryStatusSummary', () => {
  it('shows the empty state when there is no formal memory or current draft', () => {
    const summary = getStatusSummary({
      selectedDateMemory: null,
      memories: [],
    });

    expect(summary.title).toBe('还没有工作记忆');
    expect(summary.description).toBe('整理第一条记录后，这里会显示你的沉淀进度。');
    expect(summary.actions).toEqual({
      canViewDraft: false,
      canViewMemory: false,
      canViewReports: false,
      canGenerateReport: false,
    });
  });

  it('shows today draft state without report actions when there is no formal memory', () => {
    const draft = createMemory('2026-06-08', 'draft');
    const summary = getStatusSummary({
      selectedDateMemory: draft,
      memories: [draft],
    });

    expect(summary.title).toBe('今日草稿已保存');
    expect(summary.description).toBe('整理成今日记录后，会开始沉淀你的工作记忆。');
    expect(summary.actions).toEqual({
      canViewDraft: true,
      canViewMemory: false,
      canViewReports: false,
      canGenerateReport: false,
    });
  });

  it('shows today settled state when today has a formal memory', () => {
    const memory = createMemory('2026-06-08', 'generated');
    const summary = getStatusSummary({
      selectedDateMemory: memory,
      memories: [memory],
      hasReports: true,
    });

    expect(summary.title).toBe('今日记忆已沉淀');
    expect(summary.description).toBe('你可以继续补充内容并重新整理。');
    expect(summary.actions).toMatchObject({
      canViewMemory: true,
      canViewReports: true,
      canGenerateReport: true,
    });
  });

  it('shows selected historical settled state when that date has a formal memory', () => {
    const memory = createMemory('2026-06-06', 'generated');
    const summary = getStatusSummary({
      selectedDate: '2026-06-06',
      selectedDateMemory: memory,
      memories: [memory],
    });

    expect(summary.title).toBe('这天记忆已沉淀');
    expect(summary.description).toBe('当前正在查看/编辑 6月6日 周六 的工作记忆。');
  });

  it('shows selected historical missing state when other formal memories exist', () => {
    const summary = getStatusSummary({
      selectedDate: '2026-06-06',
      selectedDateMemory: null,
      memories: [createMemory('2026-06-05', 'generated')],
    });

    expect(summary.title).toBe('这天还没有工作记忆');
    expect(summary.description).toBe('写下几句后，可以沉淀为 6月6日 周六 的记录。');
    expect(summary.actions.canGenerateReport).toBe(true);
  });

  it('shows weekly settled days when today has no formal memory but this week has memories', () => {
    const summary = getStatusSummary({
      selectedDate: '2026-06-12',
      selectedDateMemory: null,
      memories: [createMemory('2026-06-09', 'generated'), createMemory('2026-06-10', 'locked')],
      todayDate: '2026-06-12',
    });

    expect(summary.title).toBe('本周已沉淀 2 天');
    expect(summary.description).toBe('最近记录：6月10日 周三');
  });

  it('shows historical settled state instead of a zero weekly count', () => {
    const summary = getStatusSummary({
      selectedDateMemory: null,
      memories: [createMemory('2026-05-29', 'generated')],
    });

    expect(summary.title).toBe('历史记忆已沉淀');
    expect(summary.description).toBe('最近记录：5月29日 周五');
  });

  it('does not count drafts as formal memory for weekly status or actions', () => {
    const summary = getStatusSummary({
      selectedDateMemory: null,
      memories: [createMemory('2026-06-06', 'draft')],
    });

    expect(summary.title).toBe('还没有工作记忆');
    expect(summary.actions.canGenerateReport).toBe(false);
  });

  it('does not fall back to history copy when only another date has a draft', () => {
    const summary = getStatusSummary({
      selectedDate: '2026-06-06',
      selectedDateMemory: null,
      memories: [createMemory('2026-06-08', 'draft')],
    });

    expect(summary.title).toBe('还没有工作记忆');
    expect(summary.description).not.toContain('最近记录');
  });

  it('does not call last Friday yesterday', () => {
    const summary = getStatusSummary({
      selectedDateMemory: null,
      memories: [createMemory('2026-06-05', 'generated')],
    });

    expect(summary.description).toBe('最近记录：6月5日 周五');
    expect(summary.description).not.toContain('昨天');
  });

  it('shows report actions only when reports exist and formal memories exist', () => {
    const memory = createMemory('2026-06-08', 'generated');

    expect(
      getStatusSummary({
        selectedDateMemory: memory,
        memories: [memory],
        hasReports: false,
      }).actions.canViewReports,
    ).toBe(false);
    expect(
      getStatusSummary({
        selectedDateMemory: memory,
        memories: [memory],
        hasReports: true,
      }).actions.canViewReports,
    ).toBe(true);
  });

  it('can surface an existing current-week report when no higher status applies', () => {
    const summary = getStatusSummary({
      selectedDateMemory: null,
      memories: [createMemory('2026-05-29', 'generated')],
      hasReports: true,
      hasCurrentWeekReport: true,
    });

    expect(summary.title).toBe('本周周报已生成');
    expect(summary.actions.canViewReports).toBe(true);
  });
});

function getStatusSummary({
  selectedDate = '2026-06-08',
  todayDate = '2026-06-08',
  selectedDateMemory,
  memories,
  hasReports = false,
  hasCurrentWeekReport = false,
}: {
  selectedDate?: string;
  todayDate?: string;
  selectedDateMemory: DailyMemory | null;
  memories: DailyMemory[];
  hasReports?: boolean;
  hasCurrentWeekReport?: boolean;
}) {
  return getMemoryStatusSummary({
    selectedDate,
    todayDate,
    selectedDateMemory,
    memories,
    hasReports,
    hasCurrentWeekReport,
  });
}

function createMemory(
  date: string,
  status: DailyMemory['status'],
  summary = '完成需求整理。',
): DailyMemory {
  return {
    id: `daily-memory-${date}`,
    date,
    rawContent: `raw ${date}`,
    supplements: {},
    generated:
      status === 'draft'
        ? null
        : {
            summary,
            completedItems: ['整理需求'],
          },
    status,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}
