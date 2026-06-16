import type { Ref } from 'react';
import { ChevronDown, FileText, ListTree, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePickerPopover } from './date-picker-popover';

type HomeToolbarProps = {
  commandKey: string;
  date: string;
  dateTime: string;
  maxDate: string;
  searchButtonRef: Ref<HTMLButtonElement>;
  threadsButtonRef: Ref<HTMLButtonElement>;
  reportsButtonRef: Ref<HTMLButtonElement>;
  selectedDate: string;
  weekday: string;
  hasThreadsNudge: boolean;
  mergeCount: number;
  hasUpdate: boolean;
  onDateChange: (date: string) => void;
  onSearchClick: () => void;
  onThreadsClick: () => void;
  onReportsClick: () => void;
  onSettingsClick: () => void;
};

export function HomeToolbar({
  commandKey,
  date,
  dateTime,
  maxDate,
  searchButtonRef,
  threadsButtonRef,
  reportsButtonRef,
  selectedDate,
  weekday,
  hasThreadsNudge,
  mergeCount,
  hasUpdate,
  onDateChange,
  onSearchClick,
  onThreadsClick,
  onReportsClick,
  onSettingsClick,
}: HomeToolbarProps) {
  const threadsButtonLabel =
    mergeCount > 0
      ? `线索，有 ${mergeCount} 条待归并`
      : hasThreadsNudge
        ? '线索，有停顿线索待回顾'
        : '线索';

  return (
    <header className="mb-3 flex h-9 items-center justify-between overflow-visible">
      <DatePickerPopover
        ariaLabel="选择记录日期"
        value={selectedDate}
        maxDate={maxDate}
        triggerClassName="group inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] leading-[1.2] text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface-muted hover:text-app-ink-muted focus-visible:bg-app-surface-muted focus-visible:text-app-ink-muted focus-visible:outline-none"
        onChange={onDateChange}
      >
        <time className="inline-flex min-w-0 items-center gap-2.5" dateTime={dateTime}>
          <span>{date}</span>
          <span>{weekday}</span>
        </time>
        <ChevronDown
          className="size-3 text-app-ink-subtle transition-colors duration-150 group-hover:text-app-ink-muted"
          aria-hidden="true"
        />
      </DatePickerPopover>
      <div className="flex min-w-0 items-center gap-3">
        <Button
          ref={searchButtonRef}
          variant="ghost"
          type="button"
          className="h-8.75 cursor-pointer gap-2 rounded-xl border border-app-border bg-app-surface px-3 text-[13px] text-app-ink-muted shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-ink focus-visible:border-app-border-strong focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:ring-0 [&_svg]:size-3.5"
          aria-label={`搜索记忆，快捷键 ${commandKey} K`}
          onClick={onSearchClick}
        >
          <Search aria-hidden="true" />
          <span>搜索记忆</span>
          <KbdGroup
            className="ml-0.5 [&_kbd]:h-4.5 [&_kbd]:min-w-4.5 [&_kbd]:border [&_kbd]:border-app-border [&_kbd]:bg-[color-mix(in_srgb,var(--app-surface)_82%,var(--app-surface-muted))] [&_kbd]:text-[11px] [&_kbd]:text-app-ink-muted"
            aria-hidden="true"
          >
            <Kbd>{commandKey}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={threadsButtonRef}
              variant="ghost"
              size="icon-sm"
              type="button"
              className="relative size-8.75 cursor-pointer rounded-xl text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink [&_svg]:size-3.5"
              aria-label={threadsButtonLabel}
              onClick={onThreadsClick}
            >
              <ListTree aria-hidden="true" />
              {mergeCount > 0 ? (
                <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-app-accent px-1 text-[10px] leading-none font-semibold text-app-accent-ink ring-2 ring-app-bg">
                  {mergeCount > 99 ? '99+' : mergeCount}
                </span>
              ) : hasThreadsNudge ? (
                <span
                  className="absolute top-1 right-1 size-2 rounded-full bg-app-accent ring-2 ring-app-bg"
                  aria-hidden="true"
                />
              ) : null}
              <span className="sr-only">线索</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{threadsButtonLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={reportsButtonRef}
              variant="ghost"
              size="icon-sm"
              type="button"
              className="size-8.75 cursor-pointer rounded-xl text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink [&_svg]:size-3.5"
              aria-label="整理"
              onClick={onReportsClick}
            >
              <FileText aria-hidden="true" />
              <span className="sr-only">整理</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>整理</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              className="relative size-8.75 cursor-pointer rounded-xl text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink [&_svg]:size-3.5"
              aria-label={hasUpdate ? '设置，有可用更新' : '设置'}
              onClick={onSettingsClick}
            >
              <Settings aria-hidden="true" />
              {hasUpdate ? (
                <span
                  className="absolute top-1 right-1 size-2 rounded-full bg-app-accent ring-2 ring-app-bg"
                  aria-hidden="true"
                />
              ) : null}
              <span className="sr-only">设置</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{hasUpdate ? '设置 · 有可用更新' : '设置'}</TooltipContent>
        </Tooltip>
        </div>
      </div>
    </header>
  );
}
