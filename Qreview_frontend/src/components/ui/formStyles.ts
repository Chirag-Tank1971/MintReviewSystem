/** Shared form field styles, so labels and inputs look the same on every screen. */

export const LABEL_CLASS = 'block text-[13px] font-medium text-slate-800 dark:text-slate-200';

export const INPUT_CLASS =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 transition-colors disabled:opacity-60';

/** Compact select that sits in a row of page actions (same height as a small Button). */
export const SELECT_CLASS =
  'h-8 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 cursor-pointer disabled:opacity-50';

export const TEXTAREA_CLASS =
  'w-full text-xs leading-relaxed p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 dark:disabled:bg-slate-850 disabled:text-slate-500';
