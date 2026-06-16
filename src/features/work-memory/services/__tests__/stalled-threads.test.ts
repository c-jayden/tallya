import { describe, expect, it } from 'vitest';
import type { ThreadSummary } from '../../types';
import { selectStalledThreadGaps, selectStalledThreads } from '../stalled-threads';

const REFERENCE_DATE = '2026-06-15';

function buildSummary(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: 'thread_1',
    title: '支付重构',
    status: 'open',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
    entryCount: 3,
    firstOccurredOn: '2026-06-08',
    lastOccurredOn: '2026-06-11',
    lastEntryId: 'e_last',
    ...overrides,
  };
}

describe('selectStalledThreadGaps', () => {
  it('flags a thread with momentum that has been quiet within the window', () => {
    const gaps = selectStalledThreadGaps([buildSummary()], REFERENCE_DATE);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ entryId: 'e_last', threadTitle: '支付重构' });
    // 2026-06-11 -> 2026-06-15 is 4 calendar days.
    expect(gaps[0].question).toContain('4 天');
    expect(gaps[0].question).toContain('《支付重构》');
  });

  it('ignores one-off notes without cross-day momentum', () => {
    const oneOff = buildSummary({
      entryCount: 1,
      firstOccurredOn: '2026-06-11',
      lastOccurredOn: '2026-06-11',
    });

    expect(selectStalledThreadGaps([oneOff], REFERENCE_DATE)).toEqual([]);
  });

  it('ignores a multi-entry thread that all happened on one day', () => {
    const sameDay = buildSummary({
      entryCount: 3,
      firstOccurredOn: '2026-06-11',
      lastOccurredOn: '2026-06-11',
    });

    expect(selectStalledThreadGaps([sameDay], REFERENCE_DATE)).toEqual([]);
  });

  it('ignores threads still active within the silence lower bound', () => {
    // Last entry 2 days ago — not yet "停了".
    const recent = buildSummary({ lastOccurredOn: '2026-06-13' });

    expect(selectStalledThreadGaps([recent], REFERENCE_DATE)).toEqual([]);
  });

  it('ignores threads dormant past the silence upper bound', () => {
    // Last entry 20 days ago — treated as dropped, not stalled.
    const dormant = buildSummary({
      firstOccurredOn: '2026-05-20',
      lastOccurredOn: '2026-05-26',
    });

    expect(selectStalledThreadGaps([dormant], REFERENCE_DATE)).toEqual([]);
  });

  it('includes the boundary days of the silence window', () => {
    const atLowerBound = buildSummary({ id: 't_low', lastOccurredOn: '2026-06-12', lastEntryId: 'low' });
    const atUpperBound = buildSummary({ id: 't_high', lastOccurredOn: '2026-06-01', lastEntryId: 'high' });

    const gaps = selectStalledThreadGaps([atLowerBound, atUpperBound], REFERENCE_DATE);

    expect(gaps.map((gap) => gap.entryId)).toEqual(['low', 'high']);
  });

  it('respects custom thresholds', () => {
    const summary = buildSummary({ lastOccurredOn: '2026-06-13' });

    const gaps = selectStalledThreadGaps([summary], REFERENCE_DATE, {
      minEntryCount: 2,
      minSilentDays: 2,
      maxSilentDays: 30,
    });

    expect(gaps).toHaveLength(1);
  });
});

describe('selectStalledThreads', () => {
  it('returns the qualifying summaries with their silent-day count', () => {
    const stalled = selectStalledThreads([buildSummary({ id: 'thread_pay' })], REFERENCE_DATE);

    expect(stalled).toEqual([
      { summary: expect.objectContaining({ id: 'thread_pay' }), silentDays: 4 },
    ]);
  });

  it('drops threads outside the stalled window', () => {
    const recent = buildSummary({ id: 'recent', lastOccurredOn: '2026-06-14' });
    const dormant = buildSummary({
      id: 'dormant',
      firstOccurredOn: '2026-05-10',
      lastOccurredOn: '2026-05-20',
    });

    expect(selectStalledThreads([recent, dormant], REFERENCE_DATE)).toEqual([]);
  });
});
