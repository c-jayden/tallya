import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiTaskAlert } from '../hooks/use-ai-task-coordinator';

type WorkMemoryAlertsProps = {
  alert: AiTaskAlert | null;
  onAction?: (target: AiTaskAlert['target']) => void;
  onDismiss: () => void;
};

const toneClassName: Record<AiTaskAlert['tone'], string> = {
  info: 'border-app-border bg-app-surface text-app-ink-muted',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-red-200 bg-red-50 text-red-950',
};

const toneIcon: Record<AiTaskAlert['tone'], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

export function WorkMemoryAlerts({ alert, onAction, onDismiss }: WorkMemoryAlertsProps) {
  if (!alert) {
    return null;
  }

  const Icon = toneIcon[alert.tone];

  return (
    <div
      role="status"
      className={cn(
        'mb-3 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-5',
        toneClassName[alert.tone],
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{alert.message}</p>
      {alert.actionLabel ? (
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 font-medium text-current transition-colors hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
          onClick={() => onAction?.(alert.target)}
        >
          {alert.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        aria-label="关闭提示"
        onClick={onDismiss}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
