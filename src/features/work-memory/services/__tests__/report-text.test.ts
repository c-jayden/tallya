import { describe, expect, it } from 'vitest';
import { formatReportAsPlainText, normalizeReportText } from '../report-text';
import type { GeneratedReportContent } from '../../types';

const content: GeneratedReportContent = {
  title: '本周回顾',
  summary: '完成整理闭环，并补充复制能力。',
  highlights: ['补齐整理列表', '优化整理详情'],
  completedItems: ['新增复制纯文本', '统一空行规则'],
  problems: '',
  nextWeekPlan: '继续跟进整理体验。',
  markdown: '# 本周回顾\n\n## 总结\n\n完成整理闭环。',
};

describe('normalizeReportText', () => {
  it('trims text and removes excessive blank lines', () => {
    expect(normalizeReportText('\n\n第一段\n\n\n\n第二段\n\n')).toBe('第一段\n\n第二段');
  });
});

describe('formatReportAsPlainText', () => {
  it('formats report content without markdown syntax or empty sections', () => {
    expect(
      formatReportAsPlainText(content, {
        title: '本周回顾（2026年6月1日 - 2026年6月7日）',
      }),
    ).toBe(
      [
        '本周回顾（2026年6月1日 - 2026年6月7日）',
        '',
        '总结：',
        '完成整理闭环，并补充复制能力。',
        '',
        '重点：',
        '1. 补齐整理列表',
        '2. 优化整理详情',
        '',
        '完成事项：',
        '1. 新增复制纯文本',
        '2. 统一空行规则',
        '',
        '后续计划：',
        '继续跟进整理体验。',
      ].join('\n'),
    );
  });
});
