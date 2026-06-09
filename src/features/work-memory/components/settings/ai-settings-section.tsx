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
import type { AppSettings } from '../../services/app-settings-repository';
import type { AIProviderId } from '../../services/ai/ai-provider';
import {
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  getDefaultProviderModel,
  getKnownProviderModels,
  normalizeProviderModel,
} from '../../services/ai/known-models';
import { Field, StatusLine } from './settings-shared';
import type { ProviderHealth } from './settings-types';

const visibleProviderOptions: { value: AIProviderId; label: string; description: string }[] = [
  {
    value: 'ai-codex-cli',
    label: 'Codex CLI',
    description: '通过本机 Codex CLI 整理工作记忆。',
  },
  {
    value: 'openai-compatible',
    label: 'OpenAI Compatible',
    description:
      '用于兼容 OpenAI 格式的 API 服务，可填写 OpenAI、DeepSeek、Kimi、OpenRouter、CC Switch 或公司网关的地址和模型。如果该 Provider 是 Claude / Anthropic 格式，当前 OpenAI Compatible 可能无法使用。',
  },
];

const openAIInputClassName = 'placeholder:text-slate-400';

type AISettingsSectionProps = {
  settings: AppSettings;
  providerHealth: ProviderHealth;
  isCheckingProvider: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckHealth: () => void;
};

export function AISettingsSection({
  settings,
  providerHealth,
  isCheckingProvider,
  onUpdateSettings,
  onCheckHealth,
}: AISettingsSectionProps) {
  const selectedProvider =
    visibleProviderOptions.find((option) => option.value === settings.aiProviderId) ??
    visibleProviderOptions[0];
  const isCodexProvider = selectedProvider.value === 'ai-codex-cli';
  const codexModelOptions = getKnownProviderModels('ai-codex-cli');
  const selectedCodexModel =
    normalizeProviderModel('ai-codex-cli', settings.codexModel) ||
    getDefaultProviderModel('ai-codex-cli');

  return (
    <section className="space-y-7" aria-label="AI 配置">
      <p className="text-sm text-app-ink-subtle">选择用于整理工作记忆的 AI 服务。</p>

      <div className="space-y-6">
        <Field label="AI 服务" description={selectedProvider.description}>
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
          <Field label="模型" description="选择 Codex CLI 用于整理工作记忆的模型。">
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
            <Field label="Base URL">
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

            <Field label="API Key">
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
                placeholder="sk-xxxxxx"
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
          </div>
        )}

        <Field label="服务状态">
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
                检测连接
              </Button>
              <StatusLine health={providerHealth} />
            </div>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              连接检测会确认当前 AI 服务是否可访问，模型和账号状态会在生成时继续校验。
            </p>
          </div>
        </Field>
      </div>
    </section>
  );
}
