import React from 'react';

interface CycleBadgeProps {
  code?: string;
  cycleCode?: string;
  cycleName?: string;
  size?: 'sm' | 'md';
  className?: string;
  color?: string;
  showTooltip?: boolean;
}

/**
 * Enterprise Neutral Cycle Badge
 * Standardizes appraisal cycle presentation without rainbow styling
 */
export const CycleBadge: React.FC<CycleBadgeProps> = ({
  code: propCode,
  cycleCode,
  cycleName,
  size = 'md',
  className = '',
}) => {
  const code = propCode || cycleCode || (cycleName ? cycleName.replace(/Cycle\s*/i, '').trim() : '');
  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-1.5 py-0.5'
      : 'text-[11px] px-2 py-0.5';

  if (!code) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ${sizeClasses} ${className}`}
        title="No appraisal cycle assigned"
      >
        Unassigned
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium tabular-nums rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ${sizeClasses} ${className}`}
      title={cycleName || `Appraisal Cycle ${code}`}
    >
      Cycle {code}
    </span>
  );
};
