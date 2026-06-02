import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMemoryDate } from '../memory-view-model';
import type { DailyMemory } from '../types';
import { MemoryDocument } from './memory-document';

type MemoryDetailDialogProps = {
  open: boolean;
  memory: DailyMemory | null;
  currentDate: string;
  onOpenChange: (open: boolean) => void;
  onEditOriginal: () => void;
};

export function MemoryDetailDialog({
  open,
  memory,
  currentDate,
  onOpenChange,
  onEditOriginal,
}: MemoryDetailDialogProps) {
  const isTodayMemory = memory?.date === currentDate;
  const title = isTodayMemory
    ? '今日记忆'
    : `${memory ? formatMemoryDate(memory.date) : ''}的工作记忆`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>这是当天保存的正式工作记忆。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 max-h-[calc(100vh-220px)] flex-1 overflow-y-auto px-6 pb-5">
          <MemoryDocument content={memory?.generated ?? null} />
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
          {isTodayMemory ? (
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={onEditOriginal}
            >
              编辑原始记录
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
