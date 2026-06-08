import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ReportStatusBadge', () => {
  it('uses a light stale style and shared status label', () => {
    const source = readFileSync(new URL('../report-status-badge.tsx', import.meta.url), 'utf8');

    expect(source).toContain("status === 'stale'");
    expect(source).toContain('getReportStatusLabel(status)');
    expect(source).toContain('bg-amber-50');
    expect(source).not.toContain('text-red');
  });
});
