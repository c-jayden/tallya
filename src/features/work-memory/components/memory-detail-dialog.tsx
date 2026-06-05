import { Button } from '@/components/ui/button';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMemoryDate } from '../memory-view-model';
import type { DailyMemory } from '../types';
import { MemoryDocument } from './memory-document';
import { TallyaDialogFooter } from './tallya-dialog-footer';

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
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            这是当天保存的正式工作记忆。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
          <MemoryDocument content={memory?.generated ?? null} />
        </TallyaScrollArea>
        {isTodayMemory ? (
          <TallyaDialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={onEditOriginal}
            >
              编辑原始记录
            </Button>
          </TallyaDialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
