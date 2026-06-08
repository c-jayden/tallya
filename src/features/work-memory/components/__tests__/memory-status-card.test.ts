import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MemoryStatusCard copy', () => {
  it('renders status copy from the view model summary', () => {
    const source = readFileSync(new URL('../memory-status-card.tsx', import.meta.url), 'utf8');

    expect(source).toContain('<strong>{summary.title}</strong>');
    expect(source).toContain('{summary.description}');
    expect(source).not.toContain('lastMemorySummary');
    expect(source).not.toContain('上次记录');
  });

  it('does not keep broad fallback copy or disabled placeholder actions in the component', () => {
    const source = readFileSync(new URL('../memory-status-card.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('已有工作记忆');
    expect(source).not.toContain('disabled');
    expect(source).toContain('summary.actions.canViewDraft');
    expect(source).toContain('summary.actions.canViewMemory');
    expect(source).toContain('summary.actions.canViewReports');
    expect(source).toContain('summary.actions.canGenerateReport');
  });
});
