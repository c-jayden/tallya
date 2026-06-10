import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkMemoryHome selected date wiring', () => {
  it('initializes selectedDate from today and passes it into the entries controller', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('const [selectedDate, setSelectedDate] = useState(todayDate)');
    expect(source).toContain('useEntriesController({ currentDate: selectedDate, todayDate })');
    expect(source).toContain('maxDate={todayDate}');
  });

  it('records through the entry composer and feed instead of an AI-gated form', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('<EntryComposer');
    expect(source).toContain('<EntryFeed');
    expect(source).not.toContain('MemoryEntryForm');
    expect(source).not.toContain('aiService');
  });

  it('keeps report entry points out of the home surface during the entry-model transition', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('ReportGenerateDialog');
    expect(source).not.toContain('useWeeklyReportFlow');
  });
});
