import {
  displayDate,
  displayWeekday,
  supplementFields,
  supplementPlaceholders,
  today,
} from './constants';
import { DailyMemoryPreviewDialog } from './components/daily-memory-preview-dialog';
import { HomeToolbar } from './components/home-toolbar';
import { MemoryEntryForm } from './components/memory-entry-form';
import { MemoryDetailDialog } from './components/memory-detail-dialog';
import { MemoryHero } from './components/memory-hero';
import { MemoryListDialog } from './components/memory-list-dialog';
import { MemoryStatusCard } from './components/memory-status-card';
import { SpotlightSearchPanel } from './components/spotlight-search-panel';
import { useHomeWindowSizing } from './hooks/use-home-window-sizing';
import { useMemorySearch } from './hooks/use-memory-search';
import { useWorkMemoryController } from './hooks/use-work-memory-controller';
import { useWorkMemoryShortcuts } from './hooks/use-work-memory-shortcuts';
import { getStatusVariant } from './memory-view-model';
import { getDailyMemoryDate } from './services/daily-memory-repository';

function getCommandKey() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    ? 'Cmd'
    : 'Ctrl';
}

export function WorkMemoryHome() {
  const currentDate = getDailyMemoryDate(today);
  const commandKey = getCommandKey();
  const contentRef = useHomeWindowSizing();
  const memory = useWorkMemoryController({ currentDate });
  const search = useMemorySearch({ onOpenMemory: memory.openMemoryDetail });
  const statusVariant = getStatusVariant(memory.todayMemory, memory.isLocked);

  useWorkMemoryShortcuts({
    isSearchOpen: search.isSearchOpen,
    onCloseSearch: search.closeSearchPanel,
    onSettleTodayMemory: memory.settleTodayMemory,
    onTriggerSearch: search.openSearchPanel,
  });

  return (
    <main className="max-h-screen w-screen bg-app-bg">
      <section
        className="mx-auto flex max-h-screen w-[min(calc(100%-88px),748px)] flex-col overflow-y-auto py-6 scrollbar-none [&::-webkit-scrollbar]:hidden max-[560px]:w-[min(calc(100%-28px),748px)] max-[560px]:pt-6 max-[560px]:pb-5 max-[600px]:pt-5"
        aria-label="工作记忆首页"
      >
        <div ref={contentRef} className="flex flex-col px-1">
          <HomeToolbar
            commandKey={commandKey}
            date={displayDate}
            dateTime={today.toISOString()}
            searchButtonRef={search.searchButtonRef}
            weekday={displayWeekday}
            onSearchClick={search.openSearchPanel}
          />

          <MemoryHero />

          <MemoryEntryForm
            workNote={memory.workNote}
            isSupplementOpen={memory.isSupplementOpen}
            activeSupplementFields={memory.activeSupplementFields}
            commandKey={commandKey}
            isLocked={memory.isLocked}
            isGeneratingMemory={memory.isGeneratingMemory}
            isPrimaryPulsing={memory.primaryPulse}
            isSavingDraft={memory.isSavingDraft}
            primaryActionLabel={memory.primaryActionLabel}
            primaryActionRef={memory.primaryActionRef}
            supplementFields={supplementFields}
            supplementPlaceholders={supplementPlaceholders}
            supplementValues={memory.supplementValues}
            onSaveDraft={memory.saveDraft}
            onSettleTodayMemory={memory.settleTodayMemory}
            onToggleSupplementPanel={memory.toggleSupplementPanel}
            onToggleSupplementField={memory.toggleSupplementField}
            onSupplementValueChange={memory.updateSupplementValue}
            onWorkNoteChange={memory.setWorkNote}
          />

          <MemoryStatusCard
            statusVariant={statusVariant}
            todayMemory={memory.todayMemory}
            weeklySnapshot={memory.weeklySnapshot}
            onGenerateReport={memory.showReportPlaceholder}
            onViewDraft={memory.viewDraft}
            onViewMemory={memory.viewMemoryList}
          />
        </div>
      </section>
      <DailyMemoryPreviewDialog
        open={memory.isPreviewOpen}
        content={memory.generatedPreview}
        isSaving={memory.isSavingGeneratedMemory}
        saveLabel={memory.saveGeneratedLabel}
        onOpenChange={memory.setIsPreviewOpen}
        onSave={memory.saveGeneratedMemory}
      />
      <MemoryListDialog
        open={memory.isMemoryListOpen}
        items={memory.memoryListItems}
        currentDate={currentDate}
        onOpenChange={memory.setIsMemoryListOpen}
        onEditOriginal={memory.editOriginalRecord}
      />
      <SpotlightSearchPanel
        open={search.isSearchOpen}
        keyword={search.searchKeyword}
        results={search.searchResults}
        activeIndex={search.activeSearchIndex}
        currentDate={currentDate}
        inputRef={search.searchInputRef}
        isComposing={search.isSearchComposing}
        onClose={search.closeSearchPanel}
        onKeywordChange={search.updateSearchKeyword}
        onCompositionStart={search.handleSearchCompositionStart}
        onCompositionEnd={search.handleSearchCompositionEnd}
        onKeyDown={search.handleSearchKeyDown}
        onClear={search.clearSearchKeyword}
        onActiveIndexChange={search.setActiveSearchIndex}
        onOpenMemory={search.openSearchMemory}
      />
      <MemoryDetailDialog
        open={memory.isMemoryDialogOpen}
        memory={memory.viewingMemory}
        currentDate={currentDate}
        onOpenChange={memory.setIsMemoryDialogOpen}
        onEditOriginal={memory.editOriginalRecord}
      />
    </main>
  );
}
