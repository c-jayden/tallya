import type { DailyMemory, DailyMemoryGeneratedContent } from '../types';

const STORAGE_KEY = 'tallya.daily-memories.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

type DailyMemoryDraftInput = {
  date: string;
  rawContent: string;
  projectTopic: string;
  tomorrowPlan: string;
  extraNote: string;
};

type DailyMemoryGeneratedInput = DailyMemoryDraftInput & {
  generatedContent: DailyMemoryGeneratedContent;
};

export function getDailyMemoryDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export class LocalStorageDailyMemoryRepository {
  private now: Clock;

  constructor(
    private readonly storage: Storage | null = getBrowserStorage(),
    options: RepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  setClock(now: Clock) {
    this.now = now;
  }

  async getByDate(date: string) {
    return this.readAll().find((memory) => memory.date === date) ?? null;
  }

  async list() {
    return this.readAll();
  }

  async saveDraft(input: DailyMemoryDraftInput) {
    return this.upsert({
      ...input,
      generatedContent: null,
      status: 'draft',
    });
  }

  async saveGenerated(input: DailyMemoryGeneratedInput) {
    return this.upsert({
      ...input,
      status: 'generated',
    });
  }

  private upsert(input: Omit<DailyMemory, 'id' | 'createdAt' | 'updatedAt'>) {
    const memories = this.readAll();
    const existingIndex = memories.findIndex((memory) => memory.date === input.date);
    const existing = existingIndex >= 0 ? memories[existingIndex] : null;
    const timestamp = this.now().toISOString();
    const memory: DailyMemory = {
      id: existing?.id ?? `daily-memory-${input.date}`,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      ...input,
    };

    if (existingIndex >= 0) {
      memories[existingIndex] = memory;
    } else {
      memories.push(memory);
    }

    this.writeAll(memories);

    return memory;
  }

  private readAll() {
    if (!this.storage) {
      return [];
    }

    const rawValue = this.storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(isDailyMemory);
    } catch {
      return [];
    }
  }

  private writeAll(memories: DailyMemory[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(memories));
  }
}

export const dailyMemoryRepository = new LocalStorageDailyMemoryRepository();

function isDailyMemory(value: unknown): value is DailyMemory {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const memory = value as Partial<DailyMemory>;

  return (
    typeof memory.id === 'string' &&
    typeof memory.date === 'string' &&
    typeof memory.rawContent === 'string' &&
    typeof memory.projectTopic === 'string' &&
    typeof memory.tomorrowPlan === 'string' &&
    typeof memory.extraNote === 'string' &&
    (memory.generatedContent === null || typeof memory.generatedContent === 'object') &&
    (memory.status === 'draft' || memory.status === 'generated' || memory.status === 'locked') &&
    typeof memory.createdAt === 'string' &&
    typeof memory.updatedAt === 'string'
  );
}
