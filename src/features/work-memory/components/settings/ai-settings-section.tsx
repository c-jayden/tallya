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
import { Field, StatusLine } from './settings-shared';
import type { ProviderHealth, TestResult } from './settings-types';

const visibleProviderOptions: { value: AIProviderId; label: string; description: string }[] = [
  {
    value: 'ai-codex-cli',
    label: 'Codex CLI',
    description: '通过本机 Codex CLI 整理工作记忆。',
  },
];

type AISettingsSectionProps = {
  settings: AppSettings;
  providerHealth: ProviderHealth;
  testResult: TestResult;
  isCheckingProvider: boolean;
  isTestingCodex: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckHealth: () => void;
  onTestGenerate: () => void;
};

export function AISettingsSection({
  settings,
  providerHealth,
  testResult,
  isCheckingProvider,
  isTestingCodex,
  onUpdateSettings,
  onCheckHealth,
  onTestGenerate,
}: AISettingsSectionProps) {
  const selectedProvider =
    visibleProviderOptions.find((option) => option.value === settings.aiProviderId) ??
    visibleProviderOptions[0];

  return (
    <section className="space-y-7" aria-label="AI 配置">
      <p className="text-sm text-app-ink-subtle">选择用于整理工作记忆的 AI 服务。</p>

      <div className="space-y-6">
        <Field label="AI 服务" description={selectedProvider.description}>
          <Select
            value={selectedProvider.value}
            onValueChange={(value) => onUpdateSettings({ aiProviderId: value as AIProviderId })}
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
              <Button
                type="button"
                variant="outline"
                disabled={isTestingCodex}
                onClick={onTestGenerate}
              >
                {isTestingCodex && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                测试生成
              </Button>
              <StatusLine health={providerHealth} />
            </div>
          </div>
        </Field>
      </div>

      {testResult.type === 'success' && (
        <div className="rounded-lg border border-app-border bg-app-surface-muted/55 p-3 text-sm">
          <div className="font-medium text-app-ink">生成成功</div>
          <div className="mt-1 text-app-ink-muted">摘要：{testResult.summary}</div>
        </div>
      )}
      {testResult.type === 'error' && (
        <p className="text-sm text-destructive">{testResult.message}</p>
      )}
    </section>
  );
}
