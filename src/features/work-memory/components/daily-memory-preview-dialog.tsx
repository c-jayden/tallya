import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DailyMemoryGeneratedContent } from '../types';
import { MemoryDocument } from './memory-document';
import { TallyaDialogFooter } from './tallya-dialog-footer';

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
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            今日记忆预览
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            确认后会保存为今天唯一一条工作记忆。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
          <MemoryDocument content={content} />
        </TallyaScrollArea>
        <TallyaDialogFooter>
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
        </TallyaDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
