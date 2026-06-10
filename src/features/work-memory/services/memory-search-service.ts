import { clarificationRepository as defaultClarificationRepository } from './clarification-repository';
import { entryRepository as defaultEntryRepository } from './entry-repository';
import type { Entry } from '../types';

type EntrySearchRepository = {
  search(keyword: string): Promise<Entry[]>;
  getById(id: string): Promise<Entry | null>;
};

type ClarificationSearchRepository = {
  search(keyword: string): Promise<{ entryId: string }[]>;
};

type MemorySearchOptions = {
  entryRepository?: EntrySearchRepository;
  clarificationRepository?: ClarificationSearchRepository;
};

export function createMemorySearch({
  entryRepository = defaultEntryRepository,
  clarificationRepository = defaultClarificationRepository,
}: MemorySearchOptions = {}) {
  return {
    // Search spans entries and their clarifications: a keyword that only appears
    // in a follow-up answer still surfaces the parent entry.
    async searchEntries(keyword: string): Promise<Entry[]> {
      const trimmed = keyword.trim();

      if (!trimmed) {
        return [];
      }

      const [entryMatches, clarificationMatches] = await Promise.all([
        entryRepository.search(trimmed),
        clarificationRepository.search(trimmed),
      ]);

      const byId = new Map<string, Entry>();

      for (const entry of entryMatches) {
        byId.set(entry.id, entry);
      }

      const missingIds = [...new Set(clarificationMatches.map((item) => item.entryId))].filter(
        (id) => !byId.has(id),
      );
      const parents = await Promise.all(missingIds.map((id) => entryRepository.getById(id)));

      for (const entry of parents) {
        if (entry) {
          byId.set(entry.id, entry);
        }
      }

      return [...byId.values()].sort(
        (first, second) =>
          second.occurredAt.localeCompare(first.occurredAt) ||
          second.id.localeCompare(first.id),
      );
    },
  };
}

export const memorySearch = createMemorySearch();
