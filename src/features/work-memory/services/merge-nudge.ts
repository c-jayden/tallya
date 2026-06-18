// Pure decision for the phase-2 active merge nudge. A channel (in-app popup or
// background notification) fires at most once per "new high" of the pending
// backlog: it speaks up only when the count grows past the value it last nudged
// at, stays silent while the backlog is steady or shrinking, and re-arms once the
// backlog clears. This is the "一批只弹一次 / 不反复唠叨" rule — no completion
// tracking, just the count.

export type MergeNudgeState = {
  // The pending-merge count at which this channel last fired. 0 means re-armed.
  lastNudgedCount: number;
};

export const initialMergeNudgeState: MergeNudgeState = { lastNudgedCount: 0 };

export type MergeNudgePlan = {
  shouldFire: boolean;
  nextState: MergeNudgeState;
};

export function planMergeNudge(count: number, state: MergeNudgeState): MergeNudgePlan {
  // Backlog cleared: re-arm so the next arrival can nudge again.
  if (count <= 0) {
    return { shouldFire: false, nextState: initialMergeNudgeState };
  }

  // Only a new high warrants speaking up; a steady or shrinking backlog stays
  // quiet so the user is never nagged about decisions they've already seen.
  if (count > state.lastNudgedCount) {
    return { shouldFire: true, nextState: { lastNudgedCount: count } };
  }

  return { shouldFire: false, nextState: state };
}
