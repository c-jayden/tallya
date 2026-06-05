import type { ComponentProps } from 'react';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function TallyaDialogFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        'mx-0 mt-0 mb-0 shrink-0 rounded-b-xl border-t border-app-border bg-app-surface px-6 py-3 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}
