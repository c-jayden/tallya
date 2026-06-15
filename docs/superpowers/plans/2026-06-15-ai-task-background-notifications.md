# AI Task Background Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make user-initiated AI work survive close-to-tray behavior, notify only when Tallya is not foreground, and replace critical transient AI toasts with persistent in-app alerts.

**Architecture:** Add a small window-presence boundary around Tauri window state and system notifications, then add a focused AI task coordinator hook used by the daily/report/style flows. UI status is rendered through a business-level persistent alert component under `src/features/work-memory/components`, while ordinary short operation feedback stays on toast.

**Tech Stack:** Tauri v2 commands/events, React hooks, Vitest, TypeScript, existing Tallya Dialog and service boundaries.

---

### Task 1: Window Presence And Notification Boundary

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/features/work-memory/services/window-service.ts`
- Modify: `src/test/tauri-mocks.ts`
- Test: `src/features/work-memory/services/__tests__/window-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create tests that expect `getMainWindowState()` to call `get_main_window_state`, that `sendTallyaNotification()` calls `send_tallya_notification`, and that `isMainWindowForeground()` returns true only for visible, unminimized, focused windows.

- [ ] **Step 2: Run test to verify it fails**

Run: `.\node_modules\.bin\vitest run src\features\work-memory\services\__tests__\window-service.test.ts`
Expected: FAIL because the new functions do not exist.

- [ ] **Step 3: Write minimal implementation**

Add `get_main_window_state` in Rust returning `{ visible, minimized, focused }`. Add TypeScript wrappers:

```ts
export type MainWindowState = { visible: boolean; minimized: boolean; focused: boolean };
export async function getMainWindowState(): Promise<MainWindowState>;
export function isMainWindowForeground(state: MainWindowState): boolean;
export async function sendTallyaNotification(body: string): Promise<void>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\node_modules\.bin\vitest run src\features\work-memory\services\__tests__\window-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: track foreground window state`

### Task 2: AI Task Coordinator

**Files:**
- Create: `src/features/work-memory/hooks/use-ai-task-coordinator.ts`
- Test: `src/features/work-memory/hooks/__tests__/use-ai-task-coordinator.test.ts`

- [ ] **Step 1: Write the failing test**

Test that foreground completions do not notify, hidden completions do notify, `needs-input` sends a notification, and close requests either block or allow hide-to-tray based on `closeToTray`.

- [ ] **Step 2: Run test to verify it fails**

Run: `.\node_modules\.bin\vitest run src\features\work-memory\hooks\__tests__\use-ai-task-coordinator.test.ts`
Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Write minimal implementation**

Expose:

```ts
type AiTaskKind = 'daily-report' | 'range-report' | 'report-gaps' | 'style-extract';
type AiTaskStatus = 'running' | 'needs-input' | 'completed' | 'failed';
type AiTask = { id: string; kind: AiTaskKind; status: AiTaskStatus; message: string; openTarget?: string };
```

The hook owns `activeTask`, `alert`, `beginTask`, `updateTask`, `finishTask`, `failTask`, `markNeedsInput`, `handleWindowHidden`, and `requestClose`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\node_modules\.bin\vitest run src\features\work-memory\hooks\__tests__\use-ai-task-coordinator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: coordinate active ai tasks`

### Task 3: Wire User-Initiated AI Flows

**Files:**
- Modify: `src/features/work-memory/hooks/use-daily-report-flow.ts`
- Modify: `src/features/work-memory/hooks/use-weekly-report-flow.ts`
- Modify: `src/features/work-memory/components/settings/use-settings-dialog-state.ts`
- Modify: `src/features/work-memory/work-memory-home.tsx`
- Modify: `src/features/work-memory/hooks/use-tray-window-events.ts`
- Test: existing flow tests plus new source-level tests where hook rendering would be too broad.

- [ ] **Step 1: Write the failing test**

Add tests that verify the daily/report/style flows accept coordinator callbacks and that `tray://window-hidden` calls the coordinator hidden handler.

- [ ] **Step 2: Run test to verify it fails**

Run relevant Vitest files for daily/report/settings/tray hooks.
Expected: FAIL because the callbacks are not wired.

- [ ] **Step 3: Write minimal implementation**

Inject coordinator methods from `work-memory-home.tsx`, call `beginTask` before explicit AI requests, call `finishTask` on completion, call `failTask` on errors, and call `markNeedsInput` when report gaps are found.

- [ ] **Step 4: Run test to verify it passes**

Run the same targeted tests.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: wire ai task notifications`

### Task 4: Persistent AI Alerts

**Files:**
- Create: `src/features/work-memory/components/work-memory-alerts.tsx`
- Test: `src/features/work-memory/components/__tests__/work-memory-alerts.test.tsx`
- Modify: `src/features/work-memory/work-memory-home.tsx`

- [ ] **Step 1: Write the failing test**

Test that the alert component renders a persistent critical AI message with a dismiss button and optional action.

- [ ] **Step 2: Run test to verify it fails**

Run: `.\node_modules\.bin\vitest run src\features\work-memory\components\__tests__\work-memory-alerts.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal implementation**

Render a quiet full-width alert inside the existing home content, using existing colors and a close button with `cursor-pointer`.

- [ ] **Step 4: Run test to verify it passes**

Run the same component test.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: show persistent ai task alerts`

### Task 5: Final Verification

**Files:**
- No production changes unless verification finds a defect.

- [ ] **Step 1: Run frontend tests**

Run: `.\node_modules\.bin\vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run type-check and lint**

Run: `.\node_modules\.bin\tsc --noEmit`
Run: `.\node_modules\.bin\eslint .`
Expected: both exit 0.

- [ ] **Step 3: Run Rust check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: exit 0.

- [ ] **Step 4: Commit any verification fixes**

Only commit if a real fix was needed. Use a short conventional message.
