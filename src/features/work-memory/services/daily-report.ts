import type { Clarification, Entry } from '../types';

// Joins a day's entries (and their clarification answers) into one block of
// raw text. Used both as the instant, paste-ready fallback and as the input
// the AI organizes into a polished daily report.
export function assembleDailyReportSource(
  entries: Entry[],
  clarificationsByEntry: Record<string, Clarification[]>,
): string {
  return entries
    .map((entry) => {
      const answers = (clarificationsByEntry[entry.id] ?? [])
        .map((clarification) => clarification.answer.trim())
        .filter(Boolean);
      const content = entry.content.trim();

      if (answers.length === 0) {
        return content;
      }

      // Fold the supplements into the line so a single entry reads as one item.
      return `${content}（${answers.join('；')}）`;
    })
    .filter(Boolean)
    .join('\n');
}

// Instant, no-AI daily report: a clean bullet list of the day's items, ready to
// paste into 企业微信 / 钉钉 without any Markdown decoration.
export function assemblePlainDailyReport(
  entries: Entry[],
  clarificationsByEntry: Record<string, Clarification[]>,
): string {
  const source = assembleDailyReportSource(entries, clarificationsByEntry);

  if (!source) {
    return '';
  }

  return source
    .split('\n')
    .map((line) => `- ${line}`)
    .join('\n');
}
