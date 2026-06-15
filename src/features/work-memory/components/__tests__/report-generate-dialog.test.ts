import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportGenerateDialog layout', () => {
  it('keeps the footer outside the scrollable body', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');
    const bodyIndex = source.indexOf('<TallyaScrollArea className="min-h-0 flex-1');
    const footerIndex = source.indexOf('<TallyaDialogFooter');

    expect(bodyIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(bodyIndex);
  });

  it('keeps report type and date range above the scrollable body', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');
    const fixedFormIndex = source.indexOf('<div className="grid shrink-0 gap-3.5 px-6 pb-4">');
    const dateInputIndex = source.indexOf('<ReportDateInput');
    const bodyIndex = source.indexOf('<TallyaScrollArea className="min-h-0 flex-1');

    expect(fixedFormIndex).toBeGreaterThan(-1);
    expect(dateInputIndex).toBeGreaterThan(fixedFormIndex);
    expect(dateInputIndex).toBeLessThan(bodyIndex);
  });

  it('uses the shared shadcn date picker for custom report dates', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('DatePickerPopover');
    expect(source).toContain('CalendarDays');
    expect(source).not.toContain('type="date"');
  });

  it('keeps the report type selector lightweight without an extra label', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('>报告类型<');
    expect(source).toContain('label="本周回顾"');
    expect(source).toContain('label="自定义时间"');
    expect(source).not.toContain('label="本周周报"');
    expect(source).not.toContain('label="自定义范围报告"');
  });

  it('uses one time range label for custom report dates', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('ariaLabel="选择开始日期"');
    expect(source).toContain('ariaLabel="选择结束日期"');
    expect(source).toContain('>至</span>');
    expect(source).not.toContain('label="开始日期"');
    expect(source).not.toContain('label="结束日期"');
  });

  it('does not show a duplicate time range row for custom reports', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain("reportType === 'weekly' ? (");
    expect(source).toContain('label="时间范围"');
  });

  it('uses warmer整理 copy for generation and empty states', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('整理一段时间');
    expect(source).toContain('可整理内容');
    expect(source).toContain('记录较少，整理结果可能会短一些。');
    expect(source).toContain('这个时间范围里还没有可整理的记录。');
    expect(source).not.toContain('生成报告');
    expect(source).not.toContain('可用记忆');
  });

  it('separates exact-range overwrite from overlapping-range continuation', () => {
    const source = readFileSync(new URL('../report-generate-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain("type ConfirmMode = 'exact' | 'overlap'");
    expect(source).toContain('已有相同时间范围的整理');
    expect(source).toContain('覆盖原整理');
    expect(source).toContain('新增一份');
    expect(source).toContain('已有整理记录和这个时间范围重叠');
    expect(source).toContain('继续整理');
    expect(source).toContain("saveMode: 'create'");
    expect(source).toContain("saveMode: 'overwrite'");
  });
});

describe('ReportGapDialog layout', () => {
  const source = readFileSync(new URL('../report-gap-dialog.tsx', import.meta.url), 'utf8');

  it('shows a left-aligned back action before supplement submission', () => {
    expect(source).toContain('onBack: () => void');
    expect(source).toContain('sm:justify-between');
    expect(source).toContain('返回');
    expect(source).toContain('onClick={onBack}');
  });
});
