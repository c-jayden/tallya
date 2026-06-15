import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportPreferencesSettingsSection', () => {
  const sectionSource = readFileSync(
    new URL('../report-preferences-settings-section.tsx', import.meta.url),
    'utf8',
  );
  const dialogSource = readFileSync(
    new URL('../report-style-extract-dialog.tsx', import.meta.url),
    'utf8',
  );

  it('keeps label and description inside the same preference item', () => {
    expect(sectionSource).toContain('ReportPreferenceItem');
    expect(sectionSource).toContain('description');
    expect(sectionSource).toContain('控制整理时保留多少细节。');
    expect(sectionSource).not.toContain('<Separator');
  });

  it('shows one effective style field with a sample extraction action', () => {
    expect(sectionSource).toContain('风格偏好');
    expect(sectionSource).toContain('从样本提取');
    expect(sectionSource).toContain('reportStyleHint');
    expect(sectionSource).toContain('onExtractReportStylePrompt');
    expect(sectionSource).not.toContain('从历史日报分析风格');
    expect(sectionSource).not.toContain('分析风格');
    expect(sectionSource).not.toContain('已识别风格');
    expect(sectionSource).not.toContain('reportStyleSample');
  });

  it('moves sample text extraction into a dialog', () => {
    expect(dialogSource).toContain('从样本提取风格');
    expect(dialogSource).toContain('原文不会被保存');
    expect(dialogSource).toContain('先粘贴样本');
    expect(dialogSource).toContain('提取');
    expect(dialogSource).toContain('历史报告或工作总结');
    expect(dialogSource).not.toContain('日报或周报');
    expect(dialogSource).not.toContain('onUpdateSettings');
    expect(dialogSource).not.toContain('reportStyleProfile');
  });

  it('routes native app close requests through the extraction dialog close flow', () => {
    expect(sectionSource).toContain('closeRequestId?: number');
    expect(sectionSource).toContain('onAfterForceClose?: () => void');
    expect(sectionSource).toContain('closeRequestId={closeRequestId}');
    expect(dialogSource).toContain('closeRequestId?: number');
    expect(dialogSource).toContain('onAfterForceClose?: () => void');
    expect(dialogSource).toContain('requestClose(onAfterForceClose)');
    expect(dialogSource).toContain('<AiBusyCloseConfirmDialog');
  });
});
