import React from 'react';
import { RotateCcw } from 'lucide-react';
import { EmployeeReview } from '../../../types';
import { getOpenReturn, getReturnCount, getReturnDueInfo } from './returnUtils';

/** "Returned 2×" pill for review cards/rows; turns red when an open return is past its SLA. */
export const ReturnCountBadge: React.FC<{ review: EmployeeReview; className?: string }> = ({
  review,
  className = '',
}) => {
  const count = getReturnCount(review);
  if (count === 0) return null;
  const open = getOpenReturn(review);
  const due = open ? getReturnDueInfo(open) : null;

  const title = open
    ? `Open return by ${open.returnedByRole} (${open.returnedByName}): ${
        open.isFullReturn ? 'full review' : open.kraTitles.join(', ')
      } — ${due!.label}`
    : `This review has been returned ${count} time${count === 1 ? '' : 's'}`;

  const tone = due?.overdue
    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
    : open
    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 transition-colors select-none ${tone} ${className}`}
    >
      <RotateCcw className="w-2.5 h-2.5 shrink-0" />
      <span>Returned {count}×</span>
      {due?.overdue && (
        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
          <span>·</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>overdue</span>
        </span>
      )}
    </span>
  );
};
