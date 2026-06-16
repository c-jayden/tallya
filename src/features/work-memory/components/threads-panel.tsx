import { ChevronLeft, ListTree } from 'lucide-react';
import type { RefObject } from 'react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMemoryDate, getRelativeMemoryDate } from '../memory-view-model';
import type { ThreadStoryline } from '../services/thread-service';
import type { Entry, ThreadSummary } from '../types';

type ThreadsPanelProps = {
  open: boolean;
  currentDate: string;
  threadSummaries: ThreadSummary[];
  stalledThreadIds: Set<string>;
  selectedThread: ThreadStoryline | null;
  inputRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
  onBackThreadList: () => void;
  onOpenEntry: (entry: Entry) => void;
};

function formatThreadSpan(thread: ThreadSummary) {
  const first = formatMemoryDate(thread.firstOccurredOn);
  const span =
    thread.firstOccurredOn === thread.lastOccurredOn
      ? first
      : `${first} ~ ${formatMemoryDate(thread.lastOccurredOn)}`;

  return `${span} · ${thread.entryCount} 条`;
}

type ThreadRowProps = {
  thread: ThreadSummary;
  isStalled: boolean;
  onOpen: () => void;
};

function ThreadRow({ thread, isStalled, onOpen }: ThreadRowProps) {
  return (
    <button
      type="button"
      className="block w-full cursor-pointer rounded-[10px] bg-transparent px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
      onClick={onOpen}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] leading-[1.5] text-app-ink">
          {thread.title}
        </span>
        {isStalled ? (
          <span className="shrink-0 rounded-md bg-app-surface-muted px-1.5 py-0.5 text-[11px] leading-4 text-app-ink-subtle">
            停顿中
          </span>
        ) : null}
      </span>
      <span className="mt-0.5 block text-xs leading-4 text-app-ink-subtle">
        {formatThreadSpan(thread)}
      </span>
    </button>
  );
}

type ThreadStorylineViewProps = {
  storyline: ThreadStoryline;
  currentDate: string;
  onBack: () => void;
  onOpenEntry: (entry: Entry) => void;
};

function ThreadStorylineView({
  storyline,
  currentDate,
  onBack,
  onOpenEntry,
}: ThreadStorylineViewProps) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-app-border px-3 py-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink focus-visible:outline-none"
              onClick={onBack}
              aria-label="返回线索列表"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>返回</TooltipContent>
        </Tooltip>
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-app-ink">
          {storyline.thread.title}
        </p>
      </div>
      <TallyaScrollArea className="min-h-0 flex-1 p-2">
        {storyline.entries.length > 0 ? (
          <div className="grid gap-1">
            {storyline.entries.map((entry) => {
              const relativeDate = getRelativeMemoryDate(entry.occurredOn, currentDate);
              const dateLabel = `${formatMemoryDate(entry.occurredOn)}${
                relativeDate ? ` · ${relativeDate}` : ''
              }`;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className="block w-full cursor-pointer rounded-[10px] bg-transparent px-3.5 py-3 text-left transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
                  onClick={() => onOpenEntry(entry)}
                >
                  <p className="text-xs leading-4 text-app-ink-subtle">{dateLabel}</p>
                  <p className="mt-1 line-clamp-3 text-[14.5px] leading-[1.55] whitespace-pre-wrap text-app-ink">
                    {entry.content}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-3.5 text-center text-[13px] leading-[1.5] text-app-ink-muted">
            这条线索还没有记录
          </p>
        )}
      </TallyaScrollArea>
    </>
  );
}

// A standalone browser for cross-day threads, separate from search: the list of
// threads, and a storyline drill-down. Mirrors the spotlight overlay shell.
export function ThreadsPanel({
  open,
  currentDate,
  threadSummaries,
  stalledThreadIds,
  selectedThread,
  onClose,
  onOpenThread,
  onBackThreadList,
  onOpenEntry,
}: ThreadsPanelProps) {
  const panelState = open ? 'open' : 'closed';

  return (
    <div
      data-state={panelState}
      aria-hidden={!open}
      className="tallya-search-overlay fixed inset-0 z-50 cursor-pointer bg-[color-mix(in_srgb,var(--app-bg)_46%,rgb(15_23_42/0.34))] backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <div
        className="absolute top-24 left-1/2 w-[min(620px,calc(100vw-64px))] -translate-x-1/2 cursor-default"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          role="dialog"
          aria-label="工作线索"
          data-state={panelState}
          className="tallya-motion-panel flex max-h-[min(520px,calc(100vh-96px))] w-full flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_20px_60px_rgb(15_23_42/0.18)] dark:shadow-[0_24px_70px_rgb(0_0_0/0.45)]"
        >
          {selectedThread ? (
            <ThreadStorylineView
              storyline={selectedThread}
              currentDate={currentDate}
              onBack={onBackThreadList}
              onOpenEntry={onOpenEntry}
            />
          ) : (
            <>
              <div className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-app-border px-4">
                <div className="flex items-center gap-2 text-app-ink">
                  <ListTree className="size-4 shrink-0 text-app-ink-subtle" aria-hidden="true" />
                  <span className="text-[14px] font-medium">线索</span>
                </div>
                <span className="shrink-0 rounded-md border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[11px] leading-4 text-app-ink-subtle">
                  Esc
                </span>
              </div>
              <TallyaScrollArea className="min-h-0 flex-1 p-2">
                {threadSummaries.length > 0 ? (
                  <div className="grid gap-1">
                    {threadSummaries.map((thread) => (
                      <ThreadRow
                        key={thread.id}
                        thread={thread}
                        isStalled={stalledThreadIds.has(thread.id)}
                        onOpen={() => onOpenThread(thread.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[13px] leading-[1.5] font-medium text-app-ink-muted">
                      还没有线索
                    </p>
                    <p className="mt-1 text-xs leading-[1.45] text-app-ink-subtle">
                      记录跨天做同一件事时，会自动建议归并成线索
                    </p>
                  </div>
                )}
              </TallyaScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
