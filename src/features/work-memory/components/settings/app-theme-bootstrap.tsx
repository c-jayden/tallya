import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { appSettingsRepository } from '../../services/app-settings-repository';

export function AppThemeBootstrap() {
  const { setTheme } = useTheme();

  useEffect(() => {
    let isMounted = true;

    void appSettingsRepository.getSettings().then((settings) => {
      if (isMounted) {
        setTheme(settings.theme);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [setTheme]);

  return null;
}
