import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AppSettings, LocalGatewaySettings } from '../../services/app-settings-repository';
import type { OpenAICompatibleApiMode } from '../../services/ai/ai-provider';
import { SwitchField } from './settings-shared';

const localGatewayInputClassName = 'bg-app-surface placeholder:text-slate-400';

const apiModeOptions: {
  value: OpenAICompatibleApiMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'chat-completions',
    label: 'Chat Completions',
    description: '推荐 codex-proxy，或 cc-switch 开放 OpenAI 兼容端点时使用。',
  },
  {
    value: 'responses',
    label: 'Responses API',
    description: '仅本地网关明确支持 /v1/responses 时使用。',
  },
];

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

  return (
    <section className="space-y-3" aria-label="本地 AI 网关">
      <SwitchField
        label="自动使用本地网关"
        checked={settings.localGateway.enabled}
        onCheckedChange={(enabled) => updateLocalGateway({ enabled })}
      />
      <p className="text-[13px] leading-5 text-app-ink-subtle">
        打开后会自动探测本机网关，不可用时继续使用回退服务。
      </p>

      <details className="group/local-gateway border-t border-app-border pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-app-ink-muted transition-colors hover:text-app-ink [&::-webkit-details-marker]:hidden">
          <span>本地网关高级设置</span>
          <ChevronRight
            className="size-4 text-app-ink-subtle transition-transform group-open/local-gateway:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-3 grid gap-3">
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
              placeholder="留空时沿用回退服务的模型"
            />
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-app-ink-muted">接口模式</span>
              <div className="inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
                {apiModeOptions.map((option) => {
                  const isSelected = settings.localGateway.apiMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'h-8 cursor-pointer rounded-lg bg-transparent px-3.5 text-sm text-app-ink-muted transition-colors hover:text-app-ink focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed',
                        isSelected &&
                          'bg-white font-semibold text-app-ink shadow-[0_1px_1px_rgb(15_23_42/0.04)] dark:bg-app-surface dark:text-app-ink',
                      )}
                      aria-pressed={isSelected}
                      onClick={() => updateLocalGateway({ apiMode: option.value })}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              {apiModeOptions.map((option) => (
                <p key={option.value} className="text-[13px] leading-5 text-app-ink-subtle">
                  {option.label}：{option.description}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-[13px] leading-5 text-app-ink-subtle">
            <p>
              codex-proxy 默认是本地 OpenAI 兼容端点；cc-switch 需要先开放 OpenAI
              兼容端点。
            </p>
            <p>经本地网关复用 ChatGPT 订阅额度属于非官方用法，可能违反对应服务条款，请自行评估。</p>
          </div>
        </div>
      </details>
    </section>
  );
}
