import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { AppSettings } from '../../services/app-settings-repository';
import { Field, SectionHeader, SwitchField } from './settings-shared';
import { weekdays } from './settings-types';

type NotificationSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

export function NotificationSettingsSection({
  settings,
  onUpdateSettings,
}: NotificationSettingsSectionProps) {
  return (
    <section className="space-y-5" aria-labelledby="notification-settings-title">
      <SectionHeader
        id="notification-settings-title"
        title="通知提醒"
        description="到点提醒你记录工作，后续可用于周报提醒。"
      />

      <div className="space-y-3">
        <SwitchField
          label="启用每日记录提醒"
          checked={settings.dailyReminderEnabled}
          onCheckedChange={(checked) => onUpdateSettings({ dailyReminderEnabled: checked })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="时间">
            <Input
              type="time"
              value={settings.dailyReminderTime}
              className="bg-app-surface"
              onChange={(event) => onUpdateSettings({ dailyReminderTime: event.target.value })}
            />
          </Field>
          <Field label="提醒文案">
            <Input
              value={settings.dailyReminderMessage}
              className="bg-app-surface"
              onChange={(event) => onUpdateSettings({ dailyReminderMessage: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <SwitchField
          label="启用周报提醒"
          checked={settings.weeklyReminderEnabled}
          onCheckedChange={(checked) => onUpdateSettings({ weeklyReminderEnabled: checked })}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="星期">
            <Select
              value={settings.weeklyReminderWeekday}
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
              onChange={(event) => onUpdateSettings({ weeklyReminderTime: event.target.value })}
            />
          </Field>
          <Field label="提醒文案">
            <Input
              value={settings.weeklyReminderMessage}
              className="bg-app-surface"
              onChange={(event) => onUpdateSettings({ weeklyReminderMessage: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <p className="text-sm text-app-ink-subtle">
        提醒配置会保存在本机，系统通知能力将在接入后生效。
      </p>
    </section>
  );
}
