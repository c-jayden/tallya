import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportGenerateDialog layout', () => {
  it('keeps the footer outside the scrollable body', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');
    const bodyIndex = source.indexOf('<TallyaScrollArea className="min-h-0 flex-1');
    const footerIndex = source.indexOf('<TallyaDialogFooter>');

    expect(bodyIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(bodyIndex);
    expect(source).not.toContain('DialogFooter className=');
  });

  it('keeps report type and date range above the scrollable body', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');
    const fixedFormIndex = source.indexOf('<div className="grid shrink-0 gap-3.5 px-6 pb-4">');
    const dateInputIndex = source.indexOf('<ReportDateInput');
    const bodyIndex = source.indexOf('<TallyaScrollArea className="min-h-0 flex-1');

    expect(fixedFormIndex).toBeGreaterThan(-1);
    expect(dateInputIndex).toBeGreaterThan(fixedFormIndex);
    expect(dateInputIndex).toBeLessThan(bodyIndex);
  });

  it('uses the shared shadcn date picker for custom report dates', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('DatePickerPopover');
    expect(source).toContain('CalendarDays');
    expect(source).not.toContain('type="date"');
  });

  it('keeps the report type selector lightweight without an extra label', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('>报告类型<');
    expect(source).toContain('label="本周周报"');
    expect(source).toContain('label="自定义范围"');
    expect(source).not.toContain('label="自定义范围报告"');
  });

  it('uses one time range label for custom report dates', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('ariaLabel="选择开始日期"');
    expect(source).toContain('ariaLabel="选择结束日期"');
    expect(source).toContain('>至</span>');
    expect(source).not.toContain('label="开始日期"');
    expect(source).not.toContain('label="结束日期"');
  });

  it('does not show a duplicate time range row for custom reports', () => {
    const source = readFileSync(new URL('./report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain("reportType === 'weekly' ? (");
    expect(source).toContain('label="时间范围"');
  });
});
