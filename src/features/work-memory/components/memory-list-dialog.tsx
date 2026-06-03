import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
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
import { MemoryDocument } from './memory-document';

type MemoryListDialogProps = {
  open: boolean;
  items: DailyMemory[];
  currentDate: string;
  onOpenChange: (open: boolean) => void;
  onEditOriginal: (memory: DailyMemory) => void;
};

export function MemoryListDialog({
  open,
  items,
  currentDate,
  onOpenChange,
  onEditOriginal,
}: MemoryListDialogProps) {
  const [selectedMemory, setSelectedMemory] = useState<DailyMemory | null>(null);
  const isDetailMode = selectedMemory !== null;
  const isTodayMemory = selectedMemory?.date === currentDate;
  const detailTitle = isTodayMemory
    ? '今日记忆'
    : `${selectedMemory ? formatMemoryDate(selectedMemory.date) : ''}的工作记忆`;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && selectedMemory) {
      setSelectedMemory(null);
      return;
    }

    if (!nextOpen) {
      setSelectedMemory(null);
    }

    onOpenChange(nextOpen);
  }

  function handleEditOriginal(memory: DailyMemory) {
    setSelectedMemory(null);
    onEditOriginal(memory);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            {isDetailMode ? detailTitle : '工作记忆'}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            {isDetailMode
              ? '这是当天保存的正式工作记忆。'
              : '按时间倒序查看你已经沉淀的工作记录。'}
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-184px)] flex-1 px-6 pb-5">
          {isDetailMode ? (
            <MemoryDocument content={selectedMemory.generated} />
          ) : items.length > 0 ? (
            <div className="grid gap-2">
              {items.map((memory) => (
                <MemoryListItem
                  key={memory.id}
                  memory={memory}
                  currentDate={currentDate}
                  onOpen={() => setSelectedMemory(memory)}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <strong className="block text-sm font-semibold text-app-ink">还没有工作记忆</strong>
              <p className="mt-2 text-[13px] leading-[1.5] text-app-ink-muted">
                整理第一条今日记录后，这里会显示你的历史沉淀。
              </p>
            </div>
          )}
        </TallyaScrollArea>
        {isTodayMemory && selectedMemory ? (
          <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={() => handleOpenChange(false)}
            >
              关闭
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
              onClick={() => handleEditOriginal(selectedMemory)}
            >
              编辑原始记录
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type MemoryListItemProps = {
  memory: DailyMemory;
  currentDate: string;
  onOpen: () => void;
};

function MemoryListItem({ memory, currentDate, onOpen }: MemoryListItemProps) {
  const relativeDate = getRelativeMemoryDate(memory.date, currentDate);
  const completedCount = memory.generated?.completedItems.length ?? 0;

  return (
    <button
      type="button"
      className="block w-full cursor-pointer rounded-xl border border-transparent bg-transparent px-3.5 py-3 text-left transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
      onClick={onOpen}
    >
      <p className="text-[13px] leading-4 text-app-ink-subtle">
        {formatMemoryDate(memory.date)}
        {relativeDate ? ` · ${relativeDate}` : ''}
      </p>
      <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[1.55] text-app-ink">
        {getMemorySummary(memory)}
      </p>
      {memory.supplements.projectTopic || completedCount > 0 ? (
        <p className="mt-1.5 text-[13px] leading-[1.45] text-app-ink-muted">
          {memory.supplements.projectTopic ? `项目/主题：${memory.supplements.projectTopic}` : ''}
          {memory.supplements.projectTopic && completedCount > 0 ? ' · ' : ''}
          {completedCount > 0 ? `完成 ${completedCount} 项事项` : ''}
        </p>
      ) : null}
    </button>
  );
}
