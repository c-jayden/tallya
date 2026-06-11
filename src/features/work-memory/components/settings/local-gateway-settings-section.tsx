import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  AppSettings,
  LocalGatewaySettings,
} from '../../services/app-settings-repository';
import type { OpenAICompatibleApiMode } from '../../services/ai/ai-provider';
import { Field, StatusLine, SwitchField } from './settings-shared';
import type { ProviderHealth } from './settings-types';

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
  localGatewayHealth: ProviderHealth;
  isCheckingLocalGateway: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckLocalGateway: () => void;
};

export function LocalGatewaySettingsSection({
  settings,
  localGatewayHealth,
  isCheckingLocalGateway,
  onUpdateSettings,
  onCheckLocalGateway,
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
    <div className="space-y-4 border-t border-app-border pt-5" aria-label="本地 AI 网关">
      <Field
        label="本地 AI 网关"
        description="没有本地网关也没关系，会继续使用 Codex CLI，无需额外操作。"
      >
        <div className="space-y-4">
          <SwitchField
            label="启用本地网关"
            checked={settings.localGateway.enabled}
            onCheckedChange={(enabled) => updateLocalGateway({ enabled })}
          />

          <div className="grid gap-3">
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
              <span className="font-medium text-app-ink-muted">模型</span>
              <Input
                className={localGatewayInputClassName}
                value={settings.localGateway.model}
                onChange={(event) => updateLocalGateway({ model: event.target.value })}
                placeholder="填网关里显示的模型名"
              />
            </label>
          </div>

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

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isCheckingLocalGateway}
                onClick={onCheckLocalGateway}
              >
                {isCheckingLocalGateway && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                )}
                检测
              </Button>
              <StatusLine health={localGatewayHealth} />
            </div>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              运行 codex-proxy，或让 cc-switch 开放 OpenAI 兼容端点后，整理会优先走本地 HTTP。
              模型留空时，会继续使用默认 AI 服务。
            </p>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              经本地网关复用 ChatGPT 订阅额度属于非官方用法，可能违反对应服务条款，请自行评估。
            </p>
          </div>
        </div>
      </Field>
    </div>
  );
}
