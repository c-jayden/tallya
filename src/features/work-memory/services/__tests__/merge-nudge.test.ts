import { describe, expect, it } from 'vitest';
import { initialMergeNudgeState, planMergeNudge } from '../merge-nudge';

describe('planMergeNudge', () => {
  it('fires on the first pending backlog', () => {
    const plan = planMergeNudge(2, initialMergeNudgeState);

    expect(plan.shouldFire).toBe(true);
    expect(plan.nextState.lastNudgedCount).toBe(2);
  });

  it('stays quiet while the backlog is unchanged', () => {
    const plan = planMergeNudge(2, { lastNudgedCount: 2 });

    expect(plan.shouldFire).toBe(false);
    expect(plan.nextState.lastNudgedCount).toBe(2);
  });

  it('stays quiet while the backlog shrinks but is not cleared', () => {
    const plan = planMergeNudge(1, { lastNudgedCount: 3 });

    expect(plan.shouldFire).toBe(false);
    expect(plan.nextState.lastNudgedCount).toBe(3);
  });

  it('fires again when the backlog reaches a new high', () => {
    const plan = planMergeNudge(4, { lastNudgedCount: 3 });

    expect(plan.shouldFire).toBe(true);
    expect(plan.nextState.lastNudgedCount).toBe(4);
  });

  it('re-arms once the backlog clears', () => {
    const cleared = planMergeNudge(0, { lastNudgedCount: 3 });

    expect(cleared.shouldFire).toBe(false);
    expect(cleared.nextState.lastNudgedCount).toBe(0);

    // After clearing, a fresh arrival nudges again even at a lower count.
    const reArmed = planMergeNudge(1, cleared.nextState);

    expect(reArmed.shouldFire).toBe(true);
    expect(reArmed.nextState.lastNudgedCount).toBe(1);
  });

  it('treats negative counts as cleared', () => {
    const plan = planMergeNudge(-1, { lastNudgedCount: 2 });

    expect(plan.shouldFire).toBe(false);
    expect(plan.nextState.lastNudgedCount).toBe(0);
  });
});
