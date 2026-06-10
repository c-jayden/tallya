import { useEffect } from 'react';
import { reminderService } from '../../services/reminder-service';

export function ReminderBootstrap() {
  useEffect(() => {
    void reminderService.init();

    // setTimeout is unreliable across system sleep / long tray hiding: the timer
    // can fire late or drift. Recompute the next slot whenever the window comes
    // back to the foreground so a missed/shifted reminder self-corrects.
    const handleResync = () => {
      if (document.visibilityState === 'visible') {
        void reminderService.reschedule();
      }
    };

    document.addEventListener('visibilitychange', handleResync);
    window.addEventListener('focus', handleResync);

    return () => {
      document.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('focus', handleResync);
      reminderService.dispose();
    };
  }, []);

  return null;
}
