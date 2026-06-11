import { Input } from '@/components/ui/input';
import type { AppSettings, LocalGatewaySettings } from '../../services/app-settings-repository';
import { SwitchField } from './settings-shared';

const localGatewayInputClassName = 'bg-app-surface placeholder:text-slate-400';

type LocalGatewaySettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

export function LocalGatewaySettingsSection({
  settings,
  onUpdateSettings,
}: LocalGatewaySettingsSectionProps) {
  function updateLocalGateway(patch: Partial<LocalGatewaySettings>) {
    onUpdateSettings({
      localGateway: {
        ...settings.localGateway,
        ...patch,
      },
    });
  }

  const { enabled } = settings.localGateway;

  return (
    <section className="space-y-3" aria-label="本地 AI 网关">
      <SwitchField
        label="优先使用本地网关"
        checked={enabled}
        onCheckedChange={(value) => updateLocalGateway({ enabled: value })}
      />
      <p className="text-[13px] leading-5 text-app-ink-subtle">
        检测到本机网关（cc-switch / codex-proxy）时优先走它，更快；不可用时自动回退到上面的服务。
      </p>

      {enabled ? (
        <div className="grid gap-3 pt-1">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-app-ink-muted">网关地址</span>
            <Input
              className={localGatewayInputClassName}
              value={settings.localGateway.baseUrl}
              onChange={(event) => updateLocalGateway({ baseUrl: event.target.value })}
              placeholder="例如 http://localhost:8080"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-app-ink-muted">网关模型</span>
            <Input
              className={localGatewayInputClassName}
              value={settings.localGateway.model}
              onChange={(event) => updateLocalGateway({ model: event.target.value })}
              placeholder="网关使用的模型名"
            />
          </label>

          <p className="text-[13px] leading-5 text-app-ink-subtle">
            经本地网关复用 ChatGPT 订阅额度属于非官方用法，可能违反对应服务条款，请自行评估。
          </p>
        </div>
      ) : null}
    </section>
  );
}
