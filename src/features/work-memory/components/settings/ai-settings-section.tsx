import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AppSettings } from '../../services/app-settings-repository';
import type { AIProviderId, OpenAICompatibleApiMode } from '../../services/ai/ai-provider';
import {
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  getDefaultProviderModel,
  getKnownProviderModels,
  normalizeProviderModel,
} from '../../services/ai/known-models';
import {
  CUSTOM_OPENAI_PROVIDER_ID,
  getOpenAIProviderPreset,
  matchOpenAIProviderPreset,
  openAICompatibleProviderPresets,
} from '../../services/ai/known-openai-providers';
import { LocalGatewaySettingsSection } from './local-gateway-settings-section';
import { Field, StatusLine } from './settings-shared';
import type { ProviderHealth } from './settings-types';

const visibleProviderOptions: { value: AIProviderId; label: string; description: string }[] = [
  {
    value: 'ai-codex-cli',
    label: 'Codex CLI',
    description: '使用本机 Codex CLI，适合作为稳定回退。',
  },
  {
    value: 'openai-compatible',
    label: 'OpenAI 兼容服务',
    description: '接入兼容 OpenAI 接口的服务商、本地代理或公司网关。',
  },
];

const openAIInputClassName = 'placeholder:text-slate-400';

const apiModeOptions: {
  value: OpenAICompatibleApiMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'chat-completions',
    label: 'Chat Completions',
    description: '大多数兼容服务都可以先用这个模式。',
  },
  {
    value: 'responses',
    label: 'Responses API',
    description: '服务明确要求 /v1/responses 时再切换。',
  },
];

type AISettingsSectionProps = {
  settings: AppSettings;
  providerHealth: ProviderHealth;
  localGatewayHealth: ProviderHealth;
  isCheckingProvider: boolean;
  isCheckingLocalGateway: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckHealth: () => void;
  onCheckLocalGateway: () => void;
};

export function AISettingsSection({
  settings,
  providerHealth,
  localGatewayHealth,
  isCheckingProvider,
  isCheckingLocalGateway,
  onUpdateSettings,
  onCheckHealth,
  onCheckLocalGateway,
}: AISettingsSectionProps) {
  const selectedProvider =
    visibleProviderOptions.find((option) => option.value === settings.aiProviderId) ??
    visibleProviderOptions[0];
  const isCodexProvider = selectedProvider.value === 'ai-codex-cli';
  const codexModelOptions = getKnownProviderModels('ai-codex-cli');
  const selectedCodexModel =
    normalizeProviderModel('ai-codex-cli', settings.codexModel) ||
    getDefaultProviderModel('ai-codex-cli');
  const selectedPresetId = matchOpenAIProviderPreset(settings.openAICompatible.baseUrl);
  const activePresetHint = getOpenAIProviderPreset(selectedPresetId)?.hint;

  function applyProviderPreset(presetId: string) {
    const preset = getOpenAIProviderPreset(presetId);

    // 自定义: keep whatever the user already typed; only presets prefill fields.
    if (!preset) {
      return;
    }

    onUpdateSettings({
      openAICompatible: {
        ...settings.openAICompatible,
        baseUrl: preset.baseUrl,
        apiMode: preset.apiMode,
        model: preset.defaultModel || settings.openAICompatible.model,
      },
    });
  }

  return (
    <section className="space-y-7" aria-label="AI 配置">
      <p className="text-sm text-app-ink-subtle">
        选择帮你整理工作记忆的 AI 服务；没有本地网关时会按这里回退。
      </p>

      <div className="space-y-6">
        <LocalGatewaySettingsSection
          settings={settings}
          localGatewayHealth={localGatewayHealth}
          isCheckingLocalGateway={isCheckingLocalGateway}
          onUpdateSettings={onUpdateSettings}
          onCheckLocalGateway={onCheckLocalGateway}
        />

        <Field label="默认 AI 服务" description={selectedProvider.description}>
          <Select
            value={selectedProvider.value}
            onValueChange={(value) => {
              const aiProviderId = value as AIProviderId;

              onUpdateSettings({
                aiProviderId,
                codexModel:
                  aiProviderId === 'ai-codex-cli'
                    ? normalizeProviderModel(aiProviderId, settings.codexModel) ||
                      getDefaultProviderModel(aiProviderId)
                    : settings.codexModel,
              });
            }}
          >
            <SelectTrigger className="h-10 w-56 bg-app-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleProviderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isCodexProvider ? (
          <Field label="模型" description="选择 Codex CLI 整理工作记忆时使用的模型。">
            <Select
              value={selectedCodexModel}
              onValueChange={(codexModel) => onUpdateSettings({ codexModel })}
            >
              <SelectTrigger className="h-10 w-56 bg-app-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {codexModelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <div className="space-y-5">
            <Field
              label="服务商"
              description="已内置 DeepSeek、通义、Kimi、OpenRouter、OpenAI 等常用接口。Anthropic 格式可先通过网关转成 OpenAI 兼容接口。"
            >
              <Select value={selectedPresetId} onValueChange={applyProviderPreset}>
                <SelectTrigger className="h-10 w-56 bg-app-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {openAICompatibleProviderPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_OPENAI_PROVIDER_ID}>自定义</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="服务地址">
              <Input
                className={openAIInputClassName}
                value={settings.openAICompatible.baseUrl}
                onChange={(event) =>
                  onUpdateSettings({
                    openAICompatible: {
                      ...settings.openAICompatible,
                      baseUrl: event.target.value,
                    },
                  })
                }
                placeholder="https://api.openai.com/v1"
              />
            </Field>

            <Field label="密钥">
              <Input
                className={openAIInputClassName}
                type="password"
                value={settings.openAICompatible.apiKey}
                onChange={(event) =>
                  onUpdateSettings({
                    openAICompatible: {
                      ...settings.openAICompatible,
                      apiKey: event.target.value,
                    },
                  })
                }
                placeholder="粘贴服务商提供的 API Key"
                autoComplete="off"
              />
            </Field>

            <Field label="模型">
              <Input
                className={openAIInputClassName}
                value={settings.openAICompatible.model}
                onChange={(event) =>
                  onUpdateSettings({
                    openAICompatible: {
                      ...settings.openAICompatible,
                      model: event.target.value,
                    },
                  })
                }
                placeholder={DEFAULT_OPENAI_COMPATIBLE_MODEL}
              />
            </Field>

            {activePresetHint ? (
              <p className="text-[13px] leading-5 text-app-ink-subtle">{activePresetHint}</p>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-app-ink-muted">接口模式</span>
                <div className="inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
                  {apiModeOptions.map((option) => {
                    const isSelected = settings.openAICompatible.apiMode === option.value;

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
                        onClick={() => {
                          const mode = option.value;

                          onUpdateSettings({
                            openAICompatible: {
                              ...settings.openAICompatible,
                              apiMode: mode,
                            },
                          });
                        }}
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
              <p className="text-[13px] leading-5 text-app-ink-subtle">
                本地网关或公司网关遇到 “only /v1/responses” 时，再切换到 Responses API。
              </p>
            </div>
          </div>
        )}

        <Field label="连接状态">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isCheckingProvider}
                onClick={onCheckHealth}
              >
                {isCheckingProvider && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                )}
                检测一下
              </Button>
              <StatusLine health={providerHealth} />
            </div>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              检测只确认服务能连通；模型和账号额度会在实际整理时继续校验。
            </p>
          </div>
        </Field>
      </div>
    </section>
  );
}
