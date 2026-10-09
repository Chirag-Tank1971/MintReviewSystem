import type { DashboardUrgency } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const RATING_BAND_LABELS: Record<string, string> = {
  OUTSTANDING: 'Outstanding',
  EXCEEDS_EXPECTATIONS: 'Exceeds expectations',
  MEETS_EXPECTATIONS: 'Meets expectations',
  NEEDS_IMPROVEMENT: 'Needs improvement',
};

export function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatMonthYear(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** Whole calendar days from today until the date (negative when it has passed). */
export function daysUntil(iso: string): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / DAY_MS);
}

export function dueLabel(urgency: DashboardUrgency, dueDate?: string): string | null {
  if (!dueDate || urgency === 'NO_DATE') return null;
  const days = daysUntil(dueDate);
  if (urgency === 'OVERDUE') return days < 0 ? `Overdue ${-days}d` : 'Overdue';
  if (days === 0) return 'Due today';
  if (urgency === 'DUE_SOON') return `Due in ${days}d`;
  return `Due ${formatShortDate(dueDate)}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
