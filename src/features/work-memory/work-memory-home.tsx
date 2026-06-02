import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Loader2, Search, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
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

function getGeneratedMemories(memories: DailyMemory[]) {
  return memories
    .filter((memory) => memory.status === 'generated' && memory.generated)
    .sort((first, second) => second.date.localeCompare(first.date));
}

function getMemoryDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatMemoryDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(getMemoryDate(date));
}

function getRelativeMemoryDate(date: string, currentDate: string) {
  const memoryDate = getMemoryDate(date);
  const current = getMemoryDate(currentDate);
  const dayDiff = Math.round((current.getTime() - memoryDate.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return '今天';
  }

  if (dayDiff === 1) {
    return '昨天';
  }

  if (dayDiff >= 2 && dayDiff < 7) {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(memoryDate);
  }

  return '';
}

function getMemorySnippet(memory: DailyMemory, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return '';
  }

  const summary = memory.generated?.summary ?? '';
  const normalizedSummary = normalizeComparableText(summary);
  const candidates = [
    memory.rawContent,
    ...(memory.generated?.completedItems ?? []),
    memory.generated?.keyOutcome,
    memory.generated?.problems,
    memory.generated?.tomorrowPlan,
    memory.generated?.extraNote,
    memory.supplements.projectTopic,
    memory.supplements.tomorrowPlan,
    memory.supplements.extraNote,
    memory.date,
  ].filter((value): value is string => Boolean(value));
  const match = candidates.find((value) => {
    if (!value.toLowerCase().includes(normalizedKeyword)) {
      return false;
    }

    const normalizedValue = normalizeComparableText(value);

    return !(
      normalizedValue === normalizedSummary ||
      (normalizedSummary.length > 0 &&
        normalizedValue.includes(normalizedSummary) &&
        normalizedValue.length - normalizedSummary.length <= 8) ||
      (normalizedValue.length > 0 &&
        normalizedSummary.includes(normalizedValue) &&
        normalizedSummary.length - normalizedValue.length <= 8)
    );
  });

  if (!match) {
    return '';
  }

  return match.length > 72 ? `${match.slice(0, 72)}...` : match;
}

function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
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
  const [isMemoryListOpen, setIsMemoryListOpen] = useState(false);
  const [memoryListItems, setMemoryListItems] = useState<DailyMemory[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchComposing, setIsSearchComposing] = useState(false);
  const [searchResults, setSearchResults] = useState<DailyMemory[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const viewingMemoryTitle = isViewingTodayMemory
    ? '今日记忆'
    : `${viewingMemory ? formatMemoryDate(viewingMemory.date) : ''}的工作记忆`;
  const viewingMemoryDescription = '这是当天保存的正式工作记忆。';

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

  const triggerSearch = openSearchPanel;

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
    let isMounted = true;
    const keyword = searchKeyword.trim();

    if (!isSearchOpen || !keyword || isSearchComposing) {
      return;
    }

    void dailyMemoryRepository.searchMemories(keyword).then((results) => {
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

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (isSearchOpen && event.key === 'Escape') {
        event.preventDefault();
        closeSearchPanel();
        return;
      }

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
  }, [closeSearchPanel, isSearchOpen, settleTodayMemory, triggerSearch]);

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
      setMemoryListItems(getGeneratedMemories(memories));
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

    openMemoryDetail(currentMemory);
  }

  async function viewMemoryList() {
    setMemoryListItems(await dailyMemoryRepository.getAllMemories());
    setIsMemoryListOpen(true);
  }

  function openMemoryDetail(memory: DailyMemory) {
    if (!memory.generated) {
      return;
    }

    setViewingMemory(memory);
    setIsMemoryListOpen(false);
    closeSearchPanel();
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

  function updateSearchKeyword(value: string) {
    setSearchKeyword(value);

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
        openMemoryDetail(activeMemory);
      }
    }
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
            onViewMemory={viewMemoryList}
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
      <Dialog open={isMemoryListOpen} onOpenChange={setIsMemoryListOpen}>
        <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
            <DialogTitle>工作记忆</DialogTitle>
            <DialogDescription>按时间倒序查看已保存的工作记忆。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(100vh-184px)] flex-1 overflow-y-auto px-6 pb-5">
            {memoryListItems.length > 0 ? (
              <div className="divide-y divide-app-border">
                {memoryListItems.map((memory) => {
                  const relativeDate = getRelativeMemoryDate(memory.date, currentDate);

                  return (
                    <button
                      key={memory.id}
                      type="button"
                      className="block w-full cursor-pointer py-3 text-left transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
                      onClick={() => openMemoryDetail(memory)}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block text-sm leading-5 font-semibold text-app-ink">
                            {formatMemoryDate(memory.date)}
                          </strong>
                          <p className="mt-1 line-clamp-2 text-[14px] leading-[1.58] text-app-ink-muted">
                            {getMemorySummary(memory)}
                          </p>
                          {memory.supplements.projectTopic ? (
                            <p className="mt-1 text-[13px] leading-[1.45] text-app-ink-subtle">
                              {memory.supplements.projectTopic}
                            </p>
                          ) : null}
                        </div>
                        {relativeDate ? (
                          <span className="shrink-0 text-xs text-app-ink-subtle">
                            {relativeDate}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center">
                <strong className="block text-sm font-semibold text-app-ink">还没有工作记忆</strong>
                <p className="mt-2 text-[13px] leading-[1.5] text-app-ink-muted">
                  整理第一条今日记录后，这里会显示你的历史沉淀。
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => setIsMemoryListOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isSearchOpen ? (
        <div
          className="fixed inset-0 z-50 cursor-pointer bg-slate-950/10 backdrop-blur-[3px] dark:bg-black/35"
          onMouseDown={closeSearchPanel}
        >
          <div
            role="dialog"
            aria-label="搜索记忆"
            className="absolute top-[96px] left-1/2 flex max-h-[min(520px,calc(100vh-96px))] w-[min(620px,calc(100vw-64px))] -translate-x-1/2 cursor-default flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_20px_60px_rgb(15_23_42/0.18)] dark:shadow-[0_24px_70px_rgb(0_0_0/0.45)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-app-border px-4">
              <Search className="size-4 shrink-0 text-app-ink-subtle" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                role="searchbox"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-app-ink outline-none placeholder:text-[var(--app-placeholder)]"
                value={searchKeyword}
                onChange={(event) => updateSearchKeyword(event.currentTarget.value)}
                onCompositionStart={handleSearchCompositionStart}
                onCompositionEnd={handleSearchCompositionEnd}
                onKeyDown={handleSearchKeyDown}
                placeholder="输入关键词搜索工作记忆..."
              />
              {searchKeyword.trim() ? (
                <button
                  type="button"
                  className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:outline-none"
                  onClick={clearSearchKeyword}
                  aria-label="清空搜索"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <span className="shrink-0 rounded-md border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[11px] leading-4 text-app-ink-subtle">
                Esc
              </span>
            </div>
            {!searchKeyword.trim() ? (
              <div className="px-4 py-5 text-center">
                <p className="text-[13px] leading-[1.5] text-app-ink-muted">
                  输入关键词搜索你的工作记忆
                </p>
                <p className="mt-1 text-xs leading-[1.45] text-app-ink-subtle">
                  支持搜索摘要、完成事项、补充说明和日期。
                </p>
              </div>
            ) : !isSearchComposing ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {searchResults.length > 0 ? (
                  <div className="grid gap-1">
                    {searchResults.map((memory, index) => {
                      const snippet = getMemorySnippet(memory, searchKeyword);
                      const relativeDate = getRelativeMemoryDate(memory.date, currentDate);
                      const isActive = index === activeSearchIndex;

                      return (
                        <button
                          key={memory.id}
                          type="button"
                          className={cn(
                            'block w-full cursor-pointer rounded-[10px] bg-transparent px-[14px] py-3 text-left transition-colors duration-150 hover:bg-[#F8FAFC] focus-visible:bg-[#F1F5F9] focus-visible:outline-none dark:hover:bg-app-surface-muted dark:focus-visible:bg-app-surface-muted',
                            isActive && 'bg-[#F1F5F9] dark:bg-app-surface-muted',
                          )}
                          onMouseEnter={() => setActiveSearchIndex(index)}
                          onClick={() => openMemoryDetail(memory)}
                        >
                          <p className="text-xs leading-4 text-app-ink-subtle">
                            {formatMemoryDate(memory.date)}
                            {relativeDate ? ` · ${relativeDate}` : ''}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[14.5px] leading-[1.55] text-app-ink">
                            {getMemorySummary(memory)}
                          </p>
                          {snippet ? (
                            <p className="mt-1 line-clamp-1 text-[13px] leading-[1.45] text-app-ink-muted">
                              匹配：{snippet}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-3.5 text-center">
                    <p className="text-[13px] leading-[1.5] font-medium text-app-ink-muted">
                      没有找到相关记忆
                    </p>
                    <p className="mt-1 text-xs leading-[1.45] text-app-ink-subtle">
                      换个关键词试试
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
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
            {isViewingTodayMemory ? (
              <Button
                type="button"
                className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
                onClick={editOriginalRecord}
              >
                编辑原始记录
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
