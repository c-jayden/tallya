import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../../services/ai/ai-service';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../../services/app-settings-repository';
import { applyAppTheme } from '../../services/app-theme';
import { backupService, type BackupPayload } from '../../services/backup-service';
import { reminderService } from '../../services/reminder-service';
import { syncWindowBehaviorSettings } from '../../services/window-service';
import {
  defaultSettingsSection,
  type ProviderHealth,
  type SettingsSection,
} from './settings-types';

type UseSettingsDialogStateOptions = {
  open: boolean;
  onClearLocalData: () => Promise<void>;
  onDataRestored?: () => Promise<void>;
};

const initialProviderHealth: ProviderHealth = {
  status: 'unknown',
  message: '尚未检测',
};

const SETTINGS_SAVE_DEBOUNCE_MS = 500;

export function useSettingsDialogState({
  open,
  onClearLocalData,
  onDataRestored,
}: UseSettingsDialogStateOptions) {
  const asyncRunId = useRef(0);
  const settingsSaveRunId = useRef(0);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const pendingSettingsRef = useRef<AppSettings | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(defaultSettingsSection);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isSelectingBackupFile, setIsSelectingBackupFile] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isOpeningDataDirectory, setIsOpeningDataDirectory] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingBackupPayload, setPendingBackupPayload] = useState<BackupPayload | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>(initialProviderHealth);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;
    const loadSaveRunId = settingsSaveRunId.current;

    clearPendingSettingsSave();

    void appSettingsRepository
      .getSettings()
      .then((savedSettings) => {
        // A slow SQLite read can finish after a local edit; do not replay stale
        // persisted values over the user's current selection.
        if (
          isMounted &&
          loadSaveRunId === settingsSaveRunId.current &&
          pendingSettingsRef.current === null
        ) {
          latestSettingsRef.current = savedSettings;
          pendingSettingsRef.current = null;
          setSettings(savedSettings);
          applyAppTheme(savedSettings.theme);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  async function persistSettings(nextSettings: AppSettings) {
    clearPendingSettingsSave();
    pendingSettingsRef.current = null;

    const runId = ++settingsSaveRunId.current;

    setSettings(nextSettings);

    try {
      const savedSettings = await appSettingsRepository.saveSettings(nextSettings);
      if (runId === settingsSaveRunId.current) {
        latestSettingsRef.current = savedSettings;
        pendingSettingsRef.current = null;
        setSettings(savedSettings);
      }
      applyPersistedSettings(savedSettings);

      return savedSettings;
    } catch {
      toast.error('设置保存失败，请稍后重试');

      return nextSettings;
    }
  }

  function clearPendingSettingsSave() {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }

  function scheduleSettingsSave(nextSettings: AppSettings) {
    pendingSettingsRef.current = nextSettings;
    clearPendingSettingsSave();

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;

      if (pendingSettingsRef.current) {
        void persistSettings(pendingSettingsRef.current);
      }
    }, SETTINGS_SAVE_DEBOUNCE_MS);
  }

  async function flushPendingSettingsSave() {
    const pendingSettings = pendingSettingsRef.current;

    if (!pendingSettings) {
      return;
    }

    clearPendingSettingsSave();
    await persistSettings(pendingSettings);
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const nextSettings = { ...latestSettingsRef.current, ...patch };

    settingsSaveRunId.current += 1;
    latestSettingsRef.current = nextSettings;
    setSettings(nextSettings);

    if (patch.theme) {
      applyAppTheme(nextSettings.theme);
    }

    if (
      patch.closeToTray !== undefined ||
      patch.startMinimized !== undefined ||
      patch.launchAtStartup !== undefined
    ) {
      void syncWindowBehaviorSettings(nextSettings);
    }

    scheduleSettingsSave(nextSettings);
  }

  async function checkProviderHealth() {
    const runId = ++asyncRunId.current;

    setIsCheckingProvider(true);
    setProviderHealth({ status: 'checking', message: '正在检测连接...' });

    try {
      await persistSettings(normalizeProviderSettings(latestSettingsRef.current));
      const health = await aiService.checkHealth();

      if (runId === asyncRunId.current) {
        setProviderHealth(health);
      }
    } catch {
      if (runId === asyncRunId.current) {
        setProviderHealth({
          status: 'unavailable',
          message: '检测失败',
          detail: '请检查当前 AI 服务配置。',
        });
      }
    } finally {
      if (runId === asyncRunId.current) {
        setIsCheckingProvider(false);
      }
    }
  }

  async function clearLocalData() {
    setIsClearingData(true);

    try {
      await onClearLocalData();
      toast.success('本地数据已清空');
      setIsClearConfirmOpen(false);
    } catch {
      toast.error('清空本地数据失败，请稍后重试');
    } finally {
      setIsClearingData(false);
    }
  }

  async function exportBackup() {
    setIsExportingBackup(true);

    try {
      await flushPendingSettingsSave();
      const result = await backupService.exportBackupToFile();

      if (result.status === 'exported') {
        toast.success('备份已导出');
      }
    } catch {
      toast.error('导出备份失败，请稍后重试');
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function requestImportBackup() {
    setIsSelectingBackupFile(true);

    try {
      const payload = await backupService.selectBackupFile();

      if (payload) {
        setPendingBackupPayload(payload);
        setIsImportConfirmOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '备份文件格式不正确';

      toast.error(message);
    } finally {
      setIsSelectingBackupFile(false);
    }
  }

  async function confirmImportBackup() {
    if (!pendingBackupPayload || isImportingBackup) {
      return;
    }

    setIsImportingBackup(true);

    try {
      clearPendingSettingsSave();
      pendingSettingsRef.current = null;

      const savedSettings = await backupService.restoreBackupPayload(pendingBackupPayload);

      latestSettingsRef.current = savedSettings;
      setSettings(savedSettings);
      applyPersistedSettings(savedSettings);
      await onDataRestored?.();
      toast.success('备份已导入');
      setPendingBackupPayload(null);
      setIsImportConfirmOpen(false);
    } catch {
      toast.error('导入备份失败，请稍后重试');
    } finally {
      setIsImportingBackup(false);
    }
  }

  function updateImportConfirmOpen(nextOpen: boolean) {
    if (isImportingBackup) {
      return;
    }

    setIsImportConfirmOpen(nextOpen);

    if (!nextOpen) {
      setPendingBackupPayload(null);
    }
  }

  async function openDataDirectory() {
    setIsOpeningDataDirectory(true);

    try {
      await backupService.openDataDirectory();
    } catch {
      toast.error('打开数据目录失败');
    } finally {
      setIsOpeningDataDirectory(false);
    }
  }

  async function sendTestNotification() {
    setIsSendingTestNotification(true);

    try {
      await reminderService.sendTestNotification();
      toast.success('测试通知已发送');
    } catch {
      toast.error('发送测试通知失败，请检查系统通知权限。');
    } finally {
      setIsSendingTestNotification(false);
    }
  }

  function resetTransientState() {
    void flushPendingSettingsSave();
    asyncRunId.current += 1;
    setActiveSection(defaultSettingsSection);
    setIsClearConfirmOpen(false);
    setIsImportConfirmOpen(false);
    setIsCheckingProvider(false);
    setIsExportingBackup(false);
    setIsSelectingBackupFile(false);
    setIsImportingBackup(false);
    setIsOpeningDataDirectory(false);
    setIsSendingTestNotification(false);
    setPendingBackupPayload(null);
    setProviderHealth(initialProviderHealth);
  }

  return {
    activeSection,
    checkProviderHealth,
    confirmImportBackup,
    clearLocalData,
    exportBackup,
    providerHealth,
    isCheckingProvider,
    isClearConfirmOpen,
    isClearingData,
    isExportingBackup,
    isImportConfirmOpen,
    isImportingBackup: isSelectingBackupFile || isImportingBackup,
    isLoadingSettings,
    isOpeningDataDirectory,
    isSendingTestNotification,
    openDataDirectory,
    requestImportBackup,
    setActiveSection,
    setIsClearConfirmOpen,
    setIsImportConfirmOpen: updateImportConfirmOpen,
    settings,
    sendTestNotification,
    updateSettings,
    resetTransientState,
  };
}

function normalizeProviderSettings(settings: AppSettings) {
  return {
    ...settings,
    codexCommand: settings.codexCommand.trim() || DEFAULT_APP_SETTINGS.codexCommand,
  };
}

function applyPersistedSettings(settings: AppSettings) {
  applyAppTheme(settings.theme);
  void reminderService.reschedule(settings);
  void syncWindowBehaviorSettings(settings);
}
