import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { ReportDocument } from './report-document';
import type { GeneratedReportContent } from '../types';

const content: GeneratedReportContent = {
  title: '本周周报',
  summary: '完成报告详情优化。',
  highlights: [],
  completedItems: [],
  problems: '',
  nextWeekPlan: '',
  markdown: '# 本周周报',
};

describe('ReportDocument', () => {
  it('does not render the report title when the dialog already owns the title', () => {
    const element = ReportDocument({ content, showTitle: false }) as ReactElement;

    expect(countElementsByType(element, 'h2')).toBe(0);
  });
});

function countElementsByType(node: ReactNode, type: string): number {
  if (!node || typeof node !== 'object' || !('props' in node)) {
    return 0;
  }

  const element = node as ReactElement<{ children?: ReactNode }>;
  const selfCount = element.type === type ? 1 : 0;
  const children = element.props.children;

  if (Array.isArray(children)) {
    return (
      selfCount + children.reduce((count, child) => count + countElementsByType(child, type), 0)
    );
  }

  return selfCount + countElementsByType(children, type);
}
