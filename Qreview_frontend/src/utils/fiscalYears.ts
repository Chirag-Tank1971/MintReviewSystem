/** The current calendar year: the default for every year filter. */
export const CURRENT_YEAR = new Date().getFullYear();

/** Year filter options, newest first: the current year and the `yearsBack` before it. */
export function yearOptions(yearsBack = 3): number[] {
  return Array.from({ length: yearsBack + 1 }, (_, i) => CURRENT_YEAR - i);
}
