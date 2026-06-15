import { useCallback, useState } from 'react';
import { composerDraftRepository } from '../services/composer-draft-repository';

// Mirrors the composer's text in localStorage so it survives a refresh/restart.
// Initialized lazily from the saved draft, and cleared once an entry is saved.
export function useComposerDraft() {
  const [draft, setDraftState] = useState(() => composerDraftRepository.get());

  const setDraft = useCallback((text: string) => {
    setDraftState(text);
    composerDraftRepository.save(text);
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState('');
    composerDraftRepository.clear();
  }, []);

  return { draft, setDraft, clearDraft };
}
