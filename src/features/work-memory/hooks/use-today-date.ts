import { useEffect, useState } from 'react';
import { getEntryDate } from '../services/entry-repository';

// Tallya lives in the tray for days, so "today" must follow the wall clock
// instead of the date captured at module load. The date refreshes when the
// window regains focus/visibility and once a minute to catch the midnight
// rollover while the window stays open.
export function useTodayDate() {
  const [todayDate, setTodayDate] = useState(() => getEntryDate());

  useEffect(() => {
    const refresh = () => {
      setTodayDate((current) => {
        const next = getEntryDate();

        return next === current ? current : next;
      });
    };

    const intervalId = window.setInterval(refresh, 60_000);

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return todayDate;
}
