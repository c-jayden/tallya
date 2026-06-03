import { useEffect } from 'react';
import { reminderService } from '../../services/reminder-service';

export function ReminderBootstrap() {
  useEffect(() => {
    void reminderService.init();

    return () => {
      reminderService.dispose();
    };
  }, []);

  return null;
}
