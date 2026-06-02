import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StatusVariant, TodayMemoryState, WeeklySnapshot } from '../types';

type MemoryStatusCardProps = {
  isLocked: boolean;
  statusVariant: StatusVariant;
  todayMemory: TodayMemoryState;
  weeklySnapshot: WeeklySnapshot;
  onUnlockMemory: () => void;
};

export function MemoryStatusCard({
  isLocked,
  statusVariant,
  todayMemory,
  weeklySnapshot,
  onUnlockMemory,
}: MemoryStatusCardProps) {
  return (
    <section
      className={cn(
        'flex items-start justify-between gap-4 rounded-[14px] border border-app-border bg-app-surface px-3 py-[11px] max-[560px]:flex-col max-[560px]:gap-2.5',
        statusVariant === 'locked' && 'border-app-border-strong',
      )}
      aria-label="工作记忆状态"
    >
      <div className="min-w-0 [&_p]:mt-[3px] [&_p]:text-[13px] [&_p]:leading-normal [&_p]:text-app-ink-muted [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:leading-[1.45] [&_small]:text-app-ink-subtle [&_strong]:block [&_strong]:text-[13.5px] [&_strong]:leading-[1.35] [&_strong]:font-[590] [&_strong]:text-app-ink">
        {isLocked ? (
          <>
            <strong>本周周报已生成</strong>
            <p>本周工作记忆已归档，修改历史记录需先解锁。</p>
            <small>该记录已被周报引用，修改后相关报告可能需要重新生成。</small>
          </>
        ) : todayMemory.officialStatus === 'generated' ? (
          <>
            <strong>今日记忆已沉淀</strong>
            <p>你可以继续补充内容并重新整理。</p>
            {todayMemory.reportFreshness === 'stale' ? <small>相关报告需要重新生成。</small> : null}
          </>
        ) : todayMemory.hasDraft ? (
          <>
            <strong>草稿已保存</strong>
            <p>还没有生成正式工作记忆，整理后会沉淀为今天唯一一条正式记录。</p>
          </>
        ) : (
          <>
            <strong>本周已沉淀 {weeklySnapshot.settledDays} 天</strong>
            <p>
              上次记录：{weeklySnapshot.lastMemoryDate}，{weeklySnapshot.lastMemorySummary}
            </p>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 max-[560px]:self-start">
        {isLocked ? (
          <Button
            type="button"
            variant="ghost"
            className="h-7 cursor-pointer rounded-[9px] px-2 text-xs font-[520] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink"
            onClick={onUnlockMemory}
          >
            解锁修改
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-7 cursor-pointer rounded-[9px] px-2 text-xs font-[520] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink"
        >
          {isLocked
            ? '查看周报'
            : todayMemory.officialStatus === 'generated'
              ? '查看今日记忆'
              : '查看记忆'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-7 cursor-pointer rounded-[9px] px-2 text-xs font-[520] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink"
        >
          {isLocked ? '查看记忆' : '生成报告'}
        </Button>
      </div>
    </section>
  );
}
