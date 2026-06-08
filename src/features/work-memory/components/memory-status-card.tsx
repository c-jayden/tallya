import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MemoryStatusSummary, StatusVariant } from '../types';

type MemoryStatusCardProps = {
  statusVariant: StatusVariant;
  summary: MemoryStatusSummary;
  onGenerateReport: () => void;
  onViewReports: () => void;
  onViewDraft: () => void;
  onViewMemory: () => void;
};

export function MemoryStatusCard({
  statusVariant,
  summary,
  onGenerateReport,
  onViewReports,
  onViewDraft,
  onViewMemory,
}: MemoryStatusCardProps) {
  const hasActions =
    summary.actions.canViewDraft ||
    summary.actions.canViewMemory ||
    summary.actions.canViewReports ||
    summary.actions.canGenerateReport;
  const actionButtonClass =
    'h-7 cursor-pointer rounded-[9px] px-2 text-xs font-[520] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink';

  return (
    <section
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border border-app-border bg-app-surface px-3 py-2.75 max-[560px]:flex-col max-[560px]:gap-2.5',
        statusVariant === 'locked' && 'border-app-border-strong',
      )}
      aria-label="工作记忆状态"
    >
      <div className="min-w-0 [&_p]:mt-0.75 [&_p]:text-[13px] [&_p]:leading-normal [&_p]:text-app-ink-muted [&_strong]:block [&_strong]:text-[13.5px] [&_strong]:leading-[1.35] [&_strong]:font-[590] [&_strong]:text-app-ink">
        <strong>{summary.title}</strong>
        <p className={summary.description.startsWith('最近记录：') ? '!text-app-ink-subtle' : undefined}>
          {summary.description}
        </p>
      </div>
      {hasActions ? (
        <div className="flex shrink-0 items-center gap-0.5 max-[560px]:self-start">
          {summary.actions.canViewDraft ? (
            <Button
              type="button"
              variant="ghost"
              className={actionButtonClass}
              onClick={onViewDraft}
            >
              查看草稿
            </Button>
          ) : null}
          {summary.actions.canViewMemory ? (
            <Button
              type="button"
              variant="ghost"
              className={actionButtonClass}
              onClick={onViewMemory}
            >
              查看记忆
            </Button>
          ) : null}
          {summary.actions.canViewReports ? (
            <Button
              type="button"
              variant="ghost"
              className={actionButtonClass}
              onClick={onViewReports}
            >
              查看报告
            </Button>
          ) : null}
          {summary.actions.canGenerateReport ? (
            <Button
              type="button"
              variant="ghost"
              className={actionButtonClass}
              onClick={onGenerateReport}
            >
              生成报告
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
