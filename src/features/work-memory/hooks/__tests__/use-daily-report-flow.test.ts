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

  it('keeps daily report AI status local to the dialog flow', () => {
    expect(source).toContain('const [aiAlert, setAiAlert]');
    expect(source).toContain("setAiAlert(createDailyReportAiAlert('info'");
    expect(source).toContain("setAiAlert(createDailyReportAiAlert('success'");
    expect(source).toContain("setAiAlert(createDailyReportAiAlert('error'");
  });

  it('exposes a way to dismiss the dialog-scoped AI alert', () => {
    expect(source).toContain('const dismissAiAlert = useCallback(() => setAiAlert(null), [])');
    expect(source).toContain('dismissAiAlert,');
  });
});
