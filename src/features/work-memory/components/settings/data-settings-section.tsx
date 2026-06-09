import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AppSettings } from '../../services/app-settings-repository';

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
    <section className="space-y-6" aria-label="数据管理">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-app-ink">本地数据</div>
        <p className="text-sm text-app-ink-subtle">你的工作记忆默认保存在本机。</p>
      </div>

      <DataActionRow
        title="数据备份"
        description="导出一份本地备份，方便迁移或恢复。"
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
        title="数据恢复"
        description="从备份文件恢复工作记忆、报告和设置。"
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
        title="数据目录"
        description="查看当前 SQLite 数据和应用数据所在位置。"
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
        description="记录应用运行中的错误和诊断信息，方便排查问题。"
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
        description="记录更多响应结构信息，但不会记录 API Key。"
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
        title="危险操作"
        description="删除已保存的工作记忆和草稿。"
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
