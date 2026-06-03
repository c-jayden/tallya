import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { ProviderHealth } from './settings-types';

export function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="font-semibold text-app-ink">{label}</div>
      {children}
      {description && (
        <span className="text-[13px] leading-5 text-app-ink-subtle">{description}</span>
      )}
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-app-ink-muted">{label}</span>
      <Switch
        aria-label={label}
        checked={checked}
        className="cursor-pointer disabled:cursor-not-allowed"
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function StatusLine({ health }: { health: ProviderHealth }) {
  if (health.status === 'unknown' || health.status === 'checking') {
    return <p className="text-sm text-app-ink-subtle">状态：{health.message}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-app-ink-subtle">状态：</span>
      <Badge variant={health.status === 'available' ? 'secondary' : 'destructive'}>
        {health.message}
      </Badge>
      {health.detail && <span className="text-app-ink-subtle">{health.detail}</span>}
    </div>
  );
}
