import { useEffect, useState } from 'react';
import { appSettingsRepository } from '../services/app-settings-repository';
import { logger } from '../services/logger/logger';
import { updateService } from '../services/update-service';

// Silent, once-per-launch update check that drives the quiet dot on the settings
// gear. Reads the autoCheckUpdates setting directly (no reactive coupling), and
// fails silently — a missing release / offline state must never surface an error.
// The dot is a standing "there's an update" hint, so it is not cleared on open;
// installing relaunches into the new version, which clears it naturally.
export function useUpdateCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void appSettingsRepository
      .getSettings()
      .then((settings) => (settings.autoCheckUpdates ? updateService.check() : null))
      .then((result) => {
        if (isMounted && result && result.status === 'available') {
          setHasUpdate(true);
        }
      })
      .catch((error) => {
        logger.warn('app', 'updater.auto_check_failed', 'Auto update check failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { hasUpdate };
}
