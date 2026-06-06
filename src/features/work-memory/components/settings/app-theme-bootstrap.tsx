import { useEffect } from 'react';
import { appSettingsRepository } from '../../services/app-settings-repository';
import { applyAppTheme, getAppThemeRevision } from '../../services/app-theme';

export function AppThemeBootstrap() {
  useEffect(() => {
    let isMounted = true;
    const loadThemeRevision = getAppThemeRevision();

    void appSettingsRepository.getSettings().then((settings) => {
      if (isMounted && loadThemeRevision === getAppThemeRevision()) {
        applyAppTheme(settings.theme);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
