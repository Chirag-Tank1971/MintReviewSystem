import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ScoreSummaryBarProps {
  computedScore: number;
  scoreTier: { label: string; color: string };
  unratedCount: number;
}

export const ScoreSummaryBar: React.FC<ScoreSummaryBarProps> = ({
  computedScore,
  scoreTier,
  unratedCount,
}) => {
  return (
    <div className="px-6 py-2.5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-slate-500 dark:text-slate-400">Weighted score</span>
        <span className="tabular-nums">
          <span className="text-xl font-bold text-slate-900 dark:text-white">{computedScore.toFixed(2)}</span>
          <span className="text-slate-400"> / 5</span>
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${scoreTier.color}`}>{scoreTier.label}</span>
      </div>

      {unratedCount > 0 && (
        <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {unratedCount} KRA{unratedCount > 1 ? 's' : ''} not rated yet
        </span>
      )}
    </div>
  );
};
