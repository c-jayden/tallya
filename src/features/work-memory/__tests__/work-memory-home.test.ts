import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkMemoryHome selected date wiring', () => {
  it('initializes selectedDate from today and passes it into the memory controller', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('const [selectedDate, setSelectedDate] = useState(todayDate)');
    expect(source).toContain('useWorkMemoryController({ currentDate: selectedDate, todayDate })');
    expect(source).toContain('maxDate={todayDate}');
  });

  it('does not expose a separate backfill memory entry point', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('补记忆');
  });

  it('uses gentle referenced-memory update confirmation copy', () => {
    const source = readFileSync(new URL('../work-memory-home.tsx', import.meta.url), 'utf8');

    expect(source).toContain('这天的记忆已被报告引用');
    expect(source).toContain('更新后，相关报告可能需要重新生成。');
    expect(source).toContain('继续更新');
  });
});
