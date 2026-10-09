import React from 'react';

interface PageLoadingProgressProps {
  active: boolean;
}

/**
 * Top-of-viewport loading indicator for view navigation. Driven by React's real transition-
 * pending state (see useUrlHashView) rather than a fixed-duration timer simulation — it shows
 * exactly as long as a lazy-loaded view actually takes to become ready, no more, no less.
 * Purely CSS-driven (a single looping transform animation) and unmounts entirely when
 * inactive, so it costs nothing outside that window.
 */
export const PageLoadingProgress: React.FC<PageLoadingProgressProps> = ({ active }) => {
  if (!active) return null;

  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 z-[9999] h-[2px] overflow-hidden pointer-events-none">
      <div className="h-full w-1/3 bg-indigo-600 dark:bg-indigo-400 animate-page-loading-slide" />
    </div>
  );
};
