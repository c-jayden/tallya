import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  displayDate,
  displayWeekday,
  supplementFields,
  supplementPlaceholders,
  today,
  type SupplementField,
} from './constants';
import { HomeToolbar } from './components/home-toolbar';
import { MemoryEntryForm } from './components/memory-entry-form';
import { MemoryHero } from './components/memory-hero';
import { MemoryStatusCard } from './components/memory-status-card';
import { dailyMemoryRepository, getDailyMemoryDate } from './services/daily-memory-repository';
import { mockGenerateDailyMemory } from './services/mock-generate-daily-memory';
import type {
  DailyMemory,
  DailyMemoryGeneratedContent,
  DailyMemoryPreviewSection,
  DailyMemorySupplements,
  WeeklySnapshot,
  StatusVariant,
  TodayMemoryState,
} from './types';
import { resizeHomeWindowToContent } from './window-sizing';

function getCommandKey() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    ? 'Cmd'
    : 'Ctrl';
}

function getStatusVariant(todayMemory: TodayMemoryState, isLocked: boolean): StatusVariant {
  if (isLocked) {
    return 'locked';
  }

  if (todayMemory.officialStatus === 'generated') {
    return 'settled';
  }

  return todayMemory.hasDraft ? 'draft' : 'empty';
}

function getMemorySummary(memory: DailyMemory) {
  return memory.generated?.summary ?? memory.rawContent;
}

function getFallbackWeeklySnapshot(): WeeklySnapshot {
  return {
    settledDays: 0,
    lastMemoryDate: '',
    lastMemorySummary: '',
  };
}

function getWeeklySnapshotFromMemories(memories: DailyMemory[]): WeeklySnapshot {
  const generatedMemories = memories
    .filter((memory) => memory.status === 'generated' || memory.status === 'locked')
    .sort((first, second) => second.date.localeCompare(first.date));
  const lastMemory = generatedMemories[0];

  if (!lastMemory) {
    return getFallbackWeeklySnapshot();
  }

  return {
    settledDays: generatedMemories.length,
    lastMemoryDate: lastMemory.date === getDailyMemoryDate(today) ? '今天' : '昨天',
    lastMemorySummary: getMemorySummary(lastMemory),
  };
}

function getTodayMemoryState(
  memory: DailyMemory | null,
  memories: DailyMemory[] = [],
): TodayMemoryState {
  const hasGeneratedHistory = memories.some(
    (item) => item.status === 'generated' || item.status === 'locked',
  );

  if (!memory) {
    return {
      officialStatus: 'notGenerated',
      hasDraft: false,
      hasGeneratedHistory,
      referencedByWeeklyReport: false,
      reportFreshness: 'fresh',
    };
  }

  return {
    officialStatus:
      memory.status === 'locked'
        ? 'locked'
        : memory.status === 'generated'
          ? 'generated'
          : 'notGenerated',
    hasDraft: memory.status === 'draft',
    hasGeneratedHistory:
      hasGeneratedHistory || memory.status === 'generated' || memory.status === 'locked',
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  };
}

function getPreviewItems(content: string[]) {
  const items = content.map((item) => item.trim()).filter(Boolean);

  return items.length > 0 ? items : null;
}

function getMemoryPreviewSections(
  content: DailyMemoryGeneratedContent | null,
): DailyMemoryPreviewSection[] {
  if (!content) {
    return [];
  }

  return [
    {
      title: '今日摘要',
      content: [content.summary],
    },
    {
      title: '完成事项',
      content: content.completedItems,
    },
    {
      title: '关键产出',
      content: content.keyOutcome ? [content.keyOutcome] : [],
    },
    {
      title: '遇到问题',
      content: content.problems ? [content.problems] : [],
    },
    {
      title: '明日计划',
      content: content.tomorrowPlan ? [content.tomorrowPlan] : [],
    },
    {
      title: '补充说明',
      content: content.extraNote ? [content.extraNote] : [],
    },
  ];
}

function getUnmentionedSectionTitles(content: DailyMemoryGeneratedContent | null) {
  return getMemoryPreviewSections(content)
    .filter((section) => !getPreviewItems(section.content))
    .map((section) => section.title);
}

export function WorkMemoryHome() {
  const currentDate = getDailyMemoryDate(today);
  const [workNote, setWorkNote] = useState('');
  const [isSupplementOpen, setIsSupplementOpen] = useState(false);
  const [activeSupplementFields, setActiveSupplementFields] = useState<SupplementField[]>([]);
  const [supplementValues, setSupplementValues] = useState<Record<SupplementField, string>>({
    '项目/主题': '',
    明日计划: '',
    补充说明: '',
  });
  const [todayMemory, setTodayMemory] = useState<TodayMemoryState>({
    officialStatus: 'notGenerated',
    hasDraft: false,
    hasGeneratedHistory: false,
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  });
  const [currentMemory, setCurrentMemory] = useState<DailyMemory | null>(null);
  const [memories, setMemories] = useState<DailyMemory[]>([]);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot>(getFallbackWeeklySnapshot);
  const [searchPulse, setSearchPulse] = useState(false);
  const [primaryPulse, setPrimaryPulse] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false);
  const [isSavingGeneratedMemory, setIsSavingGeneratedMemory] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<DailyMemoryGeneratedContent | null>(
    null,
  );
  const [viewingMemory, setViewingMemory] = useState<DailyMemory | null>(null);
  const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pulseTimeoutsRef = useRef<number[]>([]);
  const commandKey = getCommandKey();
  const hasGeneratedToday = todayMemory.officialStatus !== 'notGenerated';
  const isLocked = todayMemory.officialStatus === 'locked';
  const primaryActionLabel = hasGeneratedToday ? '更新今日记录' : '整理成今日记录';
  const saveGeneratedLabel = hasGeneratedToday ? '更新今日记录' : '保存为今日记忆';
  const statusVariant = getStatusVariant(todayMemory, isLocked);
  const unmentionedPreviewFields = getUnmentionedSectionTitles(generatedPreview);
  const viewingMemorySections = getMemoryPreviewSections(viewingMemory?.generated ?? null);
  const unmentionedViewingFields = getUnmentionedSectionTitles(viewingMemory?.generated ?? null);
  const isViewingTodayMemory = viewingMemory?.date === currentDate;
  const viewingMemoryTitle = isViewingTodayMemory ? '今日记忆' : '工作记忆';
  const viewingMemoryDescription = isViewingTodayMemory
    ? '这是今天已保存的正式工作记忆。'
    : `${viewingMemory?.date ?? ''} 已保存的正式工作记忆。`;

  const buildDailyMemoryInput = useCallback(() => {
    const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;
    const supplements: DailyMemorySupplements = {};

    if (activeSupplementFields.includes(projectTopicField)) {
      supplements.projectTopic = supplementValues[projectTopicField];
    }

    if (activeSupplementFields.includes(tomorrowPlanField)) {
      supplements.tomorrowPlan = supplementValues[tomorrowPlanField];
    }

    if (activeSupplementFields.includes(extraNoteField)) {
      supplements.extraNote = supplementValues[extraNoteField];
    }

    return {
      date: currentDate,
      rawContent: workNote,
      supplements,
    };
  }, [activeSupplementFields, currentDate, supplementValues, workNote]);

  const applyDailyMemory = useCallback(
    (memory: DailyMemory | null, memories: DailyMemory[] = []) => {
      setCurrentMemory(memory);
      setMemories(memories);
      setTodayMemory(getTodayMemoryState(memory, memories));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories));

      if (!memory) {
        return;
      }

      const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

      setWorkNote(memory.rawContent);
      setSupplementValues((current) => ({
        ...current,
        [projectTopicField]: memory.supplements.projectTopic ?? '',
        [tomorrowPlanField]: memory.supplements.tomorrowPlan ?? '',
        [extraNoteField]: memory.supplements.extraNote ?? '',
      }));
      setActiveSupplementFields(
        [
          memory.supplements.projectTopic ? projectTopicField : null,
          memory.supplements.tomorrowPlan ? tomorrowPlanField : null,
          memory.supplements.extraNote ? extraNoteField : null,
        ].filter((field): field is SupplementField => field !== null),
      );
      setIsSupplementOpen(
        Boolean(
          memory.supplements.projectTopic ||
            memory.supplements.tomorrowPlan ||
            memory.supplements.extraNote,
        ),
      );
    },
    [],
  );

  const pulseAction = useCallback(
    (setter: (value: boolean) => void, button: HTMLButtonElement | null) => {
      setter(true);
      button?.focus({ preventScroll: true });
      const timeoutId = window.setTimeout(() => setter(false), 700);
      pulseTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

  const settleTodayMemory = useCallback(async () => {
    if (isLocked || isGeneratingMemory || isSavingDraft) {
      return;
    }

    if (!workNote.trim()) {
      toast.warning('先写点内容再整理');
      return;
    }

    setIsGeneratingMemory(true);
    pulseAction(setPrimaryPulse, primaryActionRef.current);

    try {
      const generatedContent = await mockGenerateDailyMemory(buildDailyMemoryInput());

      setGeneratedPreview(generatedContent);
      setIsPreviewOpen(true);
    } finally {
      setIsGeneratingMemory(false);
    }
  }, [buildDailyMemoryInput, isGeneratingMemory, isLocked, isSavingDraft, pulseAction, workNote]);

  const triggerSearch = useCallback(() => {
    pulseAction(setSearchPulse, searchButtonRef.current);
  }, [pulseAction]);

  useEffect(() => {
    let isMounted = true;

    void Promise.all([
      dailyMemoryRepository.getByDate(currentDate),
      dailyMemoryRepository.list(),
    ]).then(([memory, memories]) => {
      if (isMounted) {
        applyDailyMemory(memory, memories);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [applyDailyMemory, currentDate]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isCommandShortcut = event.ctrlKey || event.metaKey;

      if (!isCommandShortcut) {
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        triggerSearch();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        settleTodayMemory();
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current = [];
    };
  }, [settleTodayMemory, triggerSearch]);

  useEffect(() => {
    const contentElement = contentRef.current;

    if (!contentElement || typeof ResizeObserver === 'undefined') {
      void resizeHomeWindowToContent(contentElement);
      return;
    }

    let animationFrameId = 0;
    const scheduleResize = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        void resizeHomeWindowToContent(contentElement);
      });
    };
    const resizeObserver = new ResizeObserver(scheduleResize);

    resizeObserver.observe(contentElement);
    scheduleResize();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  function toggleSupplementPanel() {
    setIsSupplementOpen((current) => !current);
  }

  function updateSupplementValue(field: SupplementField, value: string) {
    setSupplementValues((current) => ({ ...current, [field]: value }));
  }

  function toggleSupplementField(field: SupplementField) {
    setActiveSupplementFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  async function saveDraft() {
    if (isLocked || isSavingDraft || isGeneratingMemory) {
      return;
    }

    if (!workNote.trim()) {
      toast.warning('先写点内容再保存');
      return;
    }

    setIsSavingDraft(true);

    try {
      const memory = await dailyMemoryRepository.saveDraft(buildDailyMemoryInput());
      const memories = await dailyMemoryRepository.list();

      setCurrentMemory(memory);
      setMemories(memories);
      setTodayMemory(getTodayMemoryState(memory, memories));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories));
      toast.success('草稿已保存');
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function saveGeneratedMemory() {
    if (!generatedPreview || isSavingGeneratedMemory) {
      return;
    }

    setIsSavingGeneratedMemory(true);

    try {
      const memory = await dailyMemoryRepository.saveGenerated({
        ...buildDailyMemoryInput(),
        generated: generatedPreview,
      });
      const memories = await dailyMemoryRepository.list();

      setCurrentMemory(memory);
      setMemories(memories);
      setTodayMemory((current) => ({
        ...getTodayMemoryState(memory, memories),
        reportFreshness: current.referencedByWeeklyReport ? 'stale' : current.reportFreshness,
      }));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories));
      setIsPreviewOpen(false);
      toast.success('今日记忆已保存');
    } finally {
      setIsSavingGeneratedMemory(false);
    }
  }

  function viewDraft() {
    if (currentMemory) {
      applyDailyMemory(currentMemory, memories);
    }

    toast.info('已回到草稿编辑');
  }

  function viewTodayMemory() {
    if (!currentMemory?.generated) {
      return;
    }

    setViewingMemory(currentMemory);
    setIsMemoryDialogOpen(true);
  }

  function viewLatestMemory() {
    const latestMemory = memories
      .filter((memory) => memory.status === 'generated' || memory.status === 'locked')
      .sort((first, second) => second.date.localeCompare(first.date))[0];

    if (!latestMemory?.generated) {
      return;
    }

    setViewingMemory(latestMemory);
    setIsMemoryDialogOpen(true);
  }

  function editOriginalRecord() {
    if (viewingMemory) {
      applyDailyMemory(viewingMemory, memories);
    }

    setIsMemoryDialogOpen(false);
  }

  function showReportPlaceholder() {
    toast.info('周报功能稍后接入');
  }

  function showWeeklyReportPlaceholder() {
    toast.info('周报查看稍后接入');
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
            date={displayDate}
            dateTime={today.toISOString()}
            isSearchPulsing={searchPulse}
            searchButtonRef={searchButtonRef}
            weekday={displayWeekday}
            onSearchClick={triggerSearch}
          />

          <MemoryHero />

          <MemoryEntryForm
            workNote={workNote}
            isSupplementOpen={isSupplementOpen}
            activeSupplementFields={activeSupplementFields}
            commandKey={commandKey}
            isLocked={isLocked}
            isGeneratingMemory={isGeneratingMemory}
            isPrimaryPulsing={primaryPulse}
            isSavingDraft={isSavingDraft}
            primaryActionLabel={primaryActionLabel}
            primaryActionRef={primaryActionRef}
            supplementFields={supplementFields}
            supplementPlaceholders={supplementPlaceholders}
            supplementValues={supplementValues}
            onSaveDraft={saveDraft}
            onSettleTodayMemory={settleTodayMemory}
            onToggleSupplementPanel={toggleSupplementPanel}
            onToggleSupplementField={toggleSupplementField}
            onSupplementValueChange={updateSupplementValue}
            onWorkNoteChange={setWorkNote}
          />

          <MemoryStatusCard
            isLocked={isLocked}
            statusVariant={statusVariant}
            todayMemory={todayMemory}
            weeklySnapshot={weeklySnapshot}
            onGenerateReport={showReportPlaceholder}
            onViewDraft={viewDraft}
            onViewMemory={viewLatestMemory}
            onViewTodayMemory={viewTodayMemory}
            onViewWeeklyReport={showWeeklyReportPlaceholder}
          />
        </div>
      </section>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
            <DialogTitle>今日记忆预览</DialogTitle>
            <DialogDescription>确认后会保存为今天唯一一条工作记忆。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(100vh-220px)] flex-1 overflow-y-auto px-6 pb-5">
            <div className="divide-y divide-app-border">
              {getMemoryPreviewSections(generatedPreview)
                .filter((section) => getPreviewItems(section.content))
                .map((section) => {
                  const previewItems = getPreviewItems(section.content);
                  const usesList = section.title === '完成事项' || (previewItems?.length ?? 0) > 1;

                  if (!previewItems) {
                    return null;
                  }

                  return (
                    <section key={section.title} className="py-3 first:pt-0 last:pb-0">
                      <h3 className="text-sm leading-5 font-semibold text-app-ink">
                        {section.title}
                      </h3>
                      {usesList ? (
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[14px] leading-[1.58] text-app-ink-muted">
                          {previewItems.map((item, index) => (
                            <li key={`${section.title}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[14px] leading-[1.62] text-app-ink-muted">
                          {previewItems[0]}
                        </p>
                      )}
                    </section>
                  );
                })}
              {unmentionedPreviewFields.length > 0 ? (
                <p className="py-3 text-[13px] leading-[1.5] text-app-ink-subtle">
                  本次未提及：{unmentionedPreviewFields.join('、')}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => setIsPreviewOpen(false)}
              disabled={isSavingGeneratedMemory}
            >
              取消
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={saveGeneratedMemory}
              disabled={isSavingGeneratedMemory}
            >
              {isSavingGeneratedMemory ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {saveGeneratedLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isMemoryDialogOpen} onOpenChange={setIsMemoryDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
            <DialogTitle>{viewingMemoryTitle}</DialogTitle>
            <DialogDescription>{viewingMemoryDescription}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(100vh-220px)] flex-1 overflow-y-auto px-6 pb-5">
            <div className="divide-y divide-app-border">
              {viewingMemorySections
                .filter((section) => getPreviewItems(section.content))
                .map((section) => {
                  const previewItems = getPreviewItems(section.content);
                  const usesList = section.title === '完成事项' || (previewItems?.length ?? 0) > 1;

                  if (!previewItems) {
                    return null;
                  }

                  return (
                    <section key={section.title} className="py-3 first:pt-0 last:pb-0">
                      <h3 className="text-sm leading-5 font-semibold text-app-ink">
                        {section.title}
                      </h3>
                      {usesList ? (
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[14px] leading-[1.58] text-app-ink-muted">
                          {previewItems.map((item, index) => (
                            <li key={`${section.title}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[14px] leading-[1.62] text-app-ink-muted">
                          {previewItems[0]}
                        </p>
                      )}
                    </section>
                  );
                })}
              {unmentionedViewingFields.length > 0 ? (
                <p className="py-3 text-[13px] leading-[1.5] text-app-ink-subtle">
                  本次未提及：{unmentionedViewingFields.join('、')}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => setIsMemoryDialogOpen(false)}
            >
              关闭
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={editOriginalRecord}
            >
              编辑原始记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
