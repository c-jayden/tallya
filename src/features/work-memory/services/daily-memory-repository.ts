import type { DailyMemory, DailyMemoryGeneratedContent, DailyMemorySupplements } from '../types';

const STORAGE_KEY = 'tallya.daily-memories.v1';

type Clock = () => Date;

type RepositoryOptions = {
  now?: Clock;
};

type DailyMemoryDraftInput = {
  date: string;
  rawContent: string;
  supplements: DailyMemorySupplements;
};

type DailyMemoryGeneratedInput = DailyMemoryDraftInput & {
  generated: DailyMemoryGeneratedContent;
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
    const existing = await this.getByDate(input.date);

    return this.upsert({
      ...input,
      generated:
        existing?.status === 'generated' || existing?.status === 'locked' ? existing.generated : null,
      status:
        existing?.status === 'generated' || existing?.status === 'locked' ? existing.status : 'draft',
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
      supplements: normalizeSupplements(input.supplements),
      generated: input.generated ? normalizeGenerated(input.generated) : null,
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

      return parsed
        .map(normalizeDailyMemory)
        .filter((memory): memory is DailyMemory => memory !== null);
    } catch {
      return [];
    }
  }

  private writeAll(memories: DailyMemory[]) {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(memories));
  }
}

export const dailyMemoryRepository = new LocalStorageDailyMemoryRepository();

function normalizeDailyMemory(value: unknown): DailyMemory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const memory = value as Partial<DailyMemory> & {
    projectTopic?: unknown;
    tomorrowPlan?: unknown;
    extraNote?: unknown;
    generatedContent?: unknown;
  };

  if (
    typeof memory.id !== 'string' ||
    typeof memory.date !== 'string' ||
    typeof memory.rawContent !== 'string' ||
    (memory.status !== 'draft' && memory.status !== 'generated' && memory.status !== 'locked') ||
    typeof memory.createdAt !== 'string' ||
    typeof memory.updatedAt !== 'string'
  ) {
    return null;
  }

  const supplements =
    memory.supplements && typeof memory.supplements === 'object'
      ? normalizeSupplements(memory.supplements)
      : normalizeSupplements({
          projectTopic: memory.projectTopic,
          tomorrowPlan: memory.tomorrowPlan,
          extraNote: memory.extraNote,
        });
  const generated =
    memory.generated && typeof memory.generated === 'object'
      ? normalizeGenerated(memory.generated)
      : normalizeLegacyGenerated(memory.generatedContent);

  return {
    id: memory.id,
    date: memory.date,
    rawContent: memory.rawContent,
    supplements,
    generated,
    status: memory.status,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function normalizeSupplements(value: unknown): DailyMemorySupplements {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const input = value as Record<string, unknown>;
  const supplements: DailyMemorySupplements = {};

  if (typeof input.projectTopic === 'string' && input.projectTopic.trim()) {
    supplements.projectTopic = input.projectTopic.trim();
  }

  if (typeof input.tomorrowPlan === 'string' && input.tomorrowPlan.trim()) {
    supplements.tomorrowPlan = input.tomorrowPlan.trim();
  }

  if (typeof input.extraNote === 'string' && input.extraNote.trim()) {
    supplements.extraNote = input.extraNote.trim();
  }

  return supplements;
}

function normalizeGenerated(value: unknown): DailyMemoryGeneratedContent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const input = value as Record<string, unknown>;
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const completedItems = Array.isArray(input.completedItems)
    ? input.completedItems.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];

  if (!summary || completedItems.length === 0) {
    return null;
  }

  return {
    summary,
    completedItems: completedItems.map((item) => item.trim()),
    keyOutcome: getOptionalString(input.keyOutcome),
    problems: getOptionalString(input.problems),
    tomorrowPlan: getOptionalString(input.tomorrowPlan),
    extraNote: getOptionalString(input.extraNote),
  };
}

function normalizeLegacyGenerated(value: unknown): DailyMemoryGeneratedContent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const sections = (value as { sections?: unknown }).sections;

  if (!Array.isArray(sections)) {
    return null;
  }

  const getSectionItems = (title: string) => {
    const section = sections.find((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      return (item as { title?: unknown }).title === title;
    }) as { content?: unknown } | undefined;

    return Array.isArray(section?.content)
      ? section.content.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [];
  };
  const summary = getSectionItems('今日摘要')[0] ?? '';
  const completedItems = getSectionItems('完成事项');

  if (!summary || completedItems.length === 0) {
    return null;
  }

  return {
    summary,
    completedItems,
    keyOutcome: getSectionItems('关键产出')[0],
    problems: getSectionItems('遇到问题')[0],
    tomorrowPlan: getSectionItems('明日计划')[0],
    extraNote: getSectionItems('补充说明')[0],
  };
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
