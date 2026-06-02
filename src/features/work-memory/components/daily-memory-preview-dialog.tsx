import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DailyMemoryGeneratedContent } from '../types';
import { MemoryDocument } from './memory-document';

type DailyMemoryPreviewDialogProps = {
  open: boolean;
  content: DailyMemoryGeneratedContent | null;
  isSaving: boolean;
  saveLabel: string;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
};

export function DailyMemoryPreviewDialog({
  open,
  content,
  isSaving,
  saveLabel,
  onOpenChange,
  onSave,
}: DailyMemoryPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-72px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(620px,calc(100vw-48px))]">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4">
          <DialogTitle>今日记忆预览</DialogTitle>
          <DialogDescription>确认后会保存为今天唯一一条工作记忆。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 max-h-[calc(100vh-220px)] flex-1 overflow-y-auto px-6 pb-5">
          <MemoryDocument content={content} />
        </div>
        <DialogFooter className="mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-[color-mix(in_srgb,var(--app-surface)_86%,var(--app-surface-muted))] px-6 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
