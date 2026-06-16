import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logger } from './logger/logger';

// Result of a manual update check. `update` is kept so the UI can trigger the
// download/install only after the user opts in.
export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; notes: string | null; update: Update };

export type UpdateService = {
  check(): Promise<UpdateCheckResult>;
  downloadAndInstall(update: Update): Promise<void>;
};

// Checks GitHub Releases for a newer signed build. Throws on transport/parse
// failures so the caller can show a friendly retry; "no update" resolves to
// up-to-date rather than throwing.
async function checkForUpdate(): Promise<UpdateCheckResult> {
  const update = await check();

  if (!update) {
    logger.info('app', 'updater.up_to_date', 'No update available');
    return { status: 'up-to-date' };
  }

  logger.info('app', 'updater.available', 'Update available', { version: update.version });

  return {
    status: 'available',
    version: update.version,
    notes: update.body ?? null,
    update,
  };
}

// Downloads + installs the update, then relaunches into the new version. On
// Windows the bundled installer runs (may prompt SmartScreen, since the
// installer itself is not OS-code-signed).
async function downloadAndInstallUpdate(update: Update): Promise<void> {
  logger.info('app', 'updater.install_started', 'Downloading update', { version: update.version });

  await update.downloadAndInstall();

  logger.info('app', 'updater.install_finished', 'Update installed, relaunching', {
    version: update.version,
  });

  await relaunch();
}

export const updateService: UpdateService = {
  check: checkForUpdate,
  downloadAndInstall: downloadAndInstallUpdate,
};
