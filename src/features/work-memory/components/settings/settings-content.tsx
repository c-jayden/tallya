import { Loader2 } from 'lucide-react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import type { AppSettings } from '../../services/app-settings-repository';
import { AboutSettingsSection } from './about-settings-section';
import { AISettingsSection } from './ai-settings-section';
import { AppSettingsSection } from './app-settings-section';
import { DataSettingsSection } from './data-settings-section';
import { KeyboardShortcutsSettingsSection } from './keyboard-shortcuts-settings-section';
import { NotificationSettingsSection } from './notification-settings-section';
import { ReportPreferencesSettingsSection } from './report-preferences-settings-section';
import type { ProviderHealth, SettingsSection } from './settings-types';

export type SettingsContentProps = {
  activeSection: SettingsSection;
  settings: AppSettings;
  isLoadingSettings: boolean;
  providerHealth: ProviderHealth;
  isCheckingProvider: boolean;
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  isOpeningDataDirectory: boolean;
  isOpeningLogDirectory: boolean;
  isExportingDiagnosticLog: boolean;
  isExtractingReportStyle: boolean;
  isSendingTestNotification: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onCheckHealth: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenDataDirectory: () => void;
  onOpenLogDirectory: () => void;
  onRequestExportDiagnosticLog: () => void;
  onExtractReportStylePrompt: (sampleText: string) => Promise<string>;
  onSendTestNotification: () => void;
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
  isCheckingProvider,
  isExportingBackup,
  isImportingBackup,
  isOpeningDataDirectory,
  isOpeningLogDirectory,
  isExportingDiagnosticLog,
  isExtractingReportStyle,
  isSendingTestNotification,
  onUpdateSettings,
  onCheckHealth,
  onExportBackup,
  onImportBackup,
  onOpenDataDirectory,
  onOpenLogDirectory,
  onRequestExportDiagnosticLog,
  onExtractReportStylePrompt,
  onSendTestNotification,
  onRequestClear,
}: SettingsContentProps) {
  if (activeSection === 'ai') {
    return (
      <AISettingsSection
        settings={settings}
        providerHealth={providerHealth}
        isCheckingProvider={isCheckingProvider}
        onUpdateSettings={onUpdateSettings}
        onCheckHealth={onCheckHealth}
      />
    );
  }

  if (activeSection === 'notifications') {
    return (
      <NotificationSettingsSection
        settings={settings}
        isSendingTestNotification={isSendingTestNotification}
        onUpdateSettings={onUpdateSettings}
        onSendTestNotification={onSendTestNotification}
      />
    );
  }

  if (activeSection === 'reports') {
    return (
      <ReportPreferencesSettingsSection
        settings={settings}
        isExtractingReportStyle={isExtractingReportStyle}
        onUpdateSettings={onUpdateSettings}
        onExtractReportStylePrompt={onExtractReportStylePrompt}
      />
    );
  }

  if (activeSection === 'app') {
    return <AppSettingsSection settings={settings} onUpdateSettings={onUpdateSettings} />;
  }

  if (activeSection === 'shortcuts') {
    return <KeyboardShortcutsSettingsSection />;
  }

  if (activeSection === 'data') {
    return (
      <DataSettingsSection
        settings={settings}
        isExportingBackup={isExportingBackup}
        isImportingBackup={isImportingBackup}
        isOpeningDataDirectory={isOpeningDataDirectory}
        isOpeningLogDirectory={isOpeningLogDirectory}
        isExportingDiagnosticLog={isExportingDiagnosticLog}
        onExportBackup={onExportBackup}
        onImportBackup={onImportBackup}
        onOpenDataDirectory={onOpenDataDirectory}
        onOpenLogDirectory={onOpenLogDirectory}
        onRequestExportDiagnosticLog={onRequestExportDiagnosticLog}
        onUpdateSettings={onUpdateSettings}
        onRequestClear={onRequestClear}
      />
    );
  }

  return <AboutSettingsSection />;
}
