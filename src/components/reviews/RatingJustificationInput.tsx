import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface RatingJustificationInputProps {
  rating: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  roleLabel?: string;
  minChars?: number;
  error?: string;
}

const COPY: Record<1 | 2 | 5, { title: string; guidance: string; placeholder: string }> = {
  1: {
    title: 'Explain why this fell well below expectations',
    guidance: 'Name the missed targets or SLAs, any blockers, and the support needed.',
    placeholder: 'Root cause, SLA deviation or blocker behind this score',
  },
  2: {
    title: 'Explain why this only partly met expectations',
    guidance: 'Name the milestones missed or the gaps, and the targets for next quarter.',
    placeholder: 'Milestones missed and what needs to change',
  },
  5: {
    title: 'Explain what made this outstanding',
    guidance: 'Describe the outcome or measurable impact that went beyond the role.',
    placeholder: 'Outcome, delivery or benchmark that exceeded the standard',
  },
};

export const RatingJustificationInput: React.FC<RatingJustificationInputProps> = ({
  rating,
  value,
  onChange,
  disabled = false,
  roleLabel = 'Reviewer',
  minChars = 15,
  error,
}) => {
  // Only rendered for extreme ratings 1, 2, and 5
  if (rating !== 1 && rating !== 2 && rating !== 5) {
    return null;
  }

  const charCount = (value || '').trim().length;
  const isSatisfied = charCount >= minChars;
  const isLowScore = rating === 1 || rating === 2;
  const copy = COPY[rating];

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-2.5 ${
        isSatisfied
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'
          : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-prose">
          <h5 className="text-xs font-semibold text-slate-900 dark:text-white">
            {copy.title} <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>
          </h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{copy.guidance}</p>
        </div>
        <span
          className={`text-[11px] tabular-nums flex items-center gap-1 shrink-0 ${
            isSatisfied ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {isSatisfied && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {isSatisfied ? 'Enough detail' : `${charCount} of ${minChars} characters`}
        </span>
      </div>

      {/* Automated PIP notice for ratings 1 and 2 */}
      {isLowScore && (
        <p className="flex items-start gap-1.5 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <span>
            <strong>PIP advisory:</strong> A score of 1 or 2 flags this employee for review under the department's Performance
            Improvement Plan (PIP) guidelines.
          </span>
        </p>
      )}

      <textarea
        rows={2}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${roleLabel} justification`}
        aria-required="true"
        placeholder={`${copy.placeholder} (at least ${minChars} characters)`}
        className={`w-full text-xs leading-relaxed p-2.5 rounded-lg border bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:bg-slate-50 dark:disabled:bg-slate-850 ${
          isSatisfied
            ? 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'
            : 'border-amber-400 dark:border-amber-700/80 focus:border-amber-500 focus:ring-amber-500/20'
        }`}
      />

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
