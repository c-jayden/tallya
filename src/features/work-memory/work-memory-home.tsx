import { useEffect, useRef, useState } from 'react';
import { DailyReportDialog } from './components/daily-report-dialog';
import { EntryComposer } from './components/entry-composer';
import { EntryFeed } from './components/entry-feed';
import { HomeToolbar } from './components/home-toolbar';
import { MemoryHero } from './components/memory-hero';
import { ReportDetailDialog } from './components/report-detail-dialog';
import { ReportGapDialog } from './components/report-gap-dialog';
import { ReportGenerateDialog } from './components/report-generate-dialog';
import { ReportListDialog } from './components/report-list-dialog';
import { ReportPreviewDialog } from './components/report-preview-dialog';
import { ReportRestoreConfirmDialog } from './components/report-restore-confirm-dialog';
import { SettingsDialog } from './components/settings-dialog';
import { SpotlightSearchPanel } from './components/spotlight-search-panel';
import { ThreadsPanel } from './components/threads-panel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCommandKeyLabel } from '@/lib/platform';
import { useDailyReportFlow } from './hooks/use-daily-report-flow';
import { useEntriesController } from './hooks/use-entries-controller';
import { useHomeWindowSizing } from './hooks/use-home-window-sizing';
import { useMemorySearch } from './hooks/use-memory-search';
import { useStalledThreadReview } from './hooks/use-stalled-thread-review';
import { useThreadsPanel } from './hooks/use-threads-panel';
import { useTodayDate } from './hooks/use-today-date';
import { useWeeklyReportFlow } from './hooks/use-weekly-report-flow';
import { useAiTaskCoordinator } from './hooks/use-ai-task-coordinator';
import { useTrayWindowEvents } from './hooks/use-tray-window-events';
import { useWorkMemoryShortcuts } from './hooks/use-work-memory-shortcuts';
import {
  formatToolbarDate,
  getDailyMemoryHeroCopy,
  isFutureMemoryDate,
  isTodayDate,
} from './memory-date-view-model';
import { quitApp } from './services/window-service';
import type { Entry } from './types';

export function WorkMemoryHome() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [closeBlockedRequestId, setCloseBlockedRequestId] = useState(0);
  const todayDate = useTodayDate();
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const previousTodayRef = useRef(todayDate);

  // After a midnight rollover, keep a user who was viewing "today" on the new
  // today instead of silently leaving them backfilling yesterday.
  useEffect(() => {
    if (previousTodayRef.current !== todayDate) {
      if (selectedDate === previousTodayRef.current) {
        setSelectedDate(todayDate);
      }

      previousTodayRef.current = todayDate;
    }
  }, [selectedDate, todayDate]);
  const commandKey = getCommandKeyLabel();
  const contentRef = useHomeWindowSizing();
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
  const threads = useThreadsPanel({ currentDate: todayDate });
  const stalledReview = useStalledThreadReview({ currentDate: todayDate });
  // Declared after threads so a newly persisted merge suggestion can refresh the
  // hub's count/list without polling.
  const entries = useEntriesController({
    currentDate: selectedDate,
    todayDate,
    onThreadSuggestionsChanged: threads.refreshSuggestions,
  });
  const aiTasks = useAiTaskCoordinator();
  const weeklyReport = useWeeklyReportFlow({ aiTaskCoordinator: aiTasks });
  const dailyReport = useDailyReportFlow({ aiTaskCoordinator: aiTasks });
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
    dailyReport.close();
  }

  function openDailyReport() {
    closeOverlays();
    dailyReport.open({
      date: selectedDate,
      entries: entries.entries,
      clarificationsByEntry: entries.clarificationsByEntry,
    });
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
    onWindowHidden: aiTasks.handleWindowHidden,
    onCloseBlocked: () => setCloseBlockedRequestId((current) => current + 1),
  });

  function updateSelectedDate(date: string) {
    if (!date || isFutureMemoryDate(date, todayDate)) {
      return;
    }

    setSelectedDate(date);
  }

  async function handleClearLocalData() {
    await entries.clearLocalData();
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen w-screen bg-app-bg">
      <section
        className="mx-auto flex max-h-screen w-[min(calc(100%-88px),748px)] flex-col overflow-y-auto py-11 scrollbar-none [&::-webkit-scrollbar]:hidden max-[560px]:w-[min(calc(100%-28px),748px)] max-[560px]:py-3.5"
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
            hasThreadsNudge={stalledReview.hasReviewNudge}
            mergeCount={threads.pendingMergeCount}
            onDateChange={updateSelectedDate}
            onSearchClick={() => {
              closeOverlays();
              search.openSearchPanel();
            }}
            onThreadsClick={() => {
              closeOverlays();
              // Opening the panel counts as seeing the review, so clear the dot.
              stalledReview.markReviewed();
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

          {entries.entries.length > 0 ? (
            <div className="mb-1.5 flex justify-end">
              <button
                type="button"
                className="cursor-pointer rounded-lg px-2 py-1 text-[13px] text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:outline-none"
                onClick={openDailyReport}
              >
                {isSelectedDateToday ? '整理今日' : '整理这天'}
              </button>
            </div>
          ) : null}

          <EntryFeed
            entries={entries.entries}
            clarificationsByEntry={entries.clarificationsByEntry}
            focusedEntryId={focusedEntryId}
            isLoading={entries.isLoading}
            emptyHint={emptyHint}
            onUpdateEntry={entries.updateEntry}
            onRemoveEntry={entries.removeEntry}
            onAddClarification={entries.addClarification}
            onRemoveClarification={entries.removeClarification}
            onMergeEntryExisting={entries.mergeEntryIntoThread}
            onMergeEntryNew={entries.mergeEntryIntoNewThread}
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
        stalledThreadIds={threads.stalledThreadIds}
        pendingSuggestions={threads.pendingSuggestions}
        selectedThread={threads.selectedThread}
        onClose={threads.closeThreadsPanel}
        onConfirmSuggestion={threads.confirmSuggestion}
        onDismissSuggestion={threads.dismissSuggestion}
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
        closeRequestId={closeBlockedRequestId}
        onAfterForceClose={() => void quitApp()}
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
        closeRequestId={closeBlockedRequestId}
        onAfterForceClose={() => void quitApp()}
        onOpenChange={weeklyReport.setIsGapDialogOpen}
        onBack={weeklyReport.backToGenerateFromGaps}
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

      <ReportRestoreConfirmDialog
        open={weeklyReport.isRestorePromptOpen}
        onOpenChange={weeklyReport.setIsRestorePromptOpen}
        onRestore={weeklyReport.restoreLastReport}
        onDiscard={weeklyReport.discardLastReport}
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
        closeRequestId={closeBlockedRequestId}
        onAfterForceClose={() => void quitApp()}
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
        aiTaskCoordinator={aiTasks}
        closeRequestId={closeBlockedRequestId}
        onAfterForceClose={() => void quitApp()}
      />

      <DailyReportDialog
        open={dailyReport.isOpen}
        dateLabel={isSelectedDateToday ? '今天' : toolbarDate.date}
        reportText={dailyReport.reportText}
        isGenerating={dailyReport.isGenerating}
        aiAlert={dailyReport.aiAlert}
        closeRequestId={closeBlockedRequestId}
        onOpenChange={(open) => {
          if (!open) {
            dailyReport.close();
          }
        }}
        onForceClose={dailyReport.forceClose}
        onAfterForceClose={() => void quitApp()}
        onDismissAlert={dailyReport.dismissAiAlert}
        onTextChange={dailyReport.setReportText}
        onGenerateWithAI={dailyReport.generateWithAI}
        onCopy={dailyReport.copy}
      />
      </main>
    </TooltipProvider>
  );
}
