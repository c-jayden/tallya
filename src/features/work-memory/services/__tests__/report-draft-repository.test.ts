import { describe, expect, it } from 'vitest';
import { createReportDraftRepository } from '../report-draft-repository';
import type { ReportDraft } from '../report-service';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function createDraft(): ReportDraft {
  return {
    reportType: 'weekly',
    startDate: '2026-06-08',
    endDate: '2026-06-14',
    entries: [],
    existingReport: null,
    generated: {
      title: '本周回顾',
      summary: '完成了订单接口联调。',
      highlights: ['订单接口跑通'],
      completedItems: ['对接订单接口'],
      problems: '',
      nextWeekPlan: '',
      markdown: '本周回顾\n\n完成了订单接口联调。',
    },
  };
}

describe('reportDraftRepository', () => {
  it('returns null when no draft is saved', () => {
    const repository = createReportDraftRepository(new MemoryStorage());

    expect(repository.get()).toBeNull();
  });

  it('saves and reads back an unsaved report preview', () => {
    const repository = createReportDraftRepository(new MemoryStorage());
    const draft = createDraft();

    repository.save({ stage: 'preview', draft });

    expect(repository.get()).toEqual({ stage: 'preview', draft });
  });

  it('saves and reads back report gaps before preview generation', () => {
    const repository = createReportDraftRepository(new MemoryStorage());
    const progress = {
      stage: 'gap' as const,
      reportType: 'custom' as const,
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      gaps: [
        {
          entryId: 'entry_1',
          threadTitle: '订单接口',
          question: '这条线索后面推进到了哪一步？',
        },
      ],
    };

    repository.save(progress);

    expect(repository.get()).toEqual(progress);
  });

  it('clears the draft', () => {
    const repository = createReportDraftRepository(new MemoryStorage());

    repository.save({ stage: 'preview', draft: createDraft() });
    repository.clear();

    expect(repository.get()).toBeNull();
  });

  it('restores legacy saved report drafts as preview progress', () => {
    const storage = new MemoryStorage();
    const draft = createDraft();
    storage.setItem('tallya.report.unsaved-draft.v1', JSON.stringify(draft));
    const repository = createReportDraftRepository(storage);

    expect(repository.get()).toEqual({ stage: 'preview', draft });
  });

  it('ignores malformed stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem('tallya.report.unsaved-draft.v1', '{ not valid json');
    const repository = createReportDraftRepository(storage);

    expect(repository.get()).toBeNull();
  });

  it('ignores a draft missing required fields', () => {
    const storage = new MemoryStorage();
    storage.setItem('tallya.report.unsaved-draft.v1', JSON.stringify({ reportType: 'weekly' }));
    const repository = createReportDraftRepository(storage);

    expect(repository.get()).toBeNull();
  });
});
