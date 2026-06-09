import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MemoryListDialog detail actions', () => {
  it('keeps daily report copy and edit actions available in list detail mode', () => {
    const source = readFileSync(new URL('../memory-list-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('复制日报');
    expect(source).toContain('编辑原始记录');
    expect(source).toContain('onCopyDailyReport(selectedMemory)');
    expect(source).not.toContain('isTodayMemory && selectedMemory');
  });

  it('explains referenced or locked memories instead of hiding edit silently', () => {
    const source = readFileSync(new URL('../memory-list-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('这条记忆已被报告引用，修改后相关报告可能需要重新生成。');
    expect(source).toContain('这条记忆已被报告引用，暂不支持直接编辑。');
    expect(source).toContain('这条记忆已锁定，暂不支持直接编辑。');
  });
});
