import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppSettings } from '../../services/app-settings-repository';
import { Field, SectionHeader, StatusLine } from './settings-shared';
import type { ProviderHealth, TestResult } from './settings-types';

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
  return (
    <section className="space-y-7" aria-labelledby="ai-settings-title">
      <SectionHeader
        id="ai-settings-title"
        title="AI 配置"
        description="选择用于整理工作记忆的 AI 服务。"
      />

      <div className="space-y-6">
        <Field label="当前服务" description="当前使用本机 Codex CLI。后续可扩展其他 AI 服务。">
          <div className="flex h-8 items-center text-sm text-app-ink">Codex CLI</div>
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

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-app-ink">Codex CLI 配置</h3>
        <Field label="Codex 命令" description="如果 Codex 不在 PATH 中，可以填写完整路径。">
          <Input
            value={settings.codexCommand}
            className="max-w-[23rem] bg-app-surface"
            onChange={(event) => onUpdateSettings({ codexCommand: event.target.value })}
          />
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
