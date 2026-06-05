import type { GeneratedReportContent, Report, ReportStatus, ReportType } from './types';
import { formatReportDateRange } from './services/report-date';

export const reportListEmptyState = {
  title: '还没有保存的报告',
  description: '生成一份周报后，这里会显示你的报告记录。',
};

export function getReportTypeLabel(type: ReportType) {
  const labels: Record<ReportType, string> = {
    weekly: '周报',
    monthly: '月报',
    yearly: '年报',
    custom: '自定义报告',
    performance: '绩效材料',
    handoff: '交接材料',
  };

  return labels[type];
}

export function getReportStatusLabel(status: ReportStatus) {
  return status === 'stale' ? '需要重新生成' : '已保存';
}

export function getReportRangeLabel(report: Pick<Report, 'startDate' | 'endDate'>) {
  return formatReportDateRange(report.startDate, report.endDate).replace(' - ', ' 至 ');
}

export function getReportGeneratedAtLabel(report: Pick<Report, 'generatedAt' | 'createdAt'>) {
  const timestamp = report.generatedAt ?? report.createdAt;
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function normalizeReportContent(content: unknown): GeneratedReportContent {
  if (!content || typeof content !== 'object') {
    return createEmptyReportContent();
  }

  const input = content as Record<string, unknown>;
  const title = getString(input.title);
  const summary = getString(input.summary);
  const highlights = getStringList(input.highlights);
  const completedItems = getStringList(input.completedItems);
  const problems = getString(input.problems);
  const nextWeekPlan = getString(input.nextWeekPlan);
  const markdown = getString(input.markdown);

  return {
    title,
    summary,
    highlights,
    completedItems,
    problems,
    nextWeekPlan,
    markdown,
  };
}

function createEmptyReportContent(): GeneratedReportContent {
  return {
    title: '',
    summary: '',
    highlights: [],
    completedItems: [],
    problems: '',
    nextWeekPlan: '',
    markdown: '',
  };
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim())
    : [];
}
