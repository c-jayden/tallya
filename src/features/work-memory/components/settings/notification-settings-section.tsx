import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from '../../services/app-settings-repository';
import { Field, SwitchField } from './settings-shared';
import { weekdays } from './settings-types';

type NotificationSettingsSectionProps = {
  settings: AppSettings;
  isSendingTestNotification: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSendTestNotification: () => void;
};

export function NotificationSettingsSection({
  settings,
  isSendingTestNotification,
  onUpdateSettings,
  onSendTestNotification,
}: NotificationSettingsSectionProps) {
  const isDailyReminderDisabled = !settings.dailyReminderEnabled;
  const isWeeklyReminderDisabled = !settings.weeklyReminderEnabled;

  return (
    <section className="space-y-5" aria-label="通知提醒">
      <div className="space-y-3">
        <SwitchField
          label="提醒我留下当天工作"
          checked={settings.dailyReminderEnabled}
          onCheckedChange={(checked) => onUpdateSettings({ dailyReminderEnabled: checked })}
        />
        <div className="space-y-3">
          <Field label="时间">
            <Input
              type="time"
              value={settings.dailyReminderTime}
              className="bg-app-surface"
              disabled={isDailyReminderDisabled}
              onChange={(event) => onUpdateSettings({ dailyReminderTime: event.target.value })}
            />
          </Field>
          <Field label="提醒内容">
            <Textarea
              value={settings.dailyReminderMessage}
              placeholder={DEFAULT_APP_SETTINGS.dailyReminderMessage}
              className="min-h-16 resize-none bg-app-surface"
              disabled={isDailyReminderDisabled}
              onChange={(event) => onUpdateSettings({ dailyReminderMessage: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <SwitchField
          label="提醒我回顾一周"
          checked={settings.weeklyReminderEnabled}
          onCheckedChange={(checked) => onUpdateSettings({ weeklyReminderEnabled: checked })}
        />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="哪一天">
              <Select
                value={settings.weeklyReminderWeekday}
                disabled={isWeeklyReminderDisabled}
                onValueChange={(value) => onUpdateSettings({ weeklyReminderWeekday: value })}
              >
                <SelectTrigger className="w-full bg-app-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekdays.map((weekday) => (
                    <SelectItem key={weekday.value} value={weekday.value}>
                      {weekday.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="时间">
              <Input
                type="time"
                value={settings.weeklyReminderTime}
                className="bg-app-surface"
                disabled={isWeeklyReminderDisabled}
                onChange={(event) => onUpdateSettings({ weeklyReminderTime: event.target.value })}
              />
            </Field>
          </div>
          <div>
            <Field label="提醒内容">
              <Textarea
                value={settings.weeklyReminderMessage}
                placeholder={DEFAULT_APP_SETTINGS.weeklyReminderMessage}
                className="min-h-16 resize-none bg-app-surface"
                disabled={isWeeklyReminderDisabled}
                onChange={(event) =>
                  onUpdateSettings({ weeklyReminderMessage: event.target.value })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSendingTestNotification}
          onClick={onSendTestNotification}
        >
          {isSendingTestNotification && (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          )}
          试发一条通知
        </Button>
        <p className="text-sm text-app-ink-subtle">
          保持 Tallya 在后台运行时，会按设定时间轻轻提醒。
        </p>
      </div>
    </section>
  );
}
