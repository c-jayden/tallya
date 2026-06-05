import { Loader2 } from 'lucide-react';
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
import type { GeneratedReportContent } from '../types';
import type { WeeklyReportDraft } from '../services/report-service';

type ReportPreviewDialogProps = {
  open: boolean;
  draft: WeeklyReportDraft | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyMarkdown: () => void;
  onSave: () => void;
};

export function ReportPreviewDialog({
  open,
  draft,
  isSaving,
  onOpenChange,
  onCopyMarkdown,
  onSave,
}: ReportPreviewDialogProps) {
  const content = draft?.generated ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(620px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(620px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            周报预览
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            确认后会保存为本周报告。
          </DialogDescription>
        </DialogHeader>
        <TallyaScrollArea className="min-h-0 max-h-[calc(100vh-190px)] flex-1 px-6 pb-5">
          <ReportPreviewDocument content={content} />
        </TallyaScrollArea>
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
            variant="ghost"
            className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
            onClick={onCopyMarkdown}
            disabled={!content}
          >
            复制 Markdown
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-app-accent text-app-accent-ink hover:bg-[color-mix(in_srgb,var(--app-accent)_86%,var(--app-surface-muted))] disabled:cursor-not-allowed"
            onClick={onSave}
            disabled={isSaving || !content}
          >
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            保存周报
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportPreviewDocument({ content }: { content: GeneratedReportContent | null }) {
  if (!content) {
    return null;
  }

  return (
    <article className="space-y-5 text-app-ink">
      <header className="space-y-2">
        <h2 className="text-lg leading-6 font-semibold tracking-normal">{content.title}</h2>
        {content.summary ? (
          <p className="text-[14px] leading-[1.65] text-app-ink-muted">{content.summary}</p>
        ) : null}
      </header>
      <ReportTextList title="本周重点" items={content.highlights} />
      <ReportTextList title="完成事项" items={content.completedItems} />
      <ReportTextBlock title="问题与风险" content={content.problems} />
      <ReportTextBlock title="下周计划" content={content.nextWeekPlan} />
    </article>
  );
}

function ReportTextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[14px] leading-5 font-semibold text-app-ink">{title}</h3>
      <ul className="space-y-1.5 text-[13.5px] leading-[1.65] text-app-ink-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.65em] size-1 shrink-0 rounded-full bg-app-ink-subtle" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReportTextBlock({ title, content }: { title: string; content?: string }) {
  if (!content) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[14px] leading-5 font-semibold text-app-ink">{title}</h3>
      <p className="text-[13.5px] leading-[1.65] text-app-ink-muted">{content}</p>
    </section>
  );
}
