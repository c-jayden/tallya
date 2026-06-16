import { describe, expect, it } from 'vitest';
import { EMPTY_STALLED_REVIEW_STATE } from '../stalled-review-repository';
import { planStalledReviewNudge } from '../stalled-review';

describe('planStalledReviewNudge', () => {
  it('nudges newly stalled threads and stamps them with today', () => {
    const plan = planStalledReviewNudge(EMPTY_STALLED_REVIEW_STATE, ['t1', 't2'], '2026-06-15');

    expect(plan.hasFreshNudge).toBe(true);
    expect(plan.nextState).toEqual({
      lastCheckedDate: '2026-06-15',
      shownByThread: { t1: '2026-06-15', t2: '2026-06-15' },
    });
  });

  it('stays quiet for a thread nudged within the snooze window', () => {
    const plan = planStalledReviewNudge(
      { lastCheckedDate: '2026-06-13', shownByThread: { t1: '2026-06-13' } },
      ['t1'],
      '2026-06-15',
    );

    // 2 days since last nudge (< 3): still snoozed, keeps its earlier date.
    expect(plan.hasFreshNudge).toBe(false);
    expect(plan.nextState).toEqual({
      lastCheckedDate: '2026-06-15',
      shownByThread: { t1: '2026-06-13' },
    });
  });

  it('re-nudges once the snooze window has passed', () => {
    const plan = planStalledReviewNudge(
      { lastCheckedDate: '2026-06-12', shownByThread: { t1: '2026-06-12' } },
      ['t1'],
      '2026-06-15',
    );

    // 3 days since last nudge (>= 3): nudge again, stamp with today.
    expect(plan.hasFreshNudge).toBe(true);
    expect(plan.nextState.shownByThread).toEqual({ t1: '2026-06-15' });
  });

  it('drops threads that are no longer stalled', () => {
    const plan = planStalledReviewNudge(
      { lastCheckedDate: '2026-06-14', shownByThread: { t1: '2026-06-14', gone: '2026-06-10' } },
      ['t1'],
      '2026-06-15',
    );

    expect(plan.nextState.shownByThread).toEqual({ t1: '2026-06-14' });
    expect(plan.hasFreshNudge).toBe(false);
  });

  it('reports no nudge when nothing is stalled', () => {
    const plan = planStalledReviewNudge(EMPTY_STALLED_REVIEW_STATE, [], '2026-06-15');

    expect(plan).toEqual({
      nextState: { lastCheckedDate: '2026-06-15', shownByThread: {} },
      hasFreshNudge: false,
    });
  });
});
