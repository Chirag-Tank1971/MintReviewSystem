import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ScoreSummaryBarProps {
  computedScore: number;
  scoreTier: { label: string; color: string };
  unratedCount: number;
  isDualManager?: boolean;
}

/** Live weighted score, shown as a compact card in the scoring modal's side rail. */
export const ScoreSummaryBar: React.FC<ScoreSummaryBarProps> = ({
  computedScore,
  scoreTier,
  unratedCount,
  isDualManager,
}) => {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs">
      <div className="text-slate-500 dark:text-slate-400">Weighted score</div>
      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
        <span className="tabular-nums">
          <span className="text-2xl font-semibold text-slate-900 dark:text-white">{computedScore.toFixed(2)}</span>
          <span className="text-slate-400"> / 5</span>
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${scoreTier.color}`}>{scoreTier.label}</span>
      </div>
      {unratedCount > 0 && (
        <p className="mt-1.5 font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {unratedCount} KRA{unratedCount > 1 ? 's' : ''} not rated yet
        </p>
      )}
      {isDualManager && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Final score averages both managers.</p>
      )}
    </div>
  );
};
