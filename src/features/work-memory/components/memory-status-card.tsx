import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StatusVariant, TodayMemoryState, WeeklySnapshot } from '../types';

type MemoryStatusCardProps = {
  isLocked: boolean;
  statusVariant: StatusVariant;
  todayMemory: TodayMemoryState;
  weeklySnapshot: WeeklySnapshot;
  onGenerateReport: () => void;
  onViewDraft: () => void;
  onViewMemory: () => void;
  onViewTodayMemory: () => void;
  onViewWeeklyReport: () => void;
};

export function MemoryStatusCard({
  isLocked,
  statusVariant,
  todayMemory,
  weeklySnapshot,
  onGenerateReport,
  onViewDraft,
  onViewMemory,
  onViewTodayMemory,
  onViewWeeklyReport,
}: MemoryStatusCardProps) {
  const hasAnyGeneratedMemory =
    todayMemory.hasGeneratedHistory || todayMemory.officialStatus === 'generated';
  const isEmpty = !isLocked && !todayMemory.hasDraft && !hasAnyGeneratedMemory;
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
      <div className="min-w-0 [&_p]:mt-0.75 [&_p]:text-[13px] [&_p]:leading-normal [&_p]:text-app-ink-muted [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:leading-[1.45] [&_small]:text-app-ink-subtle [&_strong]:block [&_strong]:text-[13.5px] [&_strong]:leading-[1.35] [&_strong]:font-[590] [&_strong]:text-app-ink">
        {isLocked ? (
          <>
            <strong>本周周报已生成</strong>
            <p>相关工作记忆已归档，修改历史记录需先解锁。</p>
          </>
        ) : todayMemory.officialStatus === 'generated' ? (
          <>
            <strong>今日记忆已沉淀</strong>
            <p>你可以继续补充内容并重新整理。</p>
            {todayMemory.reportFreshness === 'stale' ? <small>相关报告需要重新生成。</small> : null}
          </>
        ) : todayMemory.hasDraft ? (
          <>
            <strong>今日草稿已保存</strong>
            <p>整理成今日记录后，会开始沉淀你的工作记忆。</p>
          </>
        ) : isEmpty ? (
          <>
            <strong>还没有工作记忆</strong>
            <p>整理第一条今日记录后，这里会显示你的沉淀进度。</p>
          </>
        ) : (
          <>
            <strong>本周已沉淀 {weeklySnapshot.settledDays} 天</strong>
            <p className="!text-app-ink-subtle">
              上次记录：{weeklySnapshot.lastMemoryDate}，{weeklySnapshot.lastMemorySummary}
            </p>
          </>
        )}
      </div>
      {!isEmpty ? (
        <div className="flex shrink-0 items-center gap-0.5 max-[560px]:self-start">
          {isLocked ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onViewWeeklyReport}
              >
                查看周报
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onViewMemory}
              >
                查看记忆
              </Button>
            </>
          ) : todayMemory.officialStatus === 'generated' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onViewTodayMemory}
              >
                查看今日记忆
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onGenerateReport}
              >
                生成报告
              </Button>
            </>
          ) : todayMemory.hasDraft ? (
            <Button
              type="button"
              variant="ghost"
              className={actionButtonClass}
              onClick={onViewDraft}
            >
              查看草稿
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onViewMemory}
              >
                查看记忆
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={actionButtonClass}
                onClick={onGenerateReport}
              >
                生成报告
              </Button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
