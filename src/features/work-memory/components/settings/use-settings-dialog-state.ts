import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { aiService } from '../../services/ai/ai-service';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../../services/app-settings-repository';
import { getDailyMemoryDate } from '../../services/daily-memory-repository';
import { reminderService } from '../../services/reminder-service';
import {
  testMemoryInput,
  type ProviderHealth,
  type SettingsSection,
  type TestResult,
} from './settings-types';

type UseSettingsDialogStateOptions = {
  open: boolean;
  onClearLocalData: () => Promise<void>;
};

const initialProviderHealth: ProviderHealth = {
  status: 'unknown',
  message: '尚未检测',
};

const initialTestResult: TestResult = { type: 'idle' };
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
  const [isTestingCodex, setIsTestingCodex] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>(initialProviderHealth);
  const [testResult, setTestResult] = useState<TestResult>(initialTestResult);

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

    scheduleSettingsSave(nextSettings);
  }

  async function checkProviderHealth() {
    const runId = ++asyncRunId.current;

    setIsCheckingProvider(true);
    setProviderHealth({ status: 'checking', message: '正在检测连接...' });

    try {
      await persistSettings(normalizeCodexCommand(latestSettingsRef.current));
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

  async function testGenerate() {
    const runId = ++asyncRunId.current;

    setIsTestingCodex(true);
    setTestResult(initialTestResult);

    try {
      await persistSettings(normalizeCodexCommand(latestSettingsRef.current));
      const generated = await aiService.generateDailyMemory({
        date: getDailyMemoryDate(),
        rawContent: testMemoryInput,
        supplements: {},
      });
      if (runId === asyncRunId.current) {
        setTestResult({ type: 'success', summary: generated.summary });
      }
    } catch (error) {
      if (runId === asyncRunId.current) {
        setTestResult({ type: 'error', message: getTestGenerateError(error) });
      }
    } finally {
      if (runId === asyncRunId.current) {
        setIsTestingCodex(false);
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
    setIsTestingCodex(false);
    setProviderHealth(initialProviderHealth);
    setTestResult(initialTestResult);
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
    isTestingCodex,
    setActiveSection,
    setIsClearConfirmOpen,
    settings,
    sendTestNotification,
    testGenerate,
    testResult,
    updateSettings,
    resetTransientState,
  };
}

function normalizeCodexCommand(settings: AppSettings) {
  return {
    ...settings,
    codexCommand: settings.codexCommand.trim() || DEFAULT_APP_SETTINGS.codexCommand,
  };
}

function getTestGenerateError(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : '测试生成失败，请检查当前 AI 服务配置。';
}
