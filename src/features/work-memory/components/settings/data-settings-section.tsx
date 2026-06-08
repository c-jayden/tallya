import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type DataSettingsSectionProps = {
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  isOpeningDataDirectory: boolean;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenDataDirectory: () => void;
  onRequestClear: () => void;
};

export function DataSettingsSection({
  isExportingBackup,
  isImportingBackup,
  isOpeningDataDirectory,
  onExportBackup,
  onImportBackup,
  onOpenDataDirectory,
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
