import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useDailyReportFlow AI task coordination', () => {
  const source = readFileSync(new URL('../use-daily-report-flow.ts', import.meta.url), 'utf8');

  it('wraps explicit AI generation in coordinator task updates', () => {
    expect(source).toContain('aiTaskCoordinator?: AiTaskCoordinatorControls');
    expect(source).toContain("await aiTaskCoordinator?.beginTask('daily-report')");
    expect(source).toContain("createAiTask('daily-report', 'completed')");
    expect(source).toContain("createAiTask('daily-report', 'failed'");
  });
});
