import { describe, expect, it } from 'vitest';
import { getCurrentWeekRange } from './report-date';

describe('getCurrentWeekRange', () => {
  it('returns Monday to Sunday for a mid-week date', () => {
    expect(getCurrentWeekRange(new Date('2026-06-03T10:00:00'))).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    });
  });

  it('keeps Monday as the beginning of the current week', () => {
    expect(getCurrentWeekRange(new Date('2026-06-01T08:00:00'))).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    });
  });

  it('keeps Sunday as the end of the current week', () => {
    expect(getCurrentWeekRange(new Date('2026-06-07T22:00:00'))).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    });
  });
});
