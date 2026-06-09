import type { DailyMemory } from '../types';
import { formatDailyMemoryAsDailyReport } from './daily-memory-text';

type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export async function copyDailyMemoryReport(
  memory: DailyMemory,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
) {
  if (!clipboard) {
    throw new Error('复制失败，请稍后重试');
  }

  // TODO: later add an explicit "AI 优化日报" action for old memories if needed.
  // Copying stays local and immediate so it does not depend on provider availability.
  const reportText = formatDailyMemoryAsDailyReport(memory);

  if (!reportText) {
    throw new Error('暂无可复制的日报内容');
  }

  try {
    await clipboard.writeText(reportText);
  } catch {
    throw new Error('复制失败，请稍后重试');
  }
}
