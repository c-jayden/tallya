import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    description: '使用当前服务整理工作记忆。',
  },
];

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
  const modelOptions = getKnownProviderModels(selectedProvider.value);
  const selectedModel =
    normalizeProviderModel(selectedProvider.value, settings.codexModel) ||
    getDefaultProviderModel(selectedProvider.value);

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
                  normalizeProviderModel(aiProviderId, settings.codexModel) ||
                  getDefaultProviderModel(aiProviderId),
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

        <Field
          label="模型"
          description="选择当前服务用于整理工作记忆的模型。"
        >
          <Select
            value={selectedModel}
            onValueChange={(codexModel) => onUpdateSettings({ codexModel })}
          >
            <SelectTrigger className="h-10 w-56 bg-app-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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
              连接检测会快速确认当前服务是否可访问，模型和账号状态会在生成时继续校验。
            </p>
          </div>
        </Field>
      </div>
    </section>
  );
}
