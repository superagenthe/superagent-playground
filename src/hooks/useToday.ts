import { useEffect, useState } from 'react';
import { msUntilNextMidnight, todayISO } from '../lib/date';

/** Local calendar date that refreshes at midnight and when returning to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      const next = todayISO();
      setToday((current) => (current === next ? current : next));
    };

    const scheduleMidnight = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, msUntilNextMidnight());
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        scheduleMidnight();
      }
    };

    const onFocus = () => refresh();

    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
    };
  }, []);

  return today;
}
