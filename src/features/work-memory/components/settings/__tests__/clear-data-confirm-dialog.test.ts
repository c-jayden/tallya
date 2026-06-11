import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ClearDataConfirmDialog', () => {
  const source = readFileSync(new URL('../clear-data-confirm-dialog.tsx', import.meta.url), 'utf8');

  it('requires typing the exact destructive confirmation text before clearing data', () => {
    expect(source).toContain("CLEAR_DATA_CONFIRM_TEXT = '清空本地数据'");
    expect(source).toContain('confirmText === CLEAR_DATA_CONFIRM_TEXT');
    expect(source).toContain('disabled={isClearingData || !canConfirm}');
  });

  it('explains that settings are kept when local data is cleared', () => {
    expect(source).toContain('应用设置会保留');
    expect(source).toContain('清理后无法恢复');
    expect(source).toContain('照着上面的文字输入一遍');
  });
});
