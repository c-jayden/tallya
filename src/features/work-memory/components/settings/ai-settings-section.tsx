import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, StatusLine } from './settings-shared';
import type { ProviderHealth, TestResult } from './settings-types';

type AISettingsSectionProps = {
  providerHealth: ProviderHealth;
  testResult: TestResult;
  isCheckingProvider: boolean;
  isTestingCodex: boolean;
  onCheckHealth: () => void;
  onTestGenerate: () => void;
};

export function AISettingsSection({
  providerHealth,
  testResult,
  isCheckingProvider,
  isTestingCodex,
  onCheckHealth,
  onTestGenerate,
}: AISettingsSectionProps) {
  return (
    <section className="space-y-7" aria-label="AI 配置">
      <p className="text-sm text-app-ink-subtle">选择用于整理工作记忆的 AI 服务。</p>

      <div className="space-y-6">
        <Field label="AI 服务" description="使用本机 Codex CLI 整理工作记忆。">
          <div className="flex h-10 w-fit min-w-40 items-center rounded-lg border border-app-border bg-[#F1F5F9] px-3 text-sm font-semibold text-app-ink dark:bg-app-surface-muted">
            Codex CLI
          </div>
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
