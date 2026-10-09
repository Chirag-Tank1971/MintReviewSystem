import React from 'react';
import { RotateCcw } from 'lucide-react';
import { EmployeeReview } from '../../../types';
import { getOpenReturn, getReturnCount, getReturnDueInfo } from './returnUtils';

/** "Returned 2×" pill for review cards/rows; turns red when an open return is past its SLA. */
export const ReturnCountBadge: React.FC<{ review: EmployeeReview }> = ({ review }) => {
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
    ? 'bg-rose-600 text-white border-rose-600'
    : open
    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${tone}`}>
      <RotateCcw className="w-2.5 h-2.5" />
      Returned {count}×{due?.overdue ? ' · overdue' : ''}
    </span>
  );
};
