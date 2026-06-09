import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClearDataConfirmDialog } from './settings/clear-data-confirm-dialog';
import { ImportBackupConfirmDialog } from './settings/import-backup-confirm-dialog';
import { SettingsContent } from './settings/settings-content';
import { SettingsMenu } from './settings/settings-menu';
import { useSettingsDialogState } from './settings/use-settings-dialog-state';

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClearLocalData: () => Promise<void>;
  onDataRestored?: () => Promise<void>;
};

export function SettingsDialog({
  open,
  onOpenChange,
  onClearLocalData,
  onDataRestored,
}: SettingsDialogProps) {
  const settingsState = useSettingsDialogState({ open, onClearLocalData, onDataRestored });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && settingsState.isImportingBackup) {
      return;
    }

    if (!nextOpen) {
      settingsState.resetTransientState();
    }

    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          className="tallya-dialog-content flex h-[min(600px,calc(100vh-4rem))] w-[min(760px,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(760px,calc(100vw-3rem))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              设置
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              配置本地 AI、提醒和应用偏好。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-[9rem_minmax(0,1fr)]">
            <SettingsMenu
              activeSection={settingsState.activeSection}
              onSelect={settingsState.setActiveSection}
            />
            <SettingsContent
              activeSection={settingsState.activeSection}
              settings={settingsState.settings}
              isLoadingSettings={settingsState.isLoadingSettings}
              providerHealth={settingsState.providerHealth}
              isCheckingProvider={settingsState.isCheckingProvider}
              isExportingBackup={settingsState.isExportingBackup}
              isImportingBackup={settingsState.isImportingBackup}
              isOpeningDataDirectory={settingsState.isOpeningDataDirectory}
              isSendingTestNotification={settingsState.isSendingTestNotification}
              onUpdateSettings={settingsState.updateSettings}
              onCheckHealth={settingsState.checkProviderHealth}
              onExportBackup={settingsState.exportBackup}
              onImportBackup={settingsState.requestImportBackup}
              onOpenDataDirectory={settingsState.openDataDirectory}
              onSendTestNotification={settingsState.sendTestNotification}
              onRequestClear={() => settingsState.setIsClearConfirmOpen(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ClearDataConfirmDialog
        open={settingsState.isClearConfirmOpen}
        isClearingData={settingsState.isClearingData}
        onOpenChange={settingsState.setIsClearConfirmOpen}
        onConfirm={settingsState.clearLocalData}
      />
      <ImportBackupConfirmDialog
        open={settingsState.isImportConfirmOpen}
        isImportingBackup={settingsState.isImportingBackup}
        onOpenChange={settingsState.setIsImportConfirmOpen}
        onConfirm={settingsState.confirmImportBackup}
      />
    </>
  );
}
