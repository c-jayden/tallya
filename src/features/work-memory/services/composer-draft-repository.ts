// Persists the home composer's unsent text so a refresh, crash, or app restart
// never loses what the user was typing. The draft is cleared the moment an entry
// is actually recorded (Enter / 记录).
const STORAGE_KEY = 'tallya.composer.draft.v1';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export type ComposerDraftRepository = {
  get(): string;
  save(text: string): void;
  clear(): void;
};

export function createComposerDraftRepository(
  storage: Storage | null = getBrowserStorage(),
): ComposerDraftRepository {
  return {
    get() {
      return storage?.getItem(STORAGE_KEY) ?? '';
    },
    save(text: string) {
      if (!storage) {
        return;
      }

      // An empty/whitespace-only draft is the same as no draft; don't leave a
      // stale key behind.
      if (text.trim()) {
        storage.setItem(STORAGE_KEY, text);
      } else {
        storage.removeItem(STORAGE_KEY);
      }
    },
    clear() {
      storage?.removeItem(STORAGE_KEY);
    },
  };
}

export const composerDraftRepository = createComposerDraftRepository();
