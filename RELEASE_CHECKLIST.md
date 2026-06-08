# Release Checklist

## Build

- Install dependencies with `pnpm install`.
- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm test`.
- Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- Run `cargo check --manifest-path src-tauri/Cargo.toml`.
- Run `pnpm build`.
- Run `pnpm check:release`.
- Run `pnpm tauri build`.
- If local NSIS tooling is unavailable, run the GitHub Actions `Release` workflow and download the generated Windows installer artifact.

## GitHub Actions Release

- Update `package.json` version.
- Keep `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` versions aligned with `package.json`.
- Push the release commit to `main`.
- Run the GitHub Actions `Release` workflow manually, or push the matching `vX.Y.Z` tag.
- Confirm the workflow reads `package.json` version and uses `vX.Y.Z`.
- Confirm the workflow creates the tag if it was manually triggered and the tag did not already exist.
- Confirm the GitHub Release is created as a draft by default.
- Confirm the Windows NSIS installer is uploaded to the Release and workflow artifacts.
- Download the Windows installer.
- Run install and overwrite-install checks from this checklist.

## Install

- Install the Windows installer.
- Start Tallya for the first time.
- Check the window title and icon.
- Check the Windows taskbar icon.
- Check the tray icon and tooltip.
- Check the settings About version.

## Core Flow

- Create one work memory for today.
- Save a draft.
- Generate and save today's work memory.
- View memory details.
- Search memories.
- Generate a weekly report.
- Generate a custom range report.
- View saved reports.
- Copy plain text.
- Copy Markdown.
- Export a backup.
- Import a backup.

## Tray And Notification

- Close the window and confirm it hides to tray when the setting is enabled.
- Open the app from the tray menu.
- Open memory search from the tray menu.
- Send a test notification.
- Click a notification and confirm the app is shown and focused.

## SQLite Data

- Confirm SQLite data is stored in the Tauri app data directory.
- Confirm the installer does not contain `tallya.db`.
- Confirm migrations create or update missing schema only and do not clear existing tables.
- Confirm clearing data only happens from Settings > Data Management.
- Confirm backup import is the only restore path that overwrites local data.

## Upgrade / Overwrite Install

- Install an older version or the current version.
- Create memories and reports.
- Modify settings.
- Run the installer again over the existing installation.
- Open Tallya.
- Confirm memories still exist.
- Confirm reports still exist.
- Confirm settings are preserved.
- Confirm SQLite data was not cleared.
- Confirm tray behavior still works.
- Confirm test notification still works.
- Confirm Codex detection still works.
- Confirm memory search still works.

## Uninstall

- Uninstall the app.
- Record whether user data remains in the application data directory.
- The first release focuses on overwrite installs preserving data, not uninstall-time data deletion.

## Known Requirements

- AI generation currently depends on the user's local Codex CLI.
- Users should install and sign in to Codex CLI before using AI generation.

## Known TODO

- The first Windows installer targets Chinese users. Keep the installer language Chinese where Tauri/NSIS supports it without a custom template; full installer localization can be revisited later.
- Windows NSIS packaging requires `makensis` on the build machine. Local builds can install NSIS; release builds can use the GitHub Actions `Release` workflow.
- Full Tauri WebDriver / WebDriverIO E2E is not connected yet.
- If `pnpm check` or `pnpm check:release` prints `The system cannot find the path specified.` at the end on Windows while the underlying commands pass, keep tracking it as an environment/script follow-up.
