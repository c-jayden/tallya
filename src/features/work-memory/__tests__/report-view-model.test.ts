import { describe, expect, it } from 'vitest';
import {
  getReportStatusLabel,
  getReportTypeLabel,
  normalizeReportContent,
  reportListEmptyState,
} from '../report-view-model';

describe('report view model', () => {
  it('keeps empty report list copy available for UI', () => {
    expect(reportListEmptyState).toEqual({
      title: '还没有保存的整理',
      description: '整理一段时间后，这里会留下记录。',
    });
  });

  it('maps report type and stale status for display', () => {
    expect(getReportTypeLabel('weekly')).toBe('本周回顾');
    expect(getReportTypeLabel('custom')).toBe('工作总结');
    expect(getReportTypeLabel('monthly')).toBe('月度整理');
    expect(getReportStatusLabel('generated')).toBe('已保存');
    expect(getReportStatusLabel('stale')).toBe('建议重新整理');
  });

  it('normalizes report content for rendering', () => {
    expect(
      normalizeReportContent({
        title: ' 本周周报 ',
        summary: '完成报告闭环。',
        highlights: [' 列表 ', '', 1],
        completedItems: ['详情'],
        problems: null,
        markdown: '# 本周周报',
      }),
    ).toEqual({
      title: '本周周报',
      summary: '完成报告闭环。',
      highlights: ['列表'],
      completedItems: ['详情'],
      problems: '',
      nextWeekPlan: '',
      markdown: '# 本周周报',
    });
  });
});
