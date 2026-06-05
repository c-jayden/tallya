import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { AppSettings } from '../../services/app-settings-repository';
import type { ReportFocus, ReportLength, ReportTone } from '../../types';
import {
  reportFocusOptions,
  reportLengthOptions,
  reportToneOptions,
} from './settings-types';

type ReportPreferencesSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function ReportPreferencesSettingsSection({
  settings,
  onUpdateSettings,
}: ReportPreferencesSettingsSectionProps) {
  return (
    <section className="space-y-5" aria-label="报告偏好">
      <ReportPreferenceRow
        label="报告详略"
        description="控制报告的内容长度和展开程度。"
        options={reportLengthOptions}
        value={settings.reportLength}
        onChange={(reportLength) => onUpdateSettings({ reportLength })}
      />
      <Separator />
      <ReportPreferenceRow
        label="报告语气"
        description="控制报告表达方式。"
        options={reportToneOptions}
        value={settings.reportTone}
        onChange={(reportTone) => onUpdateSettings({ reportTone })}
      />
      <Separator />
      <ReportPreferenceRow
        label="报告重点"
        description="控制 AI 整理报告时优先突出的内容。"
        options={reportFocusOptions}
        value={settings.reportFocus}
        onChange={(reportFocus) => onUpdateSettings({ reportFocus })}
      />
    </section>
  );
}

function ReportPreferenceRow<T extends ReportLength | ReportTone | ReportFocus>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-app-ink-muted">{label}</span>
        <div className="inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
          {options.map((option) => {
            const isActive = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'h-8 cursor-pointer rounded-lg bg-transparent px-3 text-sm text-app-ink-muted transition-colors hover:text-app-ink focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed',
                  isActive &&
                    'bg-white font-semibold text-app-ink shadow-[0_1px_1px_rgb(15_23_42/0.04)] dark:bg-app-surface dark:text-app-ink',
                )}
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[13px] leading-5 text-app-ink-subtle">{description}</p>
    </div>
  );
}
