import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { StatusVariant, TodayMemoryState } from './types';
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

export function WorkMemoryHome() {
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
  const contentRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pulseTimeoutsRef = useRef<number[]>([]);
  const commandKey = getCommandKey();
  const hasGeneratedToday = todayMemory.officialStatus !== 'notGenerated';
  const isLocked = todayMemory.officialStatus === 'locked';
  const primaryActionLabel = hasGeneratedToday ? '更新今日记录' : '整理成今日记录';
  const statusVariant = getStatusVariant(todayMemory, isLocked);

  const pulseAction = useCallback(
    (setter: (value: boolean) => void, button: HTMLButtonElement | null) => {
      setter(true);
      button?.focus({ preventScroll: true });
      const timeoutId = window.setTimeout(() => setter(false), 700);
      pulseTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

  const settleTodayMemory = useCallback(() => {
    if (isLocked) {
      return;
    }

    pulseAction(setPrimaryPulse, primaryActionRef.current);
    setTodayMemory((current) => ({
      ...current,
      officialStatus: 'generated',
      hasDraft: false,
      reportFreshness: current.referencedByWeeklyReport ? 'stale' : current.reportFreshness,
    }));
  }, [isLocked, pulseAction]);

  const triggerSearch = useCallback(() => {
    pulseAction(setSearchPulse, searchButtonRef.current);
  }, [pulseAction]);

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

  function saveDraft() {
    if (isLocked) {
      return;
    }

    setTodayMemory((current) => ({ ...current, hasDraft: true }));
  }

  function unlockMemory() {
    setTodayMemory((current) => ({
      ...current,
      officialStatus: 'generated',
      reportFreshness: 'stale',
    }));
  }

  return (
    <main className="h-screen w-screen bg-app-bg">
      <section
        className="mx-auto flex h-screen w-[min(calc(100%_-_96px),740px)] flex-col overflow-y-auto pt-6 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[560px]:w-[min(calc(100%_-_36px),740px)] max-[560px]:pt-6 max-[560px]:pb-5 max-[600px]:pt-5"
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
            isPrimaryPulsing={primaryPulse}
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
    </main>
  );
}
