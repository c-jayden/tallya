import { useState, type ReactNode } from 'react';
import { zhCN } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDailyMemoryDate } from '../services/daily-memory-repository';

type DatePickerPopoverProps = {
  ariaLabel: string;
  children: ReactNode;
  value: string;
  triggerClassName: string;
  maxDate?: string;
  // Defaults pop the calendar downward; callers in short windows can pop it
  // sideways instead so its height never gets clipped by the window edge.
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  onChange: (date: string) => void;
};

export function DatePickerPopover({
  ariaLabel,
  children,
  value,
  triggerClassName,
  maxDate,
  side = 'bottom',
  align = 'start',
  onChange,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = getDateFromDailyMemoryDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName} aria-label={ariaLabel}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        avoidCollisions
        collisionPadding={16}
        sticky="always"
        className="z-[80] w-auto gap-0 rounded-xl border border-app-border bg-app-surface p-0 shadow-[0_18px_48px_rgb(15_23_42/0.12)]"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          weekStartsOn={1}
          locale={zhCN}
          disabled={(date) => Boolean(maxDate && getDailyMemoryDate(date) > maxDate)}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            onChange(getDailyMemoryDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function getDateFromDailyMemoryDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}
