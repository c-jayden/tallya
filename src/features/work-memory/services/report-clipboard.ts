import type { GeneratedReportContent } from '../types';
import { formatReportAsPlainText, normalizeReportText } from './report-text';

type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export async function copyReportMarkdown(
  markdown: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
) {
  if (!clipboard) {
    throw new Error('复制失败，请稍后重试。');
  }

  await clipboard.writeText(normalizeReportText(markdown));
}

export async function copyReportPlainText(
  content: GeneratedReportContent,
  options: { title?: string } = {},
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
) {
  if (!clipboard) {
    throw new Error('复制失败，请稍后重试。');
  }

  await clipboard.writeText(formatReportAsPlainText(content, options));
}
