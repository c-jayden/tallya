import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useWeeklyReportFlow progress restore', () => {
  const source = readFileSync(new URL('../use-weekly-report-flow.ts', import.meta.url), 'utf8');

  it('persists report gaps before preview generation starts', () => {
    expect(source).toContain("stage: 'gap'");
    expect(source).toContain('reportDraftRepository.save({');
    expect(source).toContain('gaps,');
  });

  it('restores gap progress into the supplement dialog', () => {
    expect(source).toContain("restoreProgress.stage === 'gap'");
    expect(source).toContain('setReportGaps(restoreProgress.gaps)');
    expect(source).toContain('setIsGapDialogOpen(true)');
  });

  it('keeps preview progress recoverable after generation', () => {
    expect(source).toContain("stage: 'preview'");
    expect(source).toContain('setReportDraft(restoreProgress.draft)');
    expect(source).toContain('setIsPreviewDialogOpen(true)');
  });

  it('can return from gap filling to the report setup step', () => {
    expect(source).toContain('function backToGenerateFromGaps()');
    expect(source).toContain('setIsGapDialogOpen(false)');
    expect(source).toContain('setIsGenerateDialogOpen(true)');
    expect(source).toContain('backToGenerateFromGaps');
  });
});
