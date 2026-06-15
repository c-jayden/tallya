# Testing

Tallya uses layered tests. Keep tests close to the feature module they cover, and avoid touching the real desktop runtime from unit tests.

## Layers

1. Vitest logic tests cover date helpers, view models, report text formatting, backup validation, service orchestration, and repository behavior.
2. React component tests cover important dialog and panel structure. The current baseline uses React element structure tests; React Testing Library with jsdom should be added once dependency installation is stable.
3. Tauri API mock tests cover frontend calls to IPC, events, file dialogs, filesystem, notifications, opener, window commands, and SQLite loading.
4. Rust tests run with `cargo test --manifest-path src-tauri/Cargo.toml` and cover pure command helpers without launching Codex or sending system notifications.
5. Tauri WebDriver / WebDriverIO E2E is reserved for later desktop smoke tests.
6. Manual packaged-app checks remain necessary before release.

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm check:release
```

Use Node 22 to run the suite. `src/test/setup.ts` configures `navigator`, which only exists as a global on Node 21+; on Node 20 every test fails at setup. CI also runs on Node 22 — with `fnm`, run `fnm use 22` first.

Do not run `pnpm tauri dev` as part of automated verification.

## Frontend Tauri Mocks

Frontend tests load `src/test/setup.ts`, which registers `src/test/tauri-mocks.ts`.

The mock layer replaces:

- `@tauri-apps/api/core` `invoke`
- `@tauri-apps/api/event` `listen` / `emit`
- `@tauri-apps/api/path` `appDataDir`
- `@tauri-apps/api/window` current window actions
- `@tauri-apps/plugin-dialog` `open` / `save`
- `@tauri-apps/plugin-fs` `readTextFile` / `writeTextFile`
- `@tauri-apps/plugin-notification`
- `@tauri-apps/plugin-opener`
- `@tauri-apps/plugin-sql`
- `navigator.clipboard.writeText`

Tests must not call real Rust commands, show real notifications, open real file dialogs, or write to the user's real filesystem.

## SQLite Isolation

Repository tests use isolated in-memory or fake database clients. They must not read or write the real `sqlite:tallya.db` in the Tauri app data directory.

When adding repository tests:

- Build a fresh test database/client per test or reset it in `beforeEach`.
- Avoid depending on user data.
- Keep SQL in repository tests and helpers, not in React component tests.

## AI Provider Tests

Unit tests must not invoke the real Codex CLI. Test Codex provider behavior by mocking Tauri `invoke` or Rust helper output.

Codex integration tests may be added later as ignored/manual tests only, because they depend on the user's local Codex installation and login state.

## Diagnostic Log Tests

Logger tests cover `sanitizeLogData`, diagnostic log file naming, app data `logs/` directory writes, old log pruning, export of recent logs, and detailed logging gating.

When adding diagnostics:

- Do not assert on real filesystem paths outside the mock app data directory.
- Verify API Key, Authorization header, Bearer token, and response previews are redacted.
- Verify `diagnosticLoggingEnabled=false` skips debug logs.
- Verify `diagnosticLoggingEnabled=true` can write debug logs without leaking sensitive fields.
- Treat user-cancelled file dialogs as neutral outcomes, not errors.

## E2E TODO

Later desktop smoke coverage can use Tauri WebDriver / WebDriverIO:

- Launch the packaged or dev desktop app.
- Verify the home screen appears.
- Open settings.
- Open Spotlight search.
- Enter a work note.
- Trigger AI generation with a mocked provider or controlled fixture.
- Verify the preview appears.

Do not block normal unit-test runs on E2E setup.
