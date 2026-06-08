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
            {isCustomReport ? '报告预览' : '周报预览'}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            确认后会保存这份报告。
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
            取消
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onCopyText}
            disabled={isSaving || !content}
          >
            复制文本
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onCopyMarkdown}
            disabled={isSaving || !content}
          >
            复制 Markdown
          </Button>
          <Button
            type="button"
            className="h-9 min-w-24 cursor-pointer gap-2 rounded-xl bg-app-accent px-3.5 text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-ink-muted disabled:opacity-100 disabled:hover:bg-app-surface-muted"
            onClick={onSave}
            disabled={isSaving || !content}
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : null}
            {isSaving ? '保存中...' : isCustomReport ? '保存报告' : '保存周报'}
          </Button>
        </TallyaDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
