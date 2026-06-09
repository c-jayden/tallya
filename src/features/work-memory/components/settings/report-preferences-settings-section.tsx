import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppSettings } from '../../services/app-settings-repository';
import type { ReportFocus, ReportLength, ReportTone } from '../../types';
import { ReportStyleExtractDialog } from './report-style-extract-dialog';
import {
  reportFocusOptions,
  reportLengthOptions,
  reportToneOptions,
} from './settings-types';

type ReportPreferencesSettingsSectionProps = {
  settings: AppSettings;
  isExtractingReportStyle: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onExtractReportStylePrompt: (sampleText: string) => Promise<string>;
};

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function ReportPreferencesSettingsSection({
  settings,
  isExtractingReportStyle,
  onUpdateSettings,
  onExtractReportStylePrompt,
}: ReportPreferencesSettingsSectionProps) {
  const [isStyleExtractOpen, setIsStyleExtractOpen] = useState(false);

  return (
    <section className="space-y-7" aria-label="报告偏好">
      <PreferenceGroup title="基础偏好">
        <ReportPreferenceItem
          label="报告详略"
          description="决定报告是偏简洁，还是保留更多过程细节。"
          options={reportLengthOptions}
          value={settings.reportLength}
          onChange={(reportLength) => onUpdateSettings({ reportLength })}
        />
        <ReportPreferenceItem
          label="报告语气"
          description="控制报告的表达方式。"
          options={reportToneOptions}
          value={settings.reportTone}
          onChange={(reportTone) => onUpdateSettings({ reportTone })}
        />
        <ReportPreferenceItem
          label="报告重点"
          description="控制整理报告时优先突出的内容。"
          options={reportFocusOptions}
          value={settings.reportFocus}
          onChange={(reportFocus) => onUpdateSettings({ reportFocus })}
        />
      </PreferenceGroup>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-app-ink">风格偏好</div>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              描述你希望报告接近的表达方式。它只影响表达，不改变事实内容。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isExtractingReportStyle}
            className="w-fit cursor-pointer disabled:cursor-not-allowed"
            onClick={() => setIsStyleExtractOpen(true)}
          >
            从样本提取
          </Button>
        </div>
        <textarea
          value={settings.reportStyleHint}
          placeholder="例如：尽量简洁，用 3-5 条分点描述完成事项，最后用一句话说明后续计划。"
          className="min-h-28 w-full resize-none rounded-lg border border-app-border bg-white px-3 py-2 text-sm leading-5 text-app-ink placeholder:text-slate-400 focus:border-app-ink/30 focus:ring-2 focus:ring-app-ink/10 focus:outline-none"
          onChange={(event) => onUpdateSettings({ reportStyleHint: event.target.value })}
        />
      </div>

      <ReportStyleExtractDialog
        open={isStyleExtractOpen}
        isExtracting={isExtractingReportStyle}
        onOpenChange={setIsStyleExtractOpen}
        onExtractReportStylePrompt={onExtractReportStylePrompt}
        onApplyPromptHint={(reportStyleHint) => onUpdateSettings({ reportStyleHint })}
      />
    </section>
  );
}

function PreferenceGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-app-ink">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ReportPreferenceItem<T extends ReportLength | ReportTone | ReportFocus>({
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
    <div className="flex flex-col gap-3 rounded-lg bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-app-ink">{label}</div>
        <p className="text-[13px] leading-5 text-app-ink-subtle">{description}</p>
      </div>
      <div className="inline-flex w-fit shrink-0 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
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
  );
}
