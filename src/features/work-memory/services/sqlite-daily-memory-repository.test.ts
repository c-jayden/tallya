import { describe, expect, it } from 'vitest';
import { mockGenerateDailyMemory } from './ai/mock-generate-daily-memory';
import { SQLiteDailyMemoryRepository } from './daily-memory-repository';
import { TestDatabaseClient } from './database/test-database';

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

describe('SQLiteDailyMemoryRepository', () => {
  it('saves and reads a draft for one natural day', async () => {
    const repository = createRepository('2026-06-02T01:00:00.000Z');

    const memory = await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Draft local persistence.',
      supplements: {
        projectTopic: 'SQLite',
      },
    });

    await expect(repository.getByDate('2026-06-02')).resolves.toEqual(memory);
    expect(memory).toMatchObject({
      id: 'daily-memory-2026-06-02',
      date: '2026-06-02',
      rawContent: 'Draft local persistence.',
      supplements: { projectTopic: 'SQLite' },
      generated: null,
      status: 'draft',
      createdAt: '2026-06-02T01:00:00.000Z',
      updatedAt: '2026-06-02T01:00:00.000Z',
    });
  });

  it('updates one day to generated content without adding another row', async () => {
    const database = new TestDatabaseClient();
    const repository = createRepository('2026-06-02T01:00:00.000Z', database);
    const generated = await mockGenerateDailyMemory({
      date: '2026-06-02',
      rawContent: 'Finished the SQLite repository migration.',
      supplements: {},
    });

    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Draft text.',
      supplements: {},
    });
    repository.setClock(() => new Date('2026-06-02T03:00:00.000Z'));

    const memory = await repository.saveGenerated({
      date: '2026-06-02',
      rawContent: 'Finished the SQLite repository migration.',
      supplements: {},
      generated,
    });

    expect(memory.status).toBe('generated');
    expect(memory.generated?.summary).toBe('Finished the SQLite repository migration.');
    expect(memory.createdAt).toBe('2026-06-02T01:00:00.000Z');
    expect(memory.updatedAt).toBe('2026-06-02T03:00:00.000Z');
    await expect(repository.getAllMemories()).resolves.toHaveLength(1);
    expect(database.dailyMemories.size).toBe(1);
  });

  it('keeps drafts out of generated history and search', async () => {
    const repository = createRepository();

    await repository.saveGenerated({
      date: '2026-06-01',
      rawContent: 'Implemented billing export recovery.',
      supplements: {
        projectTopic: 'Billing',
        extraNote: 'Customer support sync.',
      },
      generated: {
        summary: 'Recovered billing export',
        completedItems: ['Fixed CSV export', 'Added regression coverage'],
        problems: 'Legacy formatter returned invalid dates.',
      },
    });
    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Billing draft should not be searchable.',
      supplements: { projectTopic: 'Billing draft' },
    });

    await expect(repository.getGeneratedMemories()).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-01', status: 'generated' }),
    ]);
    await expect(repository.searchMemories('formatter')).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-01' }),
    ]);
    await expect(repository.searchMemories('Billing draft')).resolves.toEqual([]);
  });

  it('lists all memories by date descending', async () => {
    const repository = createRepository();

    await repository.saveGenerated({
      date: '2026-06-01',
      rawContent: 'First memory.',
      supplements: {},
      generated: { summary: 'First memory', completedItems: ['First memory.'] },
    });
    await repository.saveDraft({
      date: '2026-06-03',
      rawContent: 'Latest draft.',
      supplements: {},
    });

    await expect(repository.getAllMemories()).resolves.toEqual([
      expect.objectContaining({ date: '2026-06-03' }),
      expect.objectContaining({ date: '2026-06-01' }),
    ]);
  });

  it('clears daily memories and future report tables', async () => {
    const database = new TestDatabaseClient();
    const repository = createRepository(undefined, database);

    database.appSettings.set('theme', {
      key: 'theme',
      value: 'dark',
      updated_at: '2026-06-02T01:00:00.000Z',
    });
    await repository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Draft to clear.',
      supplements: {},
    });
    await repository.clearLocalData();

    await expect(repository.getAllMemories()).resolves.toEqual([]);
    expect(database.clearedReports).toBe(true);
    expect(database.clearedReportSources).toBe(true);
    expect(database.appSettings.has('theme')).toBe(true);
  });

  it('migrates legacy localStorage memories without deleting the old value', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'Legacy draft.',
          supplements: { projectTopic: 'Migration' },
          generated: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T01:30:00.000Z',
        },
      ]),
    );
    const repository = new SQLiteDailyMemoryRepository(Promise.resolve(new TestDatabaseClient()), {
      legacyStorage: storage,
    });

    await expect(repository.getByDate('2026-06-02')).resolves.toMatchObject({
      rawContent: 'Legacy draft.',
      supplements: { projectTopic: 'Migration' },
      status: 'draft',
    });
    expect(storage.getItem('tallya.daily-memories.v1')).not.toBeNull();
    expect(storage.getItem('tallya.daily-memories.sqlite-migrated.v1')).toBe('1');
  });

  it('skips legacy memory migration after the migrated marker is written', async () => {
    const database = new TestDatabaseClient();
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'First legacy draft.',
          supplements: {},
          generated: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T01:30:00.000Z',
        },
      ]),
    );

    await new SQLiteDailyMemoryRepository(Promise.resolve(database), {
      legacyStorage: storage,
    }).getByDate('2026-06-02');

    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'Mutated legacy draft.',
          supplements: {},
          generated: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T02:30:00.000Z',
        },
      ]),
    );

    const secondStartupRepository = new SQLiteDailyMemoryRepository(Promise.resolve(database), {
      legacyStorage: storage,
    });

    await expect(secondStartupRepository.getByDate('2026-06-02')).resolves.toMatchObject({
      rawContent: 'First legacy draft.',
    });
    expect(database.dailyMemories.size).toBe(1);
  });

  it('does not overwrite existing SQLite memories when legacy migration runs again', async () => {
    const database = new TestDatabaseClient();
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'Old localStorage draft.',
          supplements: {},
          generated: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T01:30:00.000Z',
        },
      ]),
    );
    const sqliteRepository = new SQLiteDailyMemoryRepository(Promise.resolve(database), {
      legacyStorage: null,
      now: () => new Date('2026-06-02T03:00:00.000Z'),
    });

    await sqliteRepository.saveDraft({
      date: '2026-06-02',
      rawContent: 'Fresh SQLite draft.',
      supplements: { projectTopic: 'Current data' },
    });

    const migratingRepository = new SQLiteDailyMemoryRepository(Promise.resolve(database), {
      legacyStorage: storage,
    });

    await expect(migratingRepository.getByDate('2026-06-02')).resolves.toMatchObject({
      rawContent: 'Fresh SQLite draft.',
      supplements: { projectTopic: 'Current data' },
    });
    expect(database.dailyMemories.size).toBe(1);
    expect(storage.getItem('tallya.daily-memories.sqlite-migrated.v1')).toBe('1');
  });

  it('does not fail startup reads when legacy migration fails', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'tallya.daily-memories.v1',
      JSON.stringify([
        {
          id: 'daily-memory-2026-06-02',
          date: '2026-06-02',
          rawContent: 'Legacy draft.',
          supplements: {},
          generated: null,
          status: 'draft',
          createdAt: '2026-06-02T01:00:00.000Z',
          updatedAt: '2026-06-02T01:30:00.000Z',
        },
      ]),
    );
    const database = new FailingDailyMemoryMigrationDatabase();
    const repository = new SQLiteDailyMemoryRepository(Promise.resolve(database), {
      legacyStorage: storage,
    });

    await expect(repository.getAllMemories()).resolves.toEqual([]);
    expect(storage.getItem('tallya.daily-memories.sqlite-migrated.v1')).toBeNull();
  });
});

function createRepository(now = '2026-06-02T01:00:00.000Z', database = new TestDatabaseClient()) {
  return new SQLiteDailyMemoryRepository(Promise.resolve(database), {
    now: () => new Date(now),
  });
}

class FailingDailyMemoryMigrationDatabase extends TestDatabaseClient {
  override async execute(query: string, bindValues: unknown[] = []) {
    if (query.toLowerCase().includes('insert into daily_memories')) {
      throw new Error('insert failed');
    }

    return super.execute(query, bindValues);
  }
}
