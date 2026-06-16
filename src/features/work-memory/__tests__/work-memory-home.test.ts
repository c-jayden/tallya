import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkMemoryHome selected date wiring', () => {
  it('initializes selectedDate from today and passes it into the entries controller', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('const [selectedDate, setSelectedDate] = useState(todayDate)');
    expect(source).toContain('useEntriesController({');
    expect(source).toContain('currentDate: selectedDate,');
    expect(source).toContain('maxDate={todayDate}');
  });

  it('records through the entry composer and feed instead of an AI-gated form', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('<EntryComposer');
    expect(source).toContain('<EntryFeed');
    expect(source).not.toContain('MemoryEntryForm');
    expect(source).not.toContain('aiService');
  });

  it('mounts the report flow now that reports run on the entry model', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('useWeeklyReportFlow');
    expect(source).toContain('<ReportGenerateDialog');
    expect(source).toContain('onReportsClick');
  });

  it('wires foreground-aware AI task handling into explicit AI flows and tray events', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('useAiTaskCoordinator');
    expect(source).toContain('const aiTasks = useAiTaskCoordinator()');
    expect(source).toContain('useWeeklyReportFlow({ aiTaskCoordinator: aiTasks })');
    expect(source).toContain('useDailyReportFlow({ aiTaskCoordinator: aiTasks })');
    expect(source).toContain('aiTaskCoordinator={aiTasks}');
    expect(source).toContain('onWindowHidden: aiTasks.handleWindowHidden');
    expect(source).toContain('onCloseBlocked: () => setCloseBlockedRequestId((current) => current + 1)');
  });

  it('does not render dialog-scoped AI status on the home surface', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('<WorkMemoryAlerts');
    expect(source).toContain('aiAlert={dailyReport.aiAlert}');
    expect(source).toContain('onDismissAlert={dailyReport.dismissAiAlert}');
  });

  it('routes native close blocks into the active AI dialog close flow', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('const [closeBlockedRequestId, setCloseBlockedRequestId]');
    expect(source).toContain('closeRequestId={closeBlockedRequestId}');
    expect(source).toContain('onAfterForceClose={() => void quitApp()}');
    expect(source).not.toContain('<AiCloseBlockedDialog');
  });
});
