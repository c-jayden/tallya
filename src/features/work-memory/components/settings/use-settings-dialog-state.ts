import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { aiService } from '../../services/ai/ai-service';
import {
  DEFAULT_APP_SETTINGS,
  appSettingsRepository,
  type AppSettings,
} from '../../services/app-settings-repository';
import { getDailyMemoryDate } from '../../services/daily-memory-repository';
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

export function useSettingsDialogState({ open, onClearLocalData }: UseSettingsDialogStateOptions) {
  const { setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [isTestingCodex, setIsTestingCodex] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>({
    status: 'unknown',
    message: '尚未检测',
  });
  const [testResult, setTestResult] = useState<TestResult>({ type: 'idle' });

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;

    void appSettingsRepository
      .getSettings()
      .then((savedSettings) => {
        if (isMounted) {
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

  async function saveSettings(nextSettings: AppSettings) {
    setSettings(nextSettings);

    try {
      const savedSettings = await appSettingsRepository.saveSettings(nextSettings);
      setSettings(savedSettings);
      setTheme(savedSettings.theme);

      return savedSettings;
    } catch {
      toast.error('设置保存失败，请稍后重试');

      return nextSettings;
    }
  }

  function updateSettings(patch: Partial<AppSettings>) {
    void saveSettings({ ...settings, ...patch });
  }

  async function checkProviderHealth() {
    setIsCheckingProvider(true);
    setProviderHealth({ status: 'checking', message: '正在检测连接...' });

    try {
      await saveSettings(normalizeCodexCommand(settings));
      const health = await aiService.checkHealth();

      setProviderHealth(health);
    } catch {
      setProviderHealth({
        status: 'unavailable',
        message: '检测失败',
        detail: '请检查当前 AI 服务配置。',
      });
    } finally {
      setIsCheckingProvider(false);
    }
  }

  async function testGenerate() {
    setIsTestingCodex(true);
    setTestResult({ type: 'idle' });

    try {
      await saveSettings(normalizeCodexCommand(settings));
      const generated = await aiService.generateDailyMemory({
        date: getDailyMemoryDate(),
        rawContent: testMemoryInput,
        supplements: {},
      });
      setTestResult({ type: 'success', summary: generated.summary });
    } catch (error) {
      setTestResult({ type: 'error', message: getTestGenerateError(error) });
    } finally {
      setIsTestingCodex(false);
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

  return {
    activeSection,
    checkProviderHealth,
    clearLocalData,
    providerHealth,
    isCheckingProvider,
    isClearConfirmOpen,
    isClearingData,
    isLoadingSettings,
    isTestingCodex,
    setActiveSection,
    setIsClearConfirmOpen,
    settings,
    testGenerate,
    testResult,
    updateSettings,
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
