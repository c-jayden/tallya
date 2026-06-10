import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { entryRepository } from '../services/entry-repository';
import type { Entry } from '../types';

type UseMemorySearchOptions = {
  onOpenMemory: (entry: Entry) => void;
};

export function useMemorySearch({ onOpenMemory }: UseMemorySearchOptions) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchComposing, setIsSearchComposing] = useState(false);
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const openSearchPanel = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearchPanel = useCallback(() => {
    setIsSearchOpen(false);
    setSearchKeyword('');
    setIsSearchComposing(false);
    setSearchResults([]);
    setActiveSearchIndex(-1);
    searchButtonRef.current?.blur();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const keyword = searchKeyword.trim();

    // IME composition is treated as an in-progress keyword, so pinyin input
    // never flashes stale or partial search results before the user commits.
    if (!isSearchOpen || !keyword || isSearchComposing) {
      return;
    }

    // Search follows a Spotlight-style command palette over all captured
    // entries, backed by FTS5 with a LIKE fallback in the repository.
    void entryRepository.search(keyword).then((results) => {
      if (isMounted) {
        setSearchResults(results);
        setActiveSearchIndex(results.length > 0 ? 0 : -1);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isSearchComposing, isSearchOpen, searchKeyword]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isSearchOpen]);

  function updateSearchKeyword(value: string) {
    setSearchKeyword(value);

    // Empty keywords intentionally collapse the panel back to the bare input.
    if (!value.trim() || isSearchComposing) {
      setSearchResults([]);
      setActiveSearchIndex(-1);
    }
  }

  function handleSearchCompositionStart() {
    setIsSearchComposing(true);
    setSearchResults([]);
    setActiveSearchIndex(-1);
  }

  function handleSearchCompositionEnd() {
    setIsSearchComposing(false);
  }

  function clearSearchKeyword() {
    updateSearchKeyword('');
    searchInputRef.current?.focus({ preventScroll: true });
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearchPanel();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((current) => {
        if (searchResults.length === 0) {
          return -1;
        }

        return current < 0 ? 0 : (current + 1) % searchResults.length;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((current) => {
        if (searchResults.length === 0) {
          return -1;
        }

        return current <= 0 ? searchResults.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      const activeMemory = searchResults[activeSearchIndex];

      if (activeMemory) {
        event.preventDefault();
        closeSearchPanel();
        onOpenMemory(activeMemory);
      }
    }
  }

  function openSearchMemory(entry: Entry) {
    closeSearchPanel();
    onOpenMemory(entry);
  }

  return {
    activeSearchIndex,
    clearSearchKeyword,
    closeSearchPanel,
    handleSearchCompositionEnd,
    handleSearchCompositionStart,
    handleSearchKeyDown,
    isSearchComposing,
    isSearchOpen,
    openSearchMemory,
    openSearchPanel,
    searchButtonRef,
    searchInputRef,
    searchKeyword,
    searchResults,
    setActiveSearchIndex,
    updateSearchKeyword,
  };
}
