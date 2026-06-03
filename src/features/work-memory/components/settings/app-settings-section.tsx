import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { AppSettings, AppTheme } from '../../services/app-settings-repository';
import { Field, SectionHeader, SwitchField } from './settings-shared';
import { themeOptions } from './settings-types';

type AppSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

export function AppSettingsSection({ settings, onUpdateSettings }: AppSettingsSectionProps) {
  return (
    <section className="space-y-5" aria-labelledby="app-settings-title">
      <SectionHeader id="app-settings-title" title="应用设置" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-app-ink">外观</h3>
        <Field label="主题">
          <Select
            value={settings.theme}
            onValueChange={(value) => onUpdateSettings({ theme: value as AppTheme })}
          >
            <SelectTrigger className="w-full bg-app-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

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
        <p className="text-sm text-app-ink-subtle">部分启动与托盘行为需要系统权限支持。</p>
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
