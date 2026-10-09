import React from 'react';
import { m, springQuick } from '../../../animations';

export const RATING_RUBRIC = [
  { value: 1, label: 'Needs Improvement', desc: 'Consistently below expectations / targets not achieved' },
  { value: 2, label: 'Developing', desc: 'Partially meets expectations; inconsistent target achievement' },
  { value: 3, label: 'Meets Expectations', desc: 'Consistently achieves targets and meets key milestones' },
  { value: 4, label: 'Exceeds Expectations', desc: 'Exceeds targets with high quality, speed, and ownership' },
  { value: 5, label: 'Outstanding', desc: 'Significantly outperforms, sets benchmarks, and displays leadership' },
];

/** Each reviewer keeps one colour on every scale so their tag is recognisable at a glance. */
const MARKER_TONES = {
  employee: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200',
  manager: 'bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200',
};

export interface RatingMarker {
  label: string;
  value?: number;
  tone: keyof typeof MARKER_TONES;
}

interface RatingScaleProps {
  name: string;
  label: string;
  rating: number;
  /** Other people's ratings for the same KRA, marked under their segment for comparison. */
  markers?: RatingMarker[];
  disabled: boolean;
  onSelect: (value: number) => void;
}

/**
 * One connected 1–5 bar that fills up to the chosen score, with reference ratings (employee,
 * manager) marked underneath so any gap is visible at a glance. Behaves as a radio group:
 * arrow keys move the selection, Tab enters/leaves the group.
 */
export const RatingScale: React.FC<RatingScaleProps> = ({ name, label, rating, markers = [], disabled, onSelect }) => {
  const selected = RATING_RUBRIC.find((r) => r.value === rating);
  const labelId = `${name}-label`;

  // Two people on the same score share one split tag: [Employee | Manager] rated 3.
  const markerGroups = new Map<number, RatingMarker[]>();
  markers.forEach((m) => {
    const v = Number(m.value) || 0;
    if (v >= 1 && v <= 5) markerGroups.set(v, [...(markerGroups.get(v) || []), m]);
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, value: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, value + step));
    onSelect(next);
    const group = e.currentTarget.parentElement;
    (group?.querySelector(`[data-value="${next}"]`) as HTMLButtonElement | null)?.focus();
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </span>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-5 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden divide-x divide-slate-300 dark:divide-slate-700"
      >
        {RATING_RUBRIC.map((r) => {
          const isSelected = r.value === rating;
          const isFilled = rating > 0 && r.value < rating;
          const isTabStop = isSelected || (rating === 0 && r.value === 1);
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${r.value}, ${r.label}`}
              data-value={r.value}
              tabIndex={isTabStop ? 0 : -1}
              disabled={disabled}
              onClick={() => onSelect(r.value)}
              onKeyDown={(e) => handleKeyDown(e, r.value)}
              className={`relative flex flex-col items-center sm:items-start gap-0.5 px-2 sm:px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                isSelected
                  ? 'text-white'
                  : isFilled
                  ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200'
                  : 'bg-white text-slate-600 dark:bg-slate-900/40 dark:text-slate-300'
              } ${
                disabled
                  ? 'cursor-not-allowed'
                  : isSelected
                  ? 'cursor-pointer'
                  : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {isSelected && (
                <m.span
                  layoutId={`${name}-selected`}
                  transition={springQuick}
                  className="absolute inset-0 bg-indigo-600 dark:bg-indigo-500"
                  aria-hidden="true"
                />
              )}
              <span className="relative text-base font-bold tabular-nums leading-none">{r.value}</span>
              <span className={`relative hidden sm:block text-[11px] leading-tight ${isSelected ? 'text-indigo-100' : 'opacity-80'}`}>
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {markerGroups.size > 0 && (
        <div className="grid grid-cols-5" aria-hidden="true">
          {Array.from(markerGroups.entries()).map(([value, group]) => (
            <div
              key={value}
              className={`flex flex-col px-1 sm:pl-2 ${value >= 4 ? 'items-end sm:items-start' : 'items-center sm:items-start'}`}
              style={{ gridColumnStart: value, gridRowStart: 1 }}
            >
              {/* Pointer up to the segment this rating belongs to */}
              <span className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-slate-400 dark:border-b-slate-500 sm:ml-3" />
              <span className="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden divide-x divide-slate-300 dark:divide-slate-600 text-[11px] font-semibold leading-tight whitespace-nowrap">
                {group.map((m) => (
                  <span key={m.label} className={`px-2 py-1 ${MARKER_TONES[m.tone]}`}>
                    {m.label}
                  </span>
                ))}
                <span className="px-2 py-1 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 tabular-nums">rated {value}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
        {selected ? (
          <>
            <span className="font-semibold text-slate-900 dark:text-white">{selected.label}.</span> {selected.desc}.
          </>
        ) : (
          'Not rated yet.'
        )}
        {markers
          .filter((m) => m.value)
          .map((m) => (
            <span key={m.label} className="sr-only"> {m.label} rated this {m.value}.</span>
          ))}
      </p>
    </div>
  );
};
