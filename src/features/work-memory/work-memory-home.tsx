import {
  supplementFields,
  supplementPlaceholders,
  today,
} from './constants';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DailyMemoryPreviewDialog } from './components/daily-memory-preview-dialog';
import { HomeToolbar } from './components/home-toolbar';
import { MemoryEntryForm } from './components/memory-entry-form';
import { MemoryDetailDialog } from './components/memory-detail-dialog';
import { MemoryHero } from './components/memory-hero';
import { MemoryListDialog } from './components/memory-list-dialog';
import { MemoryStatusCard } from './components/memory-status-card';
import { ReportDetailDialog } from './components/report-detail-dialog';
import { ReportGenerateDialog } from './components/report-generate-dialog';
import { ReportListDialog } from './components/report-list-dialog';
import { ReportPreviewDialog } from './components/report-preview-dialog';
import { SettingsDialog } from './components/settings-dialog';
import { SpotlightSearchPanel } from './components/spotlight-search-panel';
import { getCommandKeyLabel } from '@/lib/platform';
import { useHomeWindowSizing } from './hooks/use-home-window-sizing';
import { useMemorySearch } from './hooks/use-memory-search';
import { useTrayWindowEvents } from './hooks/use-tray-window-events';
import { useWeeklyReportFlow } from './hooks/use-weekly-report-flow';
import { useWorkMemoryController } from './hooks/use-work-memory-controller';
import { useWorkMemoryShortcuts } from './hooks/use-work-memory-shortcuts';
import {
  formatToolbarDate,
  getDailyMemoryHeroCopy,
  isFutureMemoryDate,
  isTodayDate,
} from './memory-date-view-model';
import { getMemoryStatusSummary, getStatusVariant } from './memory-view-model';
import { getDailyMemoryDate } from './services/daily-memory-repository';
import type { DailyMemory } from './types';

export function WorkMemoryHome() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const todayDate = getDailyMemoryDate(today);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const commandKey = getCommandKeyLabel();
  const contentRef = useHomeWindowSizing();
  const memory = useWorkMemoryController({ currentDate: selectedDate, todayDate });
  const search = useMemorySearch({ onOpenMemory: memory.openMemoryDetail });
  const weeklyReport = useWeeklyReportFlow();
  const statusVariant = getStatusVariant(memory.todayMemory, memory.isLocked);
  const memoryStatusSummary = getMemoryStatusSummary({
    selectedDate,
    todayDate,
    selectedDateMemory: memory.currentMemory,
    memories: memory.memories,
    hasReports: weeklyReport.hasSavedReports,
    hasCurrentWeekReport: weeklyReport.hasCurrentWeekReport,
  });
  const toolbarDate = formatToolbarDate(selectedDate);
  const heroCopy = getDailyMemoryHeroCopy(selectedDate, todayDate);
  const selectedDateHint = isTodayDate(selectedDate, todayDate)
    ? undefined
    : `当前正在记录 ${toolbarDate.date}`;

  useWorkMemoryShortcuts({
    isSearchOpen: search.isSearchOpen,
    onCloseSearch: search.closeSearchPanel,
    onSettleTodayMemory: memory.settleTodayMemory,
    onTriggerSearch: () => {
      if (!weeklyReport.isReportBusy) {
        search.openSearchPanel();
      }
    },
  });

  function closeHomeOverlays() {
    if (weeklyReport.isReportBusy) {
      return;
    }

    setIsSettingsOpen(false);
    search.closeSearchPanel();
    memory.setIsMemoryDialogOpen(false);
    memory.setIsMemoryListOpen(false);
    memory.setIsPreviewOpen(false);
    weeklyReport.closeReportDialogs();
  }

  useTrayWindowEvents({
    onFocusEntry: () => {
      if (weeklyReport.isReportBusy) {
        return;
      }

      closeHomeOverlays();
      window.setTimeout(() => memory.workNoteInputRef.current?.focus(), 0);
    },
    onOpenSearch: () => {
      if (weeklyReport.isReportBusy) {
        return;
      }

      setIsSettingsOpen(false);
      weeklyReport.closeReportDialogs();
      memory.setIsMemoryDialogOpen(false);
      memory.setIsMemoryListOpen(false);
      memory.setIsPreviewOpen(false);
      search.openSearchPanel();
    },
    onOpenSettings: () => {
      if (weeklyReport.isReportBusy) {
        return;
      }

      search.closeSearchPanel();
      weeklyReport.closeReportDialogs();
      memory.setIsMemoryDialogOpen(false);
      memory.setIsMemoryListOpen(false);
      memory.setIsPreviewOpen(false);
      setIsSettingsOpen(true);
    },
  });

  function updateSelectedDate(date: string) {
    if (!date || isFutureMemoryDate(date, todayDate)) {
      return;
    }

    // TODO: Add a gentle unsaved-change confirmation before switching dates.
    setSelectedDate(date);
  }

  function editOriginalRecord(memoryItem: DailyMemory) {
    updateSelectedDate(memoryItem.date);
    void memory.editOriginalRecord(memoryItem);
  }

  return (
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
            selectedDate={selectedDate}
            weekday={toolbarDate.weekday}
            onDateChange={updateSelectedDate}
            onSearchClick={() => {
              if (!weeklyReport.isReportBusy) {
                search.openSearchPanel();
              }
            }}
            onSettingsClick={() => {
              if (!weeklyReport.isReportBusy) {
                setIsSettingsOpen(true);
              }
            }}
          />

          <MemoryHero
            title={heroCopy.title}
            description={heroCopy.description}
            selectedDateHint={selectedDateHint}
          />

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
            placeholder={memory.workNotePlaceholder}
            primaryActionRef={memory.primaryActionRef}
            workNoteInputRef={memory.workNoteInputRef}
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
            summary={memoryStatusSummary}
            onGenerateReport={weeklyReport.openGenerateDialog}
            onViewReports={weeklyReport.openReportList}
            onViewDraft={memory.viewDraft}
            onViewMemory={memory.viewMemoryList}
          />
        </div>
      </section>
      <DailyMemoryPreviewDialog
        open={memory.isPreviewOpen}
        content={memory.generatedPreview}
        title={memory.previewTitle}
        description={memory.previewDescription}
        isSaving={memory.isSavingGeneratedMemory}
        saveLabel={memory.saveGeneratedLabel}
        onOpenChange={memory.setIsPreviewOpen}
        onSave={memory.saveGeneratedMemory}
      />
      <MemoryListDialog
        open={memory.isMemoryListOpen}
        items={memory.memoryListItems}
        currentDate={todayDate}
        referencedMemoryIds={memory.referencedMemoryIds}
        onOpenChange={memory.setIsMemoryListOpen}
        onCopyDailyReport={memory.copyMemoryDailyReport}
        onEditOriginal={editOriginalRecord}
      />
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
      <MemoryDetailDialog
        open={memory.isMemoryDialogOpen}
        memory={memory.viewingMemory}
        currentDate={selectedDate}
        isReferencedByReport={memory.isViewingMemoryReferenced}
        onOpenChange={memory.setIsMemoryDialogOpen}
        onCopyDailyReport={memory.copyViewingMemoryDailyReport}
        onEditOriginal={() => {
          if (memory.viewingMemory) {
            editOriginalRecord(memory.viewingMemory);
          }
        }}
      />
      <ReportGenerateDialog
        open={weeklyReport.isGenerateDialogOpen}
        context={weeklyReport.reportContext}
        reportType={weeklyReport.reportType}
        customStartDate={weeklyReport.customStartDate}
        customEndDate={weeklyReport.customEndDate}
        isLoading={weeklyReport.isLoadingContext}
        isGenerating={weeklyReport.isGeneratingReport}
        onOpenChange={weeklyReport.setIsGenerateDialogOpen}
        onReportTypeChange={weeklyReport.setReportType}
        onCustomStartDateChange={weeklyReport.updateCustomStartDate}
        onCustomEndDateChange={weeklyReport.updateCustomEndDate}
        onGenerate={weeklyReport.generateReport}
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
        onClearLocalData={memory.clearLocalData}
        onDataRestored={async () => {
          await memory.reloadCurrentDate();
          await weeklyReport.reloadReports();
        }}
      />
      <AlertDialog
        open={memory.isReferenceConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            memory.cancelReferencedMemorySave();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>这天的记忆已被报告引用</AlertDialogTitle>
            <AlertDialogDescription>
              更新后，相关报告可能需要重新生成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={memory.confirmReferencedMemorySave}
            >
              继续更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
