import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('NotificationSettingsSection copy', () => {
  const source = readFileSync(
    new URL('../notification-settings-section.tsx', import.meta.url),
    'utf8',
  );

  it('uses gentle reminder labels and descriptions', () => {
    expect(source).toContain('提醒我留下当天工作');
    expect(source).toContain('提醒我回顾一周');
    expect(source).toContain('提醒内容');
    expect(source).toContain('试发一条通知');
    expect(source).toContain('按设定时间轻轻提醒');
    expect(source).not.toContain('启用每日记录提醒');
    expect(source).not.toContain('启用周报提醒');
  });
});
