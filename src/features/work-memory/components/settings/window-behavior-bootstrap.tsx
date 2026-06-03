import { useEffect } from 'react';
import { appSettingsRepository } from '../../services/app-settings-repository';
import { applyStartupWindowBehavior } from '../../services/window-service';

export function WindowBehaviorBootstrap() {
  useEffect(() => {
    let isMounted = true;

    void appSettingsRepository.getSettings().then((settings) => {
      if (isMounted) {
        void applyStartupWindowBehavior(settings);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
