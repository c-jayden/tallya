import { describe, expect, it } from 'vitest';
import { LocalStorageDailyMemoryRepository, getDailyMemoryDate } from './daily-memory-repository';
import { mockGenerateDailyMemory } from './ai/mock-generate-daily-memory';

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
      supplements: {
        projectTopic: 'Tallya',
        tomorrowPlan: 'Verify local persistence.',
        extraNote: 'Keep UI unchanged.',
      },
    });

    expect(memory).toMatchObject({
      id: 'daily-memory-2026-06-02',
      date: '2026-06-02',
      rawContent: 'Finished the home interaction loop.',
      supplements: {
        projectTopic: 'Tallya',
        tomorrowPlan: 'Verify local persistence.',
        extraNote: 'Keep UI unchanged.',
      },
      generated: null,
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
      supplements: {},
    });

    repository.setClock(() => new Date('2026-06-02T11:00:00+08:00'));

    const second = await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Updated draft.',
      supplements: {
        projectTopic: 'Homepage',
      },
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBe('2026-06-02T03:00:00.000Z');
    expect(second.rawContent).toBe('Updated draft.');
    expect(second.supplements).toEqual({ projectTopic: 'Homepage' });
    expect(await repository.getByDate('2026-06-02')).toEqual(second);
    expect(await repository.list()).toHaveLength(1);
  });

  it('updates the same daily record to generated content', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage(), {
      now: () => new Date('2026-06-02T09:00:00+08:00'),
    });
    const generated = await mockGenerateDailyMemory({
      date: '2026-06-02',
      rawContent: 'Implemented draft save and generated preview.',
      supplements: {
        tomorrowPlan: 'Run build.',
      },
    });

    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Initial text.',
      supplements: {},
    });

    repository.setClock(() => new Date('2026-06-02T12:00:00+08:00'));

    const memory = await repository.saveGenerated({
      date: '2026-06-02',
      rawContent: 'Implemented draft save and generated preview.',
      supplements: {
        tomorrowPlan: 'Run build.',
      },
      generated,
    });

    expect(memory).toMatchObject({
      status: 'generated',
      rawContent: 'Implemented draft save and generated preview.',
      generated: {
        summary: 'Implemented draft save and generated preview.',
        completedItems: ['Implemented draft save and generated preview.'],
        keyOutcome: '形成了一份可继续沉淀到今日记忆的工作记录。',
        tomorrowPlan: 'Run build.',
      },
    });
    expect(await repository.list()).toHaveLength(1);
  });

  it('can migrate the previous flat localStorage shape', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'Old flat record.',
          projectTopic: 'Migration',
          tomorrowPlan: '',
          extraNote: 'Keep this note.',
          generatedContent: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T01:30:00.000Z',
        },
      ]),
    );
    const repository = new LocalStorageDailyMemoryRepository(storage);

    await expect(repository.getByDate('2026-06-02')).resolves.toMatchObject({
      rawContent: 'Old flat record.',
      supplements: {
        projectTopic: 'Migration',
        extraNote: 'Keep this note.',
      },
      generated: null,
      status: 'draft',
    });
  });

  it('lists all memories and generated memories separately', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage());

    await repository.saveGenerated({
      date: '2026-06-01',
      rawContent: 'Finished first memory.',
      supplements: {},
      generated: {
        summary: 'First memory',
        completedItems: ['Finished first memory.'],
      },
    });
    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Draft should not appear.',
      supplements: {},
    });
    await repository.saveGenerated({
      date: '2026-06-03',
      rawContent: 'Finished latest memory.',
      supplements: {},
      generated: {
        summary: 'Latest memory',
        completedItems: ['Finished latest memory.'],
      },
    });

    await expect(repository.getAllMemories()).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-01', status: 'generated' }),
      expect.objectContaining({ date: '2026-06-02', status: 'draft' }),
      expect.objectContaining({ date: '2026-06-03', status: 'generated' }),
    ]);
    await expect(repository.getGeneratedMemories()).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-03', status: 'generated' }),
      expect.objectContaining({ date: '2026-06-01', status: 'generated' }),
    ]);
  });

  it('finds a generated memory by date and searches generated memory fields', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage());

    await repository.saveGenerated({
      date: '2026-06-01',
      rawContent: 'Implemented billing export recovery.',
      supplements: {
        projectTopic: 'Billing',
        tomorrowPlan: 'Verify invoices.',
        extraNote: 'Customer support sync.',
      },
      generated: {
        summary: 'Recovered billing export',
        completedItems: ['Fixed CSV export', 'Added regression coverage'],
        keyOutcome: 'Export flow is stable again.',
        problems: 'Legacy formatter returned invalid dates.',
        tomorrowPlan: 'Verify invoices.',
        extraNote: 'Customer support sync.',
      },
    });
    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Billing draft should not be searchable.',
      supplements: {
        projectTopic: 'Billing draft',
      },
    });

    await expect(repository.getMemoryByDate('2026-06-01')).resolves.toMatchObject({
      date: '2026-06-01',
      status: 'generated',
    });
    await expect(repository.searchMemories('formatter')).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-01' }),
    ]);
    await expect(repository.searchMemories('Billing draft')).resolves.toEqual([]);
    await expect(repository.searchMemories('2026-06-01')).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-01' }),
    ]);
  });

  it('clears all local data', async () => {
    const repository = new LocalStorageDailyMemoryRepository(new MemoryStorage());

    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Draft to remove.',
      supplements: {},
    });
    await repository.saveGenerated({
      date: '2026-06-03',
      rawContent: 'Memory to remove.',
      supplements: {},
      generated: {
        summary: 'Memory to remove',
        completedItems: ['Saved memory'],
      },
    });

    await repository.clearLocalData();

    await expect(repository.list()).resolves.toEqual([]);
  });
});

describe('getDailyMemoryDate', () => {
  it('formats dates as local natural-day keys', () => {
    expect(getDailyMemoryDate(new Date(2026, 5, 2, 23, 30))).toBe('2026-06-02');
  });
});
