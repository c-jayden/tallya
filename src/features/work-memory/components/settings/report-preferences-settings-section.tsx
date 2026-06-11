import { useState } from 'react';
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
    <section className="space-y-6" aria-label="整理偏好">
      <div className="space-y-5">
        <ReportPreferenceItem
          label="整理详略"
          description="控制整理时保留多少细节。"
          options={reportLengthOptions}
          value={settings.reportLength}
          onChange={(reportLength) => onUpdateSettings({ reportLength })}
        />
        <ReportPreferenceItem
          label="表达语气"
          description="让整理结果更接近你平时的表达。"
          options={reportToneOptions}
          value={settings.reportTone}
          onChange={(reportTone) => onUpdateSettings({ reportTone })}
        />
        <ReportPreferenceItem
          label="优先突出"
          description="选择整理时先照顾哪类信息。"
          options={reportFocusOptions}
          value={settings.reportFocus}
          onChange={(reportFocus) => onUpdateSettings({ reportFocus })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-app-ink">风格偏好</div>
            <p className="text-[13px] leading-5 text-app-ink-subtle">
              写一点你喜欢的表达习惯。它只影响表达，不改变事实内容。
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
          placeholder="例如：用 3-5 条分点整理关键进展，最后轻轻带一下后续计划。"
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-app-ink">{label}</div>
        <p className="text-[13px] leading-5 text-app-ink-subtle">{description}</p>
      </div>
      <div className="inline-flex w-fit max-w-full shrink-0 flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-app-surface-muted">
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
