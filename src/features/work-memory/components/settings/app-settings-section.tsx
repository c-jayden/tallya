import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { AppSettings, AppTheme } from '../../services/app-settings-repository';
import { Field, SwitchField } from './settings-shared';
import { themeOptions } from './settings-types';

type AppSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

export function AppSettingsSection({ settings, onUpdateSettings }: AppSettingsSectionProps) {
  return (
    <section className="space-y-5" aria-label="应用设置">
      <Field label="主题">
        <div className="inline-flex w-fit rounded-lg border border-app-border bg-app-surface p-1">
          {themeOptions.map((option) => {
            const isActive = settings.theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'h-8 cursor-pointer rounded-md px-3 text-sm text-app-ink-muted transition-colors hover:bg-slate-50 hover:text-app-ink focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed dark:hover:bg-app-surface-muted',
                  isActive &&
                    'bg-slate-100 font-semibold text-app-ink hover:bg-slate-100 dark:bg-app-surface-muted dark:hover:bg-app-surface-muted',
                )}
                onClick={() => onUpdateSettings({ theme: option.value as AppTheme })}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-app-ink">启动与托盘</h3>
        <SwitchField
          label="开机自启动"
          checked={settings.launchAtStartup}
          onCheckedChange={(checked) => onUpdateSettings({ launchAtStartup: checked })}
        />
        <SwitchField
          label="关闭窗口时最小化到托盘"
          checked={settings.closeToTray}
          onCheckedChange={(checked) => onUpdateSettings({ closeToTray: checked })}
        />
        <SwitchField
          label="启动后最小化到托盘"
          checked={settings.startMinimized}
          onCheckedChange={(checked) => onUpdateSettings({ startMinimized: checked })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-app-ink">快捷键</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-app-ink-muted">搜索记忆</span>
          <span className="font-medium text-app-ink">Ctrl/Cmd + K</span>
        </div>
      </div>
    </section>
  );
}
