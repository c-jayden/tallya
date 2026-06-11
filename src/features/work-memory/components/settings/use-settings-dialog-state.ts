import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '../../services/ai/ai-service';
import { probeLocalGateway } from '../../services/ai/local-gateway';
import {
  DEFAULT_OPENAI_COMPATIBLE_PARAMETERS,
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../../services/app-settings-repository';
import { applyAppTheme } from '../../services/app-theme';
import { backupService, type BackupPayload } from '../../services/backup-service';
import { logger } from '../../services/logger/logger';
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

const initialLocalGatewayHealth: ProviderHealth = {
  status: 'unknown',
  message: '尚未检测',
};

const SETTINGS_SAVE_DEBOUNCE_MS = 500;
const REPORT_STYLE_EXTRACT_TIMEOUT_MS = 60_000;

export function useSettingsDialogState({
  open,
  onClearLocalData,
  onDataRestored,
}: UseSettingsDialogStateOptions) {
  const asyncRunId = useRef(0);
  // Separate run-id: the AI section fires the gateway + provider checks together,
  // so they must not share a counter or the first to start looks "stale".
  const localGatewayRunId = useRef(0);
  const settingsSaveRunId = useRef(0);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const pendingSettingsRef = useRef<AppSettings | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(defaultSettingsSection);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [isCheckingLocalGateway, setIsCheckingLocalGateway] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isSelectingBackupFile, setIsSelectingBackupFile] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isOpeningDataDirectory, setIsOpeningDataDirectory] = useState(false);
  const [isOpeningLogDirectory, setIsOpeningLogDirectory] = useState(false);
  const [isExportingDiagnosticLog, setIsExportingDiagnosticLog] = useState(false);
  const [isDiagnosticLogConfirmOpen, setIsDiagnosticLogConfirmOpen] = useState(false);
  const [isExtractingReportStyle, setIsExtractingReportStyle] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingBackupPayload, setPendingBackupPayload] = useState<BackupPayload | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>(initialProviderHealth);
  const [localGatewayHealth, setLocalGatewayHealth] =
    useState<ProviderHealth>(initialLocalGatewayHealth);

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

    if (patch.diagnosticLoggingEnabled !== undefined) {
      logger.setDetailedLoggingEnabled(nextSettings.diagnosticLoggingEnabled);
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

  async function checkLocalGateway() {
    const runId = ++localGatewayRunId.current;

    setIsCheckingLocalGateway(true);
    setLocalGatewayHealth({ status: 'checking', message: '正在检测网关...' });

    try {
      const savedSettings = await persistSettings(normalizeProviderSettings(latestSettingsRef.current));
      const result = await probeLocalGateway(savedSettings.localGateway.baseUrl);

      if (runId === localGatewayRunId.current) {
        setLocalGatewayHealth(
          result.reachable
            ? {
                status: 'available',
                message: '检测到网关，可用',
              }
            : {
                status: 'unavailable',
                message: '未检测到本地网关',
                detail: '将使用 Codex CLI',
              },
        );
      }
    } catch {
      if (runId === localGatewayRunId.current) {
        setLocalGatewayHealth({
          status: 'unavailable',
          message: '检测失败',
          detail: '将使用 Codex CLI',
        });
      }
    } finally {
      if (runId === localGatewayRunId.current) {
        setIsCheckingLocalGateway(false);
      }
    }
  }

  async function clearLocalData() {
    setIsClearingData(true);

    try {
      await onClearLocalData();
      toast.success('本地数据已清空');
      setIsClearConfirmOpen(false);
    } catch (error) {
      logger.error('sqlite', 'data.clear_failed', 'Failed to clear local data', { error });
      toast.error('清空本地数据失败');
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
    } catch (error) {
      logger.error('backup', 'backup.export_failed', 'Failed to export backup', { error });
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

      logger.error('backup', 'backup.import_file_failed', 'Failed to read backup file', {
        error,
      });
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
    } catch (error) {
      logger.error('backup', 'backup.restore_failed', 'Failed to restore backup', { error });
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
    } catch (error) {
      logger.error('backup', 'backup.open_data_directory_failed', 'Failed to open data directory', {
        error,
      });
      toast.error('打开数据目录失败');
    } finally {
      setIsOpeningDataDirectory(false);
    }
  }

  async function openLogDirectory() {
    setIsOpeningLogDirectory(true);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_app_directory', { kind: 'logs' });
    } catch (error) {
      logger.error('settings', 'diagnostic_log.open_directory_failed', 'Failed to open log directory', {
        error,
      });
      toast.error('打开日志目录失败');
    } finally {
      setIsOpeningLogDirectory(false);
    }
  }

  async function exportDiagnosticLog() {
    setIsExportingDiagnosticLog(true);

    try {
      const result = await logger.exportDiagnosticLogs();

      if (result.status === 'exported') {
        toast.success('诊断日志已导出');
      }
      setIsDiagnosticLogConfirmOpen(false);
    } catch (error) {
      logger.error('settings', 'diagnostic_log.export_failed', 'Failed to export diagnostic logs', {
        error,
      });
      toast.error('导出诊断日志失败');
    } finally {
      setIsExportingDiagnosticLog(false);
    }
  }

  async function extractReportStylePrompt(sampleText: string) {
    const trimmedSampleText = sampleText.trim();

    if (!trimmedSampleText) {
      throw new Error('先粘贴样本');
    }

    setIsExtractingReportStyle(true);

    try {
      const result = await withTimeout(
        aiService.analyzeReportStyle({ sampleText: trimmedSampleText }),
        REPORT_STYLE_EXTRACT_TIMEOUT_MS,
        '风格提取等待时间较长，请检查 AI 服务配置后再试。',
      );
      const promptHint = result.promptHint.trim();

      if (!promptHint) {
        throw new Error('没有提取到可用风格，请换一段样本再试。');
      }

      return result.promptHint.trim();
    } catch (error) {
      logger.error('settings', 'report_style.extract_failed', 'Failed to extract report style', {
        sampleTextLength: trimmedSampleText.length,
        error,
      });
      throw error instanceof Error ? error : new Error('风格提取失败，请稍后重试');
    } finally {
      setIsExtractingReportStyle(false);
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
    localGatewayRunId.current += 1;
    setActiveSection(defaultSettingsSection);
    setIsClearConfirmOpen(false);
    setIsImportConfirmOpen(false);
    setIsCheckingProvider(false);
    setIsCheckingLocalGateway(false);
    setIsExportingBackup(false);
    setIsSelectingBackupFile(false);
    setIsImportingBackup(false);
    setIsOpeningDataDirectory(false);
    setIsOpeningLogDirectory(false);
    setIsExportingDiagnosticLog(false);
    setIsDiagnosticLogConfirmOpen(false);
    setIsExtractingReportStyle(false);
    setIsSendingTestNotification(false);
    setPendingBackupPayload(null);
    setProviderHealth(initialProviderHealth);
    setLocalGatewayHealth(initialLocalGatewayHealth);
  }

  return {
    activeSection,
    checkLocalGateway,
    checkProviderHealth,
    confirmImportBackup,
    clearLocalData,
    exportBackup,
    localGatewayHealth,
    providerHealth,
    isCheckingLocalGateway,
    isCheckingProvider,
    isClearConfirmOpen,
    isClearingData,
    isExportingBackup,
    isImportConfirmOpen,
    isImportingBackup: isSelectingBackupFile || isImportingBackup,
    isLoadingSettings,
    isOpeningDataDirectory,
    isOpeningLogDirectory,
    isExportingDiagnosticLog,
    isDiagnosticLogConfirmOpen,
    isExtractingReportStyle,
    isSendingTestNotification,
    extractReportStylePrompt,
    exportDiagnosticLog,
    openDataDirectory,
    openLogDirectory,
    requestImportBackup,
    setActiveSection,
    setIsClearConfirmOpen,
    setIsImportConfirmOpen: updateImportConfirmOpen,
    setIsDiagnosticLogConfirmOpen,
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
    openAICompatible: {
      baseUrl:
        settings.openAICompatible.baseUrl.trim() ||
        DEFAULT_APP_SETTINGS.openAICompatible.baseUrl,
      apiKey: settings.openAICompatible.apiKey.trim(),
      model:
        settings.openAICompatible.model.trim() ||
        DEFAULT_APP_SETTINGS.openAICompatible.model,
      apiMode:
        settings.openAICompatible.apiMode || DEFAULT_APP_SETTINGS.openAICompatible.apiMode,
      parameters: {
        ...DEFAULT_OPENAI_COMPATIBLE_PARAMETERS,
        ...settings.openAICompatible.parameters,
      },
    },
    localGateway: {
      enabled: settings.localGateway.enabled,
      baseUrl:
        settings.localGateway.baseUrl.trim() || DEFAULT_APP_SETTINGS.localGateway.baseUrl,
      model: settings.localGateway.model.trim(),
      apiMode: settings.localGateway.apiMode || DEFAULT_APP_SETTINGS.localGateway.apiMode,
    },
  };
}

function applyPersistedSettings(settings: AppSettings) {
  applyAppTheme(settings.theme);
  logger.setDetailedLoggingEnabled(settings.diagnosticLoggingEnabled);
  void reminderService.reschedule(settings);
  void syncWindowBehaviorSettings(settings);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout>;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    globalThis.clearTimeout(timeoutId);
  });
}
