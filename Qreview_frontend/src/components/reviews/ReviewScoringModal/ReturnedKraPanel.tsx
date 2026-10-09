import React from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { KraReturnFlag, ReviewKraSnapshot, ReturnTarget } from '../../../types';
import { isReturnedKraAddressed } from './returnUtils';

interface ReturnedKraPanelProps {
  item: ReviewKraSnapshot;
  target: ReturnTarget;
  canEdit: boolean;
  onFlagChange: (patch: Partial<KraReturnFlag>) => void;
}

const INPUT_CLASS =
  'w-full text-xs p-2 rounded-lg border bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-70';

/** Shown inside a KRA card while that KRA is part of an open return to the current reviewer. */
export const ReturnedKraPanel: React.FC<ReturnedKraPanelProps> = ({ item, target, canEdit, onFlagChange }) => {
  const flag = item.returnFlag;
  if (!flag) return null;
  const addressed = isReturnedKraAddressed(item, target);
  const currentRating = target === 'MANAGER' ? item.rating : item.hodRating;
  const ratingUnchanged = (Number(currentRating) || 0) === (Number(flag.previousRating) || 0);
  const replyId = `return-reply-${item.id}`;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 space-y-2.5 text-xs">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            {flag.returnedByRole}'s note
          </p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">
            {flag.previousRating ? `You had rated this ${flag.previousRating} when it was returned` : 'It was not rated when it was returned'}
            {!ratingUnchanged && (
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">, now {currentRating || 0}</span>
            )}
            .
          </p>
        </div>
        <span
          className={`font-semibold flex items-center gap-1 ${
            addressed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          {addressed && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {addressed ? 'Addressed' : 'Needs your update'}
        </span>
      </div>

      <blockquote className="text-slate-700 dark:text-slate-300 leading-relaxed border-l-2 border-amber-400 dark:border-amber-600 pl-2.5">
        {flag.comment || 'No note for this KRA. See the return reason at the top of the review.'}
      </blockquote>

      <div>
        <label htmlFor={replyId} className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Your reply <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
        </label>
        <input
          id={replyId}
          type="text"
          disabled={!canEdit}
          value={flag.reply || ''}
          onChange={(e) => onFlagChange({ reply: e.target.value })}
          placeholder="Reply to the reviewer"
          className={`${INPUT_CLASS} border-amber-200 dark:border-amber-900`}
        />
      </div>

      {ratingUnchanged && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(flag.keepRating)}
              onChange={(e) => onFlagChange({ keepRating: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Keep my rating of {currentRating || 0}, I've re-checked it
          </label>
          {flag.keepRating && (
            <textarea
              rows={2}
              disabled={!canEdit}
              value={flag.keepReason || ''}
              onChange={(e) => onFlagChange({ keepReason: e.target.value })}
              aria-label="Why the rating stands"
              placeholder="Why the rating stands (at least 10 characters)"
              className={`${INPUT_CLASS} ${
                (flag.keepReason || '').trim().length < 10 ? 'border-rose-300 dark:border-rose-800' : 'border-amber-200 dark:border-amber-900'
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
};
