import { describe, expect, it } from 'vitest';
import {
  LocalStorageDailyMemoryRepository,
  getDailyMemoryDate,
} from './services/daily-memory-repository';
import { mockGenerateDailyMemory } from './services/mock-generate-daily-memory';

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

describe('LocalStorageDailyMemoryRepository', () => {
  it('creates one draft for a natural day with raw and supplement content', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage(), {
      now: () => new Date('2026-06-02T09:00:00+08:00'),
    });

    const memory = await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Finished the home interaction loop.',
      projectTopic: 'Tallya',
      tomorrowPlan: 'Verify local persistence.',
      extraNote: 'Keep UI unchanged.',
    });

    expect(memory).toMatchObject({
      id: 'daily-memory-2026-06-02',
      date: '2026-06-02',
      rawContent: 'Finished the home interaction loop.',
      projectTopic: 'Tallya',
      tomorrowPlan: 'Verify local persistence.',
      extraNote: 'Keep UI unchanged.',
      generatedContent: null,
      status: 'draft',
      createdAt: '2026-06-02T01:00:00.000Z',
      updatedAt: '2026-06-02T01:00:00.000Z',
    });
  });

  it('overwrites the existing draft for the same day without creating a second record', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageDailyMemoryRepository(storage, {
      now: () => new Date('2026-06-02T09:00:00+08:00'),
    });

    const first = await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'First draft.',
      projectTopic: '',
      tomorrowPlan: '',
      extraNote: '',
    });

    repository.setClock(() => new Date('2026-06-02T11:00:00+08:00'));

    const second = await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Updated draft.',
      projectTopic: 'Homepage',
      tomorrowPlan: '',
      extraNote: '',
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBe('2026-06-02T03:00:00.000Z');
    expect(second.rawContent).toBe('Updated draft.');
    expect(await repository.getByDate('2026-06-02')).toEqual(second);
    expect(await repository.list()).toHaveLength(1);
  });

  it('updates the same daily record to generated content', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage(), {
      now: () => new Date('2026-06-02T09:00:00+08:00'),
    });
    const generatedContent = await mockGenerateDailyMemory({
      rawContent: 'Implemented draft save and generated preview.',
      projectTopic: '',
      tomorrowPlan: 'Run build.',
      extraNote: '',
    });

    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Initial text.',
      projectTopic: '',
      tomorrowPlan: '',
      extraNote: '',
    });

    repository.setClock(() => new Date('2026-06-02T12:00:00+08:00'));

    const generated = await repository.saveGenerated({
      date: '2026-06-02',
      rawContent: 'Implemented draft save and generated preview.',
      projectTopic: '',
      tomorrowPlan: 'Run build.',
      extraNote: '',
      generatedContent,
    });

    expect(generated.status).toBe('generated');
    expect(generated.generatedContent?.sections.map((section) => section.title)).toEqual([
      '今日摘要',
      '完成事项',
      '关键产出',
      '遇到问题',
      '明日计划',
      '补充说明',
    ]);
    expect(await repository.list()).toHaveLength(1);
  });
});

describe('getDailyMemoryDate', () => {
  it('formats dates as local natural-day keys', () => {
    expect(getDailyMemoryDate(new Date(2026, 5, 2, 23, 30))).toBe('2026-06-02');
  });
});
