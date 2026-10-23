/**
 * Chart colors. Neutral series use the logo's hues; anything that means a status keeps the
 * status colors (emerald = done, amber = attention, rose = overdue, sky = HR). See DESIGN.md.
 * Hex values (not CSS vars) because SVG charts and the PDF/canvas exports need literal colors.
 */
export const CHART_COLORS = {
  /** Logo steel blue: the default single-series color. */
  primary: '#4a86b4',
  primaryHover: '#3b6d94',
  /** Logo indigo, lifted one step so bars stay visible on dark surfaces. */
  secondary: '#5d62bd',
  /** HR-owned steps (sky), matching the HR status color. */
  hr: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  muted: '#94a3b8',
} as const;

/** One mapping for the four rating bands, used by every chart and card that shows them. */
export const RATING_BAND_COLORS = {
  OUTSTANDING: CHART_COLORS.success,
  EXCEEDS_EXPECTATIONS: CHART_COLORS.secondary,
  MEETS_EXPECTATIONS: CHART_COLORS.primary,
  NEEDS_IMPROVEMENT: CHART_COLORS.warning,
} as const;
