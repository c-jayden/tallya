import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useWorkMemoryController referenced memory flow', () => {
  it('does not prompt or mark reports stale when saving a draft', () => {
    const source = readFileSync(new URL('./use-work-memory-controller.ts', import.meta.url), 'utf8');
    const saveDraftStart = source.indexOf('async function saveDraft()');
    const saveDraftEnd = source.indexOf('async function saveDraftWithoutReferenceCheck()');
    const saveDraftSource = source.slice(saveDraftStart, saveDraftEnd);

    expect(saveDraftSource).toContain('await saveDraftWithoutReferenceCheck();');
    expect(saveDraftSource).not.toContain('shouldConfirmReferencedMemorySave');
    expect(saveDraftSource).not.toContain('markReportsStaleByDailyMemoryId');
  });

  it('marks referenced reports stale only after saving generated memory', () => {
    const source = readFileSync(new URL('./use-work-memory-controller.ts', import.meta.url), 'utf8');
    const saveGeneratedStart = source.indexOf('async function saveGeneratedMemoryWithoutReferenceCheck()');
    const saveGeneratedEnd = source.indexOf('async function confirmReferencedMemorySave()');
    const saveGeneratedSource = source.slice(saveGeneratedStart, saveGeneratedEnd);

    expect(saveGeneratedSource).toContain('dailyMemoryRepository.saveGenerated');
    expect(saveGeneratedSource).toContain('reportRepository.markReportsStaleByDailyMemoryId');
  });
});
