import { cn } from '@/lib/utils';
import type { AppSettings } from '../../services/app-settings-repository';
import { SwitchField } from './settings-shared';
import { themeOptions } from './settings-types';

type AppSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

export function AppSettingsSection({ settings, onUpdateSettings }: AppSettingsSectionProps) {
  return (
    <section className="space-y-5" aria-label="应用设置">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-app-ink">外观</h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-app-ink-muted">主题</span>
            <div className="inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
              {themeOptions.map((option) => {
                const isActive = settings.theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'h-8 cursor-pointer rounded-lg bg-transparent px-3.5 text-sm text-app-ink-muted transition-colors hover:text-app-ink focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed',
                      isActive &&
                        'bg-white font-semibold text-app-ink shadow-[0_1px_1px_rgb(15_23_42/0.04)] dark:bg-app-surface dark:text-app-ink',
                    )}
                    onClick={() => {
                      onUpdateSettings({ theme: option.value });
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-app-ink-subtle">
            选择 Tallya 的显示风格。
          </p>
        </div>
      </div>

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
    </section>
  );
}
