import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMemoryDate, getMemorySummary, getRelativeMemoryDate } from '../memory-view-model';
import type { DailyMemory } from '../types';

type MemoryListDialogProps = {
  open: boolean;
  items: DailyMemory[];
  currentDate: string;
  onOpenChange: (open: boolean) => void;
  onOpenMemory: (memory: DailyMemory) => void;
};

export function MemoryListDialog({
  open,
  items,
  currentDate,
  onOpenChange,
  onOpenMemory,
}: MemoryListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
          <DialogTitle>工作记忆</DialogTitle>
          <DialogDescription>按时间倒序查看已保存的工作记忆。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 max-h-[calc(100vh-184px)] flex-1 overflow-y-auto px-6 pb-5">
          {items.length > 0 ? (
            <div className="divide-y divide-app-border">
              {items.map((memory) => {
                const relativeDate = getRelativeMemoryDate(memory.date, currentDate);

                return (
                  <button
                    key={memory.id}
                    type="button"
                    className="block w-full cursor-pointer py-3 text-left transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
                    onClick={() => onOpenMemory(memory)}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block text-sm leading-5 font-semibold text-app-ink">
                          {formatMemoryDate(memory.date)}
                        </strong>
                        <p className="mt-1 line-clamp-2 text-sm leading-[1.58] text-app-ink-muted">
                          {getMemorySummary(memory)}
                        </p>
                        {memory.supplements.projectTopic ? (
                          <p className="mt-1 text-[13px] leading-[1.45] text-app-ink-subtle">
                            {memory.supplements.projectTopic}
                          </p>
                        ) : null}
                      </div>
                      {relativeDate ? (
                        <span className="shrink-0 text-xs text-app-ink-subtle">{relativeDate}</span>
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
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
