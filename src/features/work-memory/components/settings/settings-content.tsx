import { Loader2 } from 'lucide-react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import type { AppSettings } from '../../services/app-settings-repository';
import { AboutSettingsSection } from './about-settings-section';
import { AISettingsSection } from './ai-settings-section';
import { AppSettingsSection } from './app-settings-section';
import { DataSettingsSection } from './data-settings-section';
import { NotificationSettingsSection } from './notification-settings-section';
import type { ProviderHealth, SettingsSection, TestResult } from './settings-types';

export type SettingsContentProps = {
  activeSection: SettingsSection;
  settings: AppSettings;
  isLoadingSettings: boolean;
  providerHealth: ProviderHealth;
  testResult: TestResult;
  isCheckingProvider: boolean;
  isTestingCodex: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckHealth: () => void;
  onTestGenerate: () => void;
  onRequestClear: () => void;
};

export function SettingsContent(props: SettingsContentProps) {
  return (
    <TallyaScrollArea className="h-full min-h-0">
      <div className="space-y-6 px-8 py-6">
        {props.isLoadingSettings ? <SettingsLoading /> : <SettingsSectionContent {...props} />}
      </div>
    </TallyaScrollArea>
  );
}

function SettingsLoading() {
  return (
    <div className="flex h-36 items-center justify-center text-sm text-app-ink-subtle">
      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
      正在读取设置
    </div>
  );
}

function SettingsSectionContent({
  activeSection,
  settings,
  providerHealth,
  testResult,
  isCheckingProvider,
  isTestingCodex,
  onUpdateSettings,
  onCheckHealth,
  onTestGenerate,
  onRequestClear,
}: SettingsContentProps) {
  if (activeSection === 'ai') {
    return (
      <AISettingsSection
        providerHealth={providerHealth}
        testResult={testResult}
        isCheckingProvider={isCheckingProvider}
        isTestingCodex={isTestingCodex}
        onCheckHealth={onCheckHealth}
        onTestGenerate={onTestGenerate}
      />
    );
  }

  if (activeSection === 'notifications') {
    return <NotificationSettingsSection settings={settings} onUpdateSettings={onUpdateSettings} />;
  }

  if (activeSection === 'app') {
    return <AppSettingsSection settings={settings} onUpdateSettings={onUpdateSettings} />;
  }

  if (activeSection === 'data') {
    return <DataSettingsSection onRequestClear={onRequestClear} />;
  }

  return <AboutSettingsSection />;
}
