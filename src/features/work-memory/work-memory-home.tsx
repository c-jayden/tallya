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
  weeklySnapshot,
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

function getTodayMemoryState(memory: DailyMemory | null): TodayMemoryState {
  if (!memory) {
    return {
      officialStatus: 'notGenerated',
      hasDraft: false,
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
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  };
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
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  });
  const [searchPulse, setSearchPulse] = useState(false);
  const [primaryPulse, setPrimaryPulse] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false);
  const [isSavingGeneratedMemory, setIsSavingGeneratedMemory] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<DailyMemoryGeneratedContent | null>(
    null,
  );
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

  const buildDailyMemoryInput = useCallback(() => {
    const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

    return {
      date: currentDate,
      rawContent: workNote,
      projectTopic: activeSupplementFields.includes(projectTopicField)
        ? supplementValues[projectTopicField]
        : '',
      tomorrowPlan: activeSupplementFields.includes(tomorrowPlanField)
        ? supplementValues[tomorrowPlanField]
        : '',
      extraNote: activeSupplementFields.includes(extraNoteField)
        ? supplementValues[extraNoteField]
        : '',
    };
  }, [activeSupplementFields, currentDate, supplementValues, workNote]);

  const applyDailyMemory = useCallback((memory: DailyMemory | null) => {
    setTodayMemory(getTodayMemoryState(memory));

    if (!memory) {
      return;
    }

    const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

    setWorkNote(memory.rawContent);
    setSupplementValues((current) => ({
      ...current,
      [projectTopicField]: memory.projectTopic,
      [tomorrowPlanField]: memory.tomorrowPlan,
      [extraNoteField]: memory.extraNote,
    }));
    setActiveSupplementFields(
      [
        memory.projectTopic ? projectTopicField : null,
        memory.tomorrowPlan ? tomorrowPlanField : null,
        memory.extraNote ? extraNoteField : null,
      ].filter((field): field is SupplementField => field !== null),
    );
    setIsSupplementOpen(Boolean(memory.projectTopic || memory.tomorrowPlan || memory.extraNote));
  }, []);

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

    void dailyMemoryRepository.getByDate(currentDate).then((memory) => {
      if (isMounted) {
        applyDailyMemory(memory);
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

      setTodayMemory(getTodayMemoryState(memory));
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
        generatedContent: generatedPreview,
      });

      setTodayMemory((current) => ({
        ...getTodayMemoryState(memory),
        reportFreshness: current.referencedByWeeklyReport ? 'stale' : current.reportFreshness,
      }));
      setIsPreviewOpen(false);
      toast.success(hasGeneratedToday ? '今日记录已更新' : '今日记忆已保存');
    } finally {
      setIsSavingGeneratedMemory(false);
    }
  }

  function unlockMemory() {
    setTodayMemory((current) => ({
      ...current,
      officialStatus: 'generated',
      reportFreshness: 'stale',
    }));
  }

  return (
    <main className="max-h-screen w-screen bg-app-bg">
      <section
        className="mx-auto flex max-h-screen w-[min(calc(100%-96px),740px)] flex-col overflow-y-auto py-6 scrollbar-none [&::-webkit-scrollbar]:hidden max-[560px]:w-[min(calc(100%-36px),740px)] max-[560px]:pt-6 max-[560px]:pb-5 max-[600px]:pt-5"
        aria-label="工作记忆首页"
      >
        <div ref={contentRef} className="flex flex-col">
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
            onUnlockMemory={unlockMemory}
          />
        </div>
      </section>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[min(calc(100%-2rem),560px)] gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>今日记忆预览</DialogTitle>
            <DialogDescription>确认后会保存为今天唯一一条工作记忆。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[58vh] overflow-y-auto px-5 pb-4">
            <div className="grid gap-3">
              {generatedPreview?.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-lg border border-app-border bg-app-surface px-3 py-2.5"
                >
                  <h3 className="text-[13px] font-semibold text-app-ink">{section.title}</h3>
                  <ul className="mt-1.5 grid gap-1 text-[13px] leading-[1.55] text-app-ink-muted">
                    {section.content.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsPreviewOpen(false)}
              disabled={isSavingGeneratedMemory}
            >
              取消
            </Button>
            <Button type="button" onClick={saveGeneratedMemory} disabled={isSavingGeneratedMemory}>
              {isSavingGeneratedMemory ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {saveGeneratedLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
