import type { Ref } from 'react';
import { Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

type HomeToolbarProps = {
  commandKey: string;
  date: string;
  dateTime: string;
  isSearchPulsing: boolean;
  searchButtonRef: Ref<HTMLButtonElement>;
  weekday: string;
  onSearchClick: () => void;
};

export function HomeToolbar({
  commandKey,
  date,
  dateTime,
  isSearchPulsing,
  searchButtonRef,
  weekday,
  onSearchClick,
}: HomeToolbarProps) {
  return (
    <header className="mb-3 flex h-9 items-center justify-between overflow-visible">
      <time
        className="inline-flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.2] text-app-ink-subtle"
        dateTime={dateTime}
      >
        <span>{date}</span>
        <span>{weekday}</span>
      </time>
      <div className="flex min-w-0 items-center gap-3">
        <Button
          ref={searchButtonRef}
          variant="ghost"
          type="button"
          className={cn(
            'h-[35px] cursor-pointer gap-2 rounded-xl border border-app-border bg-app-surface px-3 text-[13px] text-app-ink-muted shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-ink focus-visible:border-app-border-strong focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:ring-0 [&_svg]:size-3.5',
            isSearchPulsing &&
              'border-app-border-strong bg-app-surface-muted text-app-ink ring-4 ring-[color-mix(in_srgb,var(--app-ink)_8%,transparent)]',
          )}
          aria-label={`搜索记忆，快捷键 ${commandKey} K`}
          onClick={onSearchClick}
        >
          <Search aria-hidden="true" />
          <span>搜索记忆</span>
          <KbdGroup
            className="ml-0.5 [&_kbd]:h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:border [&_kbd]:border-app-border [&_kbd]:bg-[color-mix(in_srgb,var(--app-surface)_82%,var(--app-surface-muted))] [&_kbd]:text-[11px] [&_kbd]:text-app-ink-muted"
            aria-hidden="true"
          >
            <Kbd>{commandKey}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          className="size-[35px] cursor-pointer rounded-xl text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink [&_svg]:size-3.5"
        >
          <Settings aria-hidden="true" />
          <span className="sr-only">设置</span>
        </Button>
      </div>
    </header>
  );
}
