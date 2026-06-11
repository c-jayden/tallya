import { describe, expect, it } from 'vitest';
import {
  formatToolbarDate,
  getDailyMemoryHeroCopy,
  getDailyMemoryPreviewCopy,
  getDailyMemoryPrimaryActionLabel,
  getDailyMemorySaveSuccessToast,
  getDailyMemoryTextareaPlaceholder,
  isFutureMemoryDate,
  isTodayDate,
} from '../memory-date-view-model';

describe('memory date view model', () => {
  it('detects today and future dates from daily memory date strings', () => {
    expect(isTodayDate('2026-06-08', '2026-06-08')).toBe(true);
    expect(isTodayDate('2026-06-07', '2026-06-08')).toBe(false);
    expect(isFutureMemoryDate('2026-06-09', '2026-06-08')).toBe(true);
    expect(isFutureMemoryDate('2026-06-08', '2026-06-08')).toBe(false);
  });

  it('uses date-aware home title and description copy', () => {
    expect(getDailyMemoryHeroCopy('2026-06-08', '2026-06-08')).toEqual({
      title: '今天做了什么？',
      description: '随手记一条，之后随时能搜回来。',
    });
    expect(getDailyMemoryHeroCopy('2026-06-07', '2026-06-08')).toMatchObject({
      title: '昨天做了什么？',
      description: '补记这天做过的事，之后随时能搜回来。',
    });
    expect(getDailyMemoryHeroCopy('2026-06-06', '2026-06-08')).toMatchObject({
      title: '这一天做了什么？',
    });
  });

  it('uses date-aware placeholders and primary actions', () => {
    expect(getDailyMemoryTextareaPlaceholder(true)).toBe(
      '例如：上午推进需求讨论，下午整理方案并同步进展，明天继续跟进剩余问题。',
    );
    expect(getDailyMemoryTextareaPlaceholder(false)).toBe(
      '例如：整理需求内容，处理反馈，补充说明，并同步后续计划。',
    );
    expect(getDailyMemoryPrimaryActionLabel({ isToday: true, hasGeneratedMemory: false })).toBe(
      '整理成今日记录',
    );
    expect(getDailyMemoryPrimaryActionLabel({ isToday: true, hasGeneratedMemory: true })).toBe(
      '更新今日记录',
    );
    expect(getDailyMemoryPrimaryActionLabel({ isToday: false, hasGeneratedMemory: false })).toBe(
      '整理成这天记录',
    );
    expect(getDailyMemoryPrimaryActionLabel({ isToday: false, hasGeneratedMemory: true })).toBe(
      '更新这天记录',
    );
  });

  it('uses date-aware preview and save copy', () => {
    expect(getDailyMemoryPreviewCopy(true)).toEqual({
      title: '今日记忆预览',
      description: '确认后会沉淀为今天的工作记忆。',
    });
    expect(getDailyMemoryPreviewCopy(false)).toEqual({
      title: '这天记忆预览',
      description: '确认后会沉淀为这一天的工作记忆。',
    });
    expect(getDailyMemorySaveSuccessToast(true)).toBe('今日记忆已保存');
    expect(getDailyMemorySaveSuccessToast(false)).toBe('这天记忆已保存');
  });

  it('formats the toolbar date for the selected date', () => {
    expect(formatToolbarDate('2026-06-08')).toEqual({
      date: '2026年6月8日',
      weekday: '星期一',
      dateTime: '2026-06-08',
    });
  });
});
