import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AppSettings } from '../../services/app-settings-repository';
import { usageStatsRepository } from '../../services/usage-stats-repository';

type DataSettingsSectionProps = {
  settings: AppSettings;
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  isOpeningDataDirectory: boolean;
  isOpeningLogDirectory: boolean;
  isExportingDiagnosticLog: boolean;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenDataDirectory: () => void;
  onOpenLogDirectory: () => void;
  onRequestExportDiagnosticLog: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onRequestClear: () => void;
};

export function DataSettingsSection({
  settings,
  isExportingBackup,
  isImportingBackup,
  isOpeningDataDirectory,
  isOpeningLogDirectory,
  isExportingDiagnosticLog,
  onExportBackup,
  onImportBackup,
  onOpenDataDirectory,
  onOpenLogDirectory,
  onRequestExportDiagnosticLog,
  onUpdateSettings,
  onRequestClear,
}: DataSettingsSectionProps) {
  return (
    <section className="space-y-6" aria-label="本地数据">
      <UsageStatsBlock />

      <DataActionRow
        title="备份一份"
        description="把工作记忆、报告和设置打包保存，方便之后迁移或恢复。"
        action={
          <Button
            type="button"
            variant="outline"
            disabled={isExportingBackup}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={onExportBackup}
          >
            {isExportingBackup ? '正在导出' : '导出备份'}
          </Button>
        }
      />

      <DataActionRow
        title="从备份恢复"
        description="选择之前导出的备份文件，把内容恢复到本机。"
        action={
          <Button
            type="button"
            variant="outline"
            disabled={isImportingBackup}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={onImportBackup}
          >
            {isImportingBackup ? '正在导入' : '导入备份'}
          </Button>
        }
      />

      <DataActionRow
        title="本地文件位置"
        description="打开 Tallya 保存工作记忆和应用文件的目录。"
        action={
          <Button
            type="button"
            variant="outline"
            disabled={isOpeningDataDirectory}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={onOpenDataDirectory}
          >
            打开数据目录
          </Button>
        }
      />

      <DataActionRow
        title="诊断日志"
        description="保留运行中的错误和诊断信息，方便之后排查。"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isOpeningLogDirectory}
              className="cursor-pointer disabled:cursor-not-allowed"
              onClick={onOpenLogDirectory}
            >
              打开日志目录
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isExportingDiagnosticLog}
              className="cursor-pointer disabled:cursor-not-allowed"
              onClick={onRequestExportDiagnosticLog}
            >
              {isExportingDiagnosticLog ? '正在导出' : '导出诊断日志'}
            </Button>
          </div>
        }
      />

      <DataActionRow
        title="启用详细诊断日志"
        description="记录更多响应结构信息，但不会记录 API Key。平时可以保持关闭。"
        action={
          <Switch
            checked={settings.diagnosticLoggingEnabled}
            className="cursor-pointer data-[disabled]:cursor-not-allowed"
            onCheckedChange={(checked) =>
              onUpdateSettings({ diagnosticLoggingEnabled: checked })
            }
          />
        }
      />

      <DataActionRow
        title="清理本机数据"
        description="删除已保存的工作记忆、草稿和报告，设置会保留。"
        action={
          <Button
            type="button"
            variant="destructive"
            className="cursor-pointer"
            onClick={onRequestClear}
          >
            清空本地数据
          </Button>
        }
      />
    </section>
  );
}

function UsageStatsBlock() {
  // Snapshot read on open; local-only, never uploaded. Helps validate whether
  // the tool is actually being used over time (see docs/PLAN.md retention).
  const summary = useMemo(() => usageStatsRepository.getSummary(), []);

  const hitRate =
    summary.searchHitRate === null ? '—' : `${Math.round(summary.searchHitRate * 100)}%`;

  return (
    <div className="rounded-lg border border-app-border bg-app-surface-muted/40 px-3.5 py-3">
      <div className="text-sm font-semibold text-app-ink">本机使用情况</div>
      <p className="mt-1 text-[13px] leading-[1.5] text-app-ink-subtle">
        仅保存在本机、不会上传，用于了解自己的使用情况。
      </p>
      {summary.firstUseDate ? (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <UsageStat label="已使用" value={`${summary.totalDays} 天`} />
          <UsageStat label="有记录的天数" value={`${summary.activeDays} 天`} />
          <UsageStat label="累计记录" value={`${summary.totalEntries} 条`} />
          <UsageStat label="近 7 天搜索" value={`${summary.recentSearchSessions} 次`} />
          <UsageStat label="搜得到率" value={hitRate} />
          <UsageStat label="近 7 天打开结果" value={`${summary.recentRetrievals} 次`} />
        </dl>
      ) : (
        <p className="mt-2.5 text-[13px] text-app-ink-muted">还没有使用数据。</p>
      )}
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-app-ink-subtle">{label}</dt>
      <dd className="font-medium text-app-ink tabular-nums">{value}</dd>
    </div>
  );
}

function DataActionRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-app-ink">{title}</div>
        <p className="mt-1 text-sm text-app-ink-subtle">{description}</p>
      </div>
      {action}
    </div>
  );
}
