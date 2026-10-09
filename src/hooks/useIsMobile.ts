import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 639px)';

/**
 * Tracks whether the viewport is at or below Tailwind's `sm` breakpoint (640px).
 * Used to force card-based layouts on mobile for views that offer a Cards/Table
 * toggle intended for desktop — a wide data table is unusable on a phone screen
 * regardless of which mode the user last picked.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = () => setIsMobile(mql.matches);
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
