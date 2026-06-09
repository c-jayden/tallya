import { describe, expect, it } from 'vitest';
import {
  formatDailyMemoryAsDailyReport,
  normalizeDailyMemoryText,
} from '../daily-memory-text';
import type { DailyMemory } from '../../types';

describe('formatDailyMemoryAsDailyReport', () => {
  it('uses generated dailyReportText first', () => {
    expect(
      formatDailyMemoryAsDailyReport(
        createMemory({
          dailyReportText: '今日整理了需求讨论内容，并同步后续计划。',
          summary: '结构化摘要',
        }),
      ),
    ).toBe('今日整理了需求讨论内容，并同步后续计划。');
  });

  it('falls back when dailyReportText is an empty string', () => {
    expect(
      formatDailyMemoryAsDailyReport(
        createMemory({
          dailyReportText: '',
          summary: '整理需求讨论并同步后续计划。',
        }),
      ),
    ).toBe('整理需求讨论并同步后续计划。');
  });

  it('falls back for old memories without dailyReportText', () => {
    expect(
      formatDailyMemoryAsDailyReport(
        createMemory({
          summary: '修复设置页数据管理问题，并补充快捷键说明。',
        }),
      ),
    ).toBe('修复设置页数据管理问题，并补充快捷键说明。');
  });

  it('builds text from completed items when summary is missing', () => {
    expect(
      formatDailyMemoryAsDailyReport(
        createMemory({
          summary: '',
          completedItems: ['修复打开数据目录失败'],
        }),
      ),
    ).toBe('修复打开数据目录失败');
  });

  it('builds compact sections when completed items, problems, and tomorrow plan exist', () => {
    const report = formatDailyMemoryAsDailyReport(
      createMemory({
        summary: '推进设置页数据管理能力。',
        completedItems: ['修复打开数据目录失败', '补充清空本地数据确认'],
        problems: '文件选择取消时会触发设置页关闭。',
        tomorrowPlan: '继续检查发布前流程。',
      }),
    );

    expect(report).toContain('今日完成：修复打开数据目录失败；补充清空本地数据确认');
    expect(report).toContain('遇到问题：文件选择取消时会触发设置页关闭。');
    expect(report).toContain('明日计划：继续检查发布前流程。');
    expect(report).not.toContain('本次未提及');
    expect(report).not.toContain('#');
    expect(report).not.toMatch(/\n{3,}/);
  });

  it('does not force a tomorrow plan when only problems exist', () => {
    const report = formatDailyMemoryAsDailyReport(
      createMemory({
        summary: '',
        completedItems: ['排查导入备份取消后的状态跳转'],
        problems: '取消文件选择时不应关闭设置页。',
      }),
    );

    expect(report).toContain('今日完成：排查导入备份取消后的状态跳转');
    expect(report).toContain('遇到问题：取消文件选择时不应关闭设置页。');
    expect(report).not.toContain('明日计划');
  });

  it('does not force problems when only tomorrow plan exists', () => {
    const report = formatDailyMemoryAsDailyReport(
      createMemory({
        summary: '',
        completedItems: ['补充日报复制能力'],
        tomorrowPlan: '继续检查旧数据兼容。',
      }),
    );

    expect(report).toContain('今日完成：补充日报复制能力');
    expect(report).toContain('明日计划：继续检查旧数据兼容。');
    expect(report).not.toContain('遇到问题');
  });

  it('returns an empty string when no copyable daily report content exists', () => {
    expect(formatDailyMemoryAsDailyReport(createMemory({ summary: '', completedItems: [] }))).toBe(
      '',
    );
  });
});

describe('normalizeDailyMemoryText', () => {
  it('removes extra blank lines without changing list-like text', () => {
    expect(normalizeDailyMemoryText('今日完成：A\n\n\n遇到问题：B\n\n')).toBe(
      '今日完成：A\n\n遇到问题：B',
    );
  });
});

function createMemory(generated: Partial<NonNullable<DailyMemory['generated']>>): DailyMemory {
  return {
    id: 'daily-memory-2026-06-08',
    date: '2026-06-08',
    rawContent: '整理需求讨论内容。',
    supplements: {},
    generated: {
      summary: generated.summary ?? '整理需求讨论并同步后续计划。',
      completedItems: generated.completedItems ?? ['整理需求讨论内容'],
      keyOutcome: generated.keyOutcome,
      problems: generated.problems,
      tomorrowPlan: generated.tomorrowPlan,
      extraNote: generated.extraNote,
      dailyReportText: generated.dailyReportText,
    },
    status: 'generated',
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T02:00:00.000Z',
  };
}
