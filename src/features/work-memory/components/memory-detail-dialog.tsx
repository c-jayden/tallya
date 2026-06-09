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
  isReferencedByReport: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyDailyReport: () => void;
  onEditOriginal: () => void;
};

export function MemoryDetailDialog({
  open,
  memory,
  currentDate,
  isReferencedByReport,
  onOpenChange,
  onCopyDailyReport,
  onEditOriginal,
}: MemoryDetailDialogProps) {
  const isTodayMemory = memory?.date === currentDate;
  const canEditOriginal = Boolean(memory && memory.status !== 'locked');
  const referenceHint = getReferenceHint({
    canEditOriginal,
    isReferencedByReport,
    isLocked: memory?.status === 'locked',
  });
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
          {referenceHint ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-[1.5] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {referenceHint}
            </p>
          ) : null}
          <MemoryDocument content={memory?.generated ?? null} />
        </TallyaScrollArea>
        {memory ? (
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
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={onCopyDailyReport}
            >
              复制日报
            </Button>
            {canEditOriginal ? (
              <Button
                type="button"
                className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
                onClick={onEditOriginal}
              >
                编辑原始记录
              </Button>
            ) : null}
          </TallyaDialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getReferenceHint({
  canEditOriginal,
  isReferencedByReport,
  isLocked,
}: {
  canEditOriginal: boolean;
  isReferencedByReport: boolean;
  isLocked: boolean;
}) {
  if (isReferencedByReport) {
    return canEditOriginal
      ? '这条记忆已被报告引用，修改后相关报告可能需要重新生成。'
      : '这条记忆已被报告引用，暂不支持直接编辑。';
  }

  return isLocked ? '这条记忆已锁定，暂不支持直接编辑。' : '';
}
