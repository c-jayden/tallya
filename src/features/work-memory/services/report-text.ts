import type { GeneratedReportContent } from '../types';

export function normalizeReportText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatReportAsPlainText(
  content: GeneratedReportContent,
  options: { title?: string } = {},
) {
  const sections: string[] = [options.title || content.title || '本周周报'];

  pushTextBlock(sections, '总结', content.summary);
  pushTextList(sections, '本周重点', content.highlights);
  pushTextList(sections, '完成事项', content.completedItems);
  pushTextBlock(sections, '问题与风险', content.problems);
  pushTextBlock(sections, '下周计划', content.nextWeekPlan);

  return normalizeReportText(sections.join('\n\n'));
}

function pushTextBlock(sections: string[], title: string, content?: string) {
  const normalizedContent = content?.trim();

  if (!normalizedContent) {
    return;
  }

  sections.push(`${title}：\n${normalizedContent}`);
}

function pushTextList(sections: string[], title: string, items: string[]) {
  const normalizedItems = items.map((item) => item.trim()).filter(Boolean);

  if (normalizedItems.length === 0) {
    return;
  }

  sections.push(
    [`${title}：`, ...normalizedItems.map((item, index) => `${index + 1}. ${item}`)].join('\n'),
  );
}
