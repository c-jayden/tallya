import { Copy, FileText, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ReportDraft } from '../services/report-service';
import { ReportDocument } from './report-document';
import {
  preventReportDialogDismissWhenBusy,
  shouldAllowReportDialogOpenChange,
} from './report-dialog-state';
import { TallyaDialogFooter } from './tallya-dialog-footer';

type ReportPreviewDialogProps = {
  open: boolean;
  draft: ReportDraft | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyText: () => void;
  onCopyMarkdown: () => void;
  onSave: () => void;
};

export function ReportPreviewDialog({
  open,
  draft,
  isSaving,
  onOpenChange,
  onCopyText,
  onCopyMarkdown,
  onSave,
}: ReportPreviewDialogProps) {
  const content = draft?.generated ?? null;
  const isCustomReport = draft?.reportType === 'custom';

  function handleOpenChange(nextOpen: boolean) {
    if (shouldAllowReportDialogOpenChange(nextOpen, isSaving)) {
      onOpenChange(nextOpen);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        closeButtonDisabled={isSaving}
        onEscapeKeyDown={(event) => preventReportDialogDismissWhenBusy(isSaving, event)}
        onPointerDownOutside={(event) => preventReportDialogDismissWhenBusy(isSaving, event)}
        className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            {isCustomReport ? '总结预览' : '本周回顾预览'}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            确认后会保存这份整理。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
          <ReportDocument content={content} showTitle={false} />
        </TallyaScrollArea>
        <TallyaDialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            <X className="size-4" aria-hidden="true" />
            取消
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onCopyText}
            disabled={isSaving || !content}
          >
            <Copy className="size-4" aria-hidden="true" />
            复制文本
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onCopyMarkdown}
            disabled={isSaving || !content}
          >
            <FileText className="size-4" aria-hidden="true" />
            复制 Markdown
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={onSave}
            disabled={isSaving || !content}
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? '保存中...' : isCustomReport ? '保存总结' : '保存本周回顾'}
          </Button>
        </TallyaDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
