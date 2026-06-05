import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { aiService } from '../../services/ai/ai-service';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../../services/app-settings-repository';
import { reminderService } from '../../services/reminder-service';
import { syncWindowBehaviorSettings } from '../../services/window-service';
import {
  type ProviderHealth,
  type SettingsSection,
} from './settings-types';

type UseSettingsDialogStateOptions = {
  open: boolean;
  onClearLocalData: () => Promise<void>;
};

const initialProviderHealth: ProviderHealth = {
  status: 'unknown',
  message: '尚未检测',
};

const SETTINGS_SAVE_DEBOUNCE_MS = 500;

export function useSettingsDialogState({ open, onClearLocalData }: UseSettingsDialogStateOptions) {
  const { setTheme } = useTheme();
  const asyncRunId = useRef(0);
  const settingsSaveRunId = useRef(0);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const pendingSettingsRef = useRef<AppSettings | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>(initialProviderHealth);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;

    clearPendingSettingsSave();

    void appSettingsRepository
      .getSettings()
      .then((savedSettings) => {
        if (isMounted) {
          latestSettingsRef.current = savedSettings;
          pendingSettingsRef.current = null;
          setSettings(savedSettings);
          setTheme(savedSettings.theme);
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
  }, [open, setTheme]);

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
      setTheme(savedSettings.theme);
      void reminderService.reschedule(savedSettings);
      void syncWindowBehaviorSettings(savedSettings);

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

  function flushPendingSettingsSave() {
    const pendingSettings = pendingSettingsRef.current;

    if (!pendingSettings) {
      return;
    }

    clearPendingSettingsSave();
    void persistSettings(pendingSettings);
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const nextSettings = { ...latestSettingsRef.current, ...patch };

    settingsSaveRunId.current += 1;
    latestSettingsRef.current = nextSettings;
    setSettings(nextSettings);

    if (patch.theme) {
      setTheme(nextSettings.theme);
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
    flushPendingSettingsSave();
    asyncRunId.current += 1;
    setActiveSection('ai');
    setIsClearConfirmOpen(false);
    setIsCheckingProvider(false);
    setIsSendingTestNotification(false);
    setProviderHealth(initialProviderHealth);
  }

  return {
    activeSection,
    checkProviderHealth,
    clearLocalData,
    providerHealth,
    isCheckingProvider,
    isClearConfirmOpen,
    isClearingData,
    isLoadingSettings,
    isSendingTestNotification,
    setActiveSection,
    setIsClearConfirmOpen,
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
