import type { Entry } from '../types';

type DailyMemoryEntrySource = {
  id: string;
  date: string;
  rawContent: string | null | undefined;
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
};

export function buildEntryFromDailyMemory(memory: DailyMemoryEntrySource): Entry | null {
  const content = memory.rawContent?.trim();

  if (!content) {
    return null;
  }

  const occurredAt = memory.createdAt || `${memory.date}T00:00:00.000Z`;

  return {
    id: `entry-migrated-${memory.id}`,
    content,
    occurredAt,
    occurredOn: memory.date,
    threadId: null,
    difficulty: null,
    effort: null,
    createdAt: memory.createdAt || occurredAt,
    updatedAt: memory.updatedAt || occurredAt,
  };
}

export function buildEntriesFromDailyMemories(memories: DailyMemoryEntrySource[]) {
  return memories
    .map(buildEntryFromDailyMemory)
    .filter((entry): entry is Entry => entry !== null);
}
