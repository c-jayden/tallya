import { describe, expect, it, vi } from 'vitest';
import { copyReportMarkdown } from './report-clipboard';

describe('copyReportMarkdown', () => {
  it('writes markdown to clipboard without calling save logic', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const saveWeeklyReport = vi.fn();

    await copyReportMarkdown('# 本周周报', { writeText });

    expect(writeText).toHaveBeenCalledWith('# 本周周报');
    expect(saveWeeklyReport).not.toHaveBeenCalled();
  });

  it('returns a friendly error when clipboard is unavailable', async () => {
    await expect(copyReportMarkdown('# 本周周报', undefined)).rejects.toThrow(
      '复制失败，请稍后重试。',
    );
  });
});
