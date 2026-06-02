import { useEffect } from 'react';

type UseWorkMemoryShortcutsOptions = {
  isSearchOpen: boolean;
  onCloseSearch: () => void;
  onSettleTodayMemory: () => void;
  onTriggerSearch: () => void;
};

export function useWorkMemoryShortcuts({
  isSearchOpen,
  onCloseSearch,
  onSettleTodayMemory,
  onTriggerSearch,
}: UseWorkMemoryShortcutsOptions) {
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (isSearchOpen && event.key === 'Escape') {
        event.preventDefault();
        onCloseSearch();
        return;
      }

      const isCommandShortcut = event.ctrlKey || event.metaKey;

      if (!isCommandShortcut) {
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onTriggerSearch();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onSettleTodayMemory();
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [isSearchOpen, onCloseSearch, onSettleTodayMemory, onTriggerSearch]);
}
