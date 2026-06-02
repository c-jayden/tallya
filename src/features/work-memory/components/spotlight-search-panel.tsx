import { Search, X } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  formatMemoryDate,
  getMemorySnippet,
  getMemorySummary,
  getRelativeMemoryDate,
} from '../memory-view-model';
import type { DailyMemory } from '../types';

type SpotlightSearchPanelProps = {
  open: boolean;
  keyword: string;
  results: DailyMemory[];
  activeIndex: number;
  currentDate: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isComposing: boolean;
  onClose: () => void;
  onKeywordChange: (keyword: string) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onActiveIndexChange: (index: number) => void;
  onOpenMemory: (memory: DailyMemory) => void;
};

export function SpotlightSearchPanel({
  open,
  keyword,
  results,
  activeIndex,
  currentDate,
  inputRef,
  isComposing,
  onClose,
  onKeywordChange,
  onCompositionStart,
  onCompositionEnd,
  onKeyDown,
  onClear,
  onActiveIndexChange,
  onOpenMemory,
}: SpotlightSearchPanelProps) {
  if (!open) {
    return null;
  }

  const hasKeyword = Boolean(keyword.trim());

  return (
    <div
      className="fixed inset-0 z-50 cursor-pointer bg-slate-950/10 backdrop-blur-[3px] dark:bg-black/35"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="搜索记忆"
        className="absolute top-24 left-1/2 flex max-h-[min(520px,calc(100vh-96px))] w-[min(620px,calc(100vw-64px))] -translate-x-1/2 cursor-default flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_20px_60px_rgb(15_23_42/0.18)] dark:shadow-[0_24px_70px_rgb(0_0_0/0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'flex h-13 shrink-0 items-center gap-3 px-4',
            hasKeyword && !isComposing && 'border-b border-app-border',
          )}
        >
          <Search className="size-4 shrink-0 text-app-ink-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-app-ink outline-none placeholder:text-[var(--app-placeholder)]"
            value={keyword}
            onChange={(event) => onKeywordChange(event.currentTarget.value)}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onKeyDown={onKeyDown}
            placeholder="输入关键词搜索工作记忆..."
          />
          {hasKeyword ? (
            <button
              type="button"
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:outline-none"
              onClick={onClear}
              aria-label="清空搜索"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <span className="shrink-0 rounded-md border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[11px] leading-4 text-app-ink-subtle">
            Esc
          </span>
        </div>
        {hasKeyword && !isComposing ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.length > 0 ? (
              <div className="grid gap-1">
                {results.map((memory, index) => {
                  const snippet = getMemorySnippet(memory, keyword);
                  const relativeDate = getRelativeMemoryDate(memory.date, currentDate);
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={memory.id}
                      type="button"
                      className={cn(
                        'block w-full cursor-pointer rounded-[10px] bg-transparent px-3.5 py-3 text-left transition-colors duration-150 hover:bg-[#F8FAFC] focus-visible:bg-[#F1F5F9] focus-visible:outline-none dark:hover:bg-app-surface-muted dark:focus-visible:bg-app-surface-muted',
                        isActive && 'bg-[#F1F5F9] dark:bg-app-surface-muted',
                      )}
                      onMouseEnter={() => onActiveIndexChange(index)}
                      onClick={() => onOpenMemory(memory)}
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
                <p className="mt-1 text-xs leading-[1.45] text-app-ink-subtle">换个关键词试试</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
