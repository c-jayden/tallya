import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { initialMergeNudgeState, planMergeNudge } from '../services/merge-nudge';
import { sendMergeNudgeNotification, setMergeBadgeCount } from '../services/window-service';

// How long the window must sit idle (no pointer/keyboard) before an in-app nudge
// is allowed to surface — long enough that it never interrupts active work.
export const MERGE_NUDGE_IDLE_MS = 10_000;

const TOAST_ID = 'merge-nudge';

type UseMergeNudgeOptions = {
  pendingMergeCount: number;
  // The single "主动提醒待归并" setting; when off this hook is fully inert and the
  // OS badge is cleared. Phase-1 affordances (dot / in-hub count) are unaffected.
  enabled: boolean;
  // True while any overlay (search / threads / settings / report dialog) is open,
  // so the idle popup never lands on top of something the user is already doing.
  suppressPopup: boolean;
  onOpenHub: () => void;
};

function buildMergeNudgeBody(count: number) {
  return `有 ${count} 条记录可能属于同一条线索，回来归并一下？`;
}

// Phase-2 active nudge for un-merged thread suggestions, all gated behind one
// opt-in setting and all driven by the same "new high only" rule (see
// planMergeNudge): a quiet in-app toast when the foreground window goes idle, a
// single system notification when the backlog grows while backgrounded, and the
// OS app badge mirroring the count.
export function useMergeNudge({
  pendingMergeCount,
  enabled,
  suppressPopup,
  onOpenHub,
}: UseMergeNudgeOptions) {
  // Per-channel "last nudged at" state lives in refs: it is session-only memory
  // that gates firing, not something that should drive a re-render.
  const popupStateRef = useRef(initialMergeNudgeState);
  const notifyStateRef = useRef(initialMergeNudgeState);
  const onOpenHubRef = useRef(onOpenHub);

  useEffect(() => {
    onOpenHubRef.current = onOpenHub;
  }, [onOpenHub]);

  // OS app badge mirrors the backlog (cleared when the feature is off).
  useEffect(() => {
    void setMergeBadgeCount(enabled ? pendingMergeCount : 0);
  }, [enabled, pendingMergeCount]);

  // Turning the feature off re-arms both channels so re-enabling later starts
  // clean rather than staying silent against a stale high-water mark.
  useEffect(() => {
    if (!enabled) {
      popupStateRef.current = initialMergeNudgeState;
      notifyStateRef.current = initialMergeNudgeState;
    }
  }, [enabled]);

  // In-app popup: only after the foreground window has been idle a while, never
  // while an overlay is open, and at most once per new backlog high.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timer: number | null = null;

    const tryPopup = () => {
      if (
        document.visibilityState !== 'visible' ||
        suppressPopup ||
        pendingMergeCount <= 0
      ) {
        return;
      }

      const plan = planMergeNudge(pendingMergeCount, popupStateRef.current);
      popupStateRef.current = plan.nextState;

      if (plan.shouldFire) {
        toast(`有 ${pendingMergeCount} 条记录可能是同一件事`, {
          id: TOAST_ID,
          description: '看看要不要归并到一条线索？',
          action: { label: '查看', onClick: () => onOpenHubRef.current() },
        });
      }
    };

    const arm = () => {
      if (timer) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(tryPopup, MERGE_NUDGE_IDLE_MS);
    };

    // Any pointer/keyboard activity restarts the idle countdown.
    window.addEventListener('mousemove', arm);
    window.addEventListener('keydown', arm);
    window.addEventListener('focus', arm);
    arm();

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }

      window.removeEventListener('mousemove', arm);
      window.removeEventListener('keydown', arm);
      window.removeEventListener('focus', arm);
    };
  }, [enabled, suppressPopup, pendingMergeCount]);

  // Background system notification: fires when the backlog grows while the window
  // is hidden (e.g. a slow thread-link suggestion lands after the user switched
  // away), once per new high. Clicking it brings the app forward (handled natively).
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tryNotify = () => {
      if (document.visibilityState !== 'hidden' || pendingMergeCount <= 0) {
        return;
      }

      const plan = planMergeNudge(pendingMergeCount, notifyStateRef.current);
      notifyStateRef.current = plan.nextState;

      if (plan.shouldFire) {
        void sendMergeNudgeNotification(buildMergeNudgeBody(pendingMergeCount));
      }
    };

    // Run once for the case where the count changed while already hidden, then on
    // each visibility flip.
    tryNotify();
    document.addEventListener('visibilitychange', tryNotify);

    return () => {
      document.removeEventListener('visibilitychange', tryNotify);
    };
  }, [enabled, pendingMergeCount]);
}
