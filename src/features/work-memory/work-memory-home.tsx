import { today } from './constants';
import { useEffect, useRef, useState } from 'react';
import { EntryComposer } from './components/entry-composer';
import { EntryFeed } from './components/entry-feed';
import { HomeToolbar } from './components/home-toolbar';
import { MemoryHero } from './components/memory-hero';
import { ReportDetailDialog } from './components/report-detail-dialog';
import { ReportGapDialog } from './components/report-gap-dialog';
import { ReportGenerateDialog } from './components/report-generate-dialog';
import { ReportListDialog } from './components/report-list-dialog';
import { ReportPreviewDialog } from './components/report-preview-dialog';
import { SettingsDialog } from './components/settings-dialog';
import { SpotlightSearchPanel } from './components/spotlight-search-panel';
import { ThreadsPanel } from './components/threads-panel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCommandKeyLabel } from '@/lib/platform';
import { useEntriesController } from './hooks/use-entries-controller';
import { useHomeWindowSizing } from './hooks/use-home-window-sizing';
import { useMemorySearch } from './hooks/use-memory-search';
import { useThreadsPanel } from './hooks/use-threads-panel';
import { useWeeklyReportFlow } from './hooks/use-weekly-report-flow';
import { useTrayWindowEvents } from './hooks/use-tray-window-events';
import { useWorkMemoryShortcuts } from './hooks/use-work-memory-shortcuts';
import {
  formatToolbarDate,
  getDailyMemoryHeroCopy,
  isFutureMemoryDate,
  isTodayDate,
} from './memory-date-view-model';
import { getEntryDate } from './services/entry-repository';
import { dailyMemoryRepository } from './services/daily-memory-repository';
import type { Entry } from './types';

export function WorkMemoryHome() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const todayDate = getEntryDate(today);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const commandKey = getCommandKeyLabel();
  const contentRef = useHomeWindowSizing();
  const entries = useEntriesController({ currentDate: selectedDate, todayDate });
  const isSelectedDateToday = isTodayDate(selectedDate, todayDate);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  function openEntry(entry: Entry) {
    // Opening a search hit jumps to its day and briefly highlights the row, so
    // the action reads as "found it" even when the entry is already on screen.
    if (!isFutureMemoryDate(entry.occurredOn, todayDate)) {
      setSelectedDate(entry.occurredOn);
    }

    setFocusedEntryId(entry.id);

    if (focusTimeoutRef.current) {
      window.clearTimeout(focusTimeoutRef.current);
    }

    focusTimeoutRef.current = window.setTimeout(() => setFocusedEntryId(null), 2200);
  }

  const search = useMemorySearch({ onOpenMemory: openEntry });
  const threads = useThreadsPanel();
  const weeklyReport = useWeeklyReportFlow();
  const reportsButtonRef = useRef<HTMLButtonElement>(null);

  function openEntryFromThread(entry: Entry) {
    threads.closeThreadsPanel();
    openEntry(entry);
  }

  function closeOverlays() {
    search.closeSearchPanel();
    threads.closeThreadsPanel();
    setIsSettingsOpen(false);
    weeklyReport.closeReportDialogs();
  }

  const toolbarDate = formatToolbarDate(selectedDate);
  const heroCopy = getDailyMemoryHeroCopy(selectedDate, todayDate);
  const selectedDateHint = isSelectedDateToday
    ? undefined
    : `当前正在记录 ${toolbarDate.date}`;
  const composerPlaceholder = isSelectedDateToday
    ? '记一条今天做的事，例如：对接订单接口'
    : `补记 ${toolbarDate.date} 这天做的事`;
  const emptyHint = isSelectedDateToday
    ? '今天还没有记录，写一条开始吧。'
    : '这天还没有记录。';

  useWorkMemoryShortcuts({
    isSearchOpen: search.isSearchOpen,
    onCloseSearch: search.closeSearchPanel,
    onSettleTodayMemory: () => entries.composerRef.current?.focus(),
    onTriggerSearch: () => {
      threads.closeThreadsPanel();
      search.openSearchPanel();
    },
  });

  useTrayWindowEvents({
    onFocusEntry: () => {
      closeOverlays();
      window.setTimeout(() => entries.composerRef.current?.focus(), 0);
    },
    onOpenSearch: () => {
      closeOverlays();
      search.openSearchPanel();
    },
    onOpenSettings: () => {
      closeOverlays();
      setIsSettingsOpen(true);
    },
  });

  function updateSelectedDate(date: string) {
    if (!date || isFutureMemoryDate(date, todayDate)) {
      return;
    }

    setSelectedDate(date);
  }

  async function handleClearLocalData() {
    await entries.clearLocalData();
    // Legacy daily-memory rows / reports are wiped too so "清除数据" stays a
    // full reset during the entry-model transition.
    await dailyMemoryRepository.clearLocalData();
  }

  return (
    <TooltipProvider>
      <main className="max-h-screen w-screen bg-app-bg">
      <section
        className="mx-auto flex max-h-screen w-[min(calc(100%-88px),748px)] flex-col overflow-y-auto py-6 scrollbar-none [&::-webkit-scrollbar]:hidden max-[560px]:w-[min(calc(100%-28px),748px)] max-[560px]:pt-6 max-[560px]:pb-5 max-[600px]:pt-5"
        aria-label="工作记忆首页"
      >
        <div ref={contentRef} className="flex flex-col px-1">
          <HomeToolbar
            commandKey={commandKey}
            date={toolbarDate.date}
            dateTime={toolbarDate.dateTime}
            maxDate={todayDate}
            searchButtonRef={search.searchButtonRef}
            threadsButtonRef={threads.threadsButtonRef}
            reportsButtonRef={reportsButtonRef}
            selectedDate={selectedDate}
            weekday={toolbarDate.weekday}
            onDateChange={updateSelectedDate}
            onSearchClick={() => {
              closeOverlays();
              search.openSearchPanel();
            }}
            onThreadsClick={() => {
              closeOverlays();
              threads.openThreadsPanel();
            }}
            onReportsClick={() => {
              closeOverlays();
              weeklyReport.openGenerateDialog();
            }}
            onSettingsClick={() => {
              closeOverlays();
              setIsSettingsOpen(true);
            }}
          />

          <MemoryHero
            title={heroCopy.title}
            description={heroCopy.description}
            selectedDateHint={selectedDateHint}
          />

          <EntryComposer
            placeholder={composerPlaceholder}
            isSaving={entries.isSaving}
            inputRef={entries.composerRef}
            onSubmit={entries.createEntry}
          />

          <EntryFeed
            entries={entries.entries}
            clarificationsByEntry={entries.clarificationsByEntry}
            threadSuggestionByEntry={entries.threadSuggestionByEntry}
            focusedEntryId={focusedEntryId}
            isLoading={entries.isLoading}
            emptyHint={emptyHint}
            onUpdateEntry={entries.updateEntry}
            onRemoveEntry={entries.removeEntry}
            onAddClarification={entries.addClarification}
            onRemoveClarification={entries.removeClarification}
            onConfirmThreadSuggestion={entries.confirmThreadSuggestion}
            onDismissThreadSuggestion={entries.dismissThreadSuggestion}
            onSuggestQuestions={entries.suggestQuestions}
          />
        </div>
      </section>

      <SpotlightSearchPanel
        open={search.isSearchOpen}
        keyword={search.searchKeyword}
        results={search.searchResults}
        activeIndex={search.activeSearchIndex}
        currentDate={todayDate}
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

      <ThreadsPanel
        open={threads.isThreadsOpen}
        currentDate={todayDate}
        threadSummaries={threads.threadSummaries}
        selectedThread={threads.selectedThread}
        onClose={threads.closeThreadsPanel}
        onOpenThread={threads.openThread}
        onBackThreadList={threads.backToThreadList}
        onOpenEntry={openEntryFromThread}
      />

      <ReportGenerateDialog
        open={weeklyReport.isGenerateDialogOpen}
        context={weeklyReport.reportContext}
        reportType={weeklyReport.reportType}
        customStartDate={weeklyReport.customStartDate}
        customEndDate={weeklyReport.customEndDate}
        isLoading={weeklyReport.isLoadingContext}
        isGenerating={weeklyReport.isGeneratingReport || weeklyReport.isDetectingGaps}
        onOpenChange={weeklyReport.setIsGenerateDialogOpen}
        onReportTypeChange={weeklyReport.setReportType}
        onCustomStartDateChange={weeklyReport.updateCustomStartDate}
        onCustomEndDateChange={weeklyReport.updateCustomEndDate}
        onGenerate={weeklyReport.generateReport}
        onViewReports={weeklyReport.openReportList}
      />

      <ReportGapDialog
        open={weeklyReport.isGapDialogOpen}
        gaps={weeklyReport.reportGaps}
        isGenerating={weeklyReport.isGeneratingReport}
        onOpenChange={weeklyReport.setIsGapDialogOpen}
        onSubmit={weeklyReport.submitGapAnswers}
        onSkip={weeklyReport.skipGaps}
      />

      <ReportPreviewDialog
        open={weeklyReport.isPreviewDialogOpen}
        draft={weeklyReport.reportDraft}
        isSaving={weeklyReport.isSavingReport}
        onOpenChange={weeklyReport.setIsPreviewDialogOpen}
        onCopyText={weeklyReport.copyPlainText}
        onCopyMarkdown={weeklyReport.copyMarkdown}
        onSave={weeklyReport.saveReportPreview}
      />

      <ReportListDialog
        open={weeklyReport.isReportListOpen}
        reports={weeklyReport.reportListItems}
        onOpenChange={weeklyReport.setIsReportListOpen}
        onOpenReport={weeklyReport.openReportDetail}
      />

      <ReportDetailDialog
        open={weeklyReport.isReportDetailOpen}
        report={weeklyReport.selectedReport}
        isRegenerating={weeklyReport.isGeneratingReport}
        onOpenChange={weeklyReport.setIsReportDetailOpen}
        onCopyText={weeklyReport.copySavedReportPlainText}
        onCopyMarkdown={weeklyReport.copySavedReportMarkdown}
        onRegenerate={weeklyReport.regenerateSelectedReport}
      />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onClearLocalData={handleClearLocalData}
        onDataRestored={entries.reload}
      />
      </main>
    </TooltipProvider>
  );
}
