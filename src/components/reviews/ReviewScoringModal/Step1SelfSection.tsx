import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { EmployeeReview, ReviewKraSnapshot } from '../../../types';
import { QuotedNote } from './KraCardParts';

interface Step1SelfSectionProps {
  review: EmployeeReview;
  snapshots: ReviewKraSnapshot[];
}

export const Step1SelfSection: React.FC<Step1SelfSectionProps> = ({
  review,
  snapshots,
}) => {
  const isSubmitted = Boolean(
    review.selfSubmittedAt ||
    review.isSelfSubmitted ||
    (review.selfScore !== undefined && review.selfScore > 0) ||
    (snapshots && snapshots.some((s) => s.selfRating && s.selfRating > 0)) ||
    Boolean(review.selfStrengths?.trim() || review.selfImprovements?.trim() || review.selfObstacles?.trim()) ||
    review.actionHistory?.some((a) => a.action === 'SELF_SUBMITTED')
  );

  const submittedDate = review.selfSubmittedAt
    ? new Date(review.selfSubmittedAt).toLocaleDateString()
    : review.actionHistory?.find((a) => a.action === 'SELF_SUBMITTED')?.performedAt
    ? new Date(review.actionHistory.find((a) => a.action === 'SELF_SUBMITTED')!.performedAt).toLocaleDateString()
    : null;

  const displaySelfScore =
    review.selfScore && review.selfScore > 0
      ? review.selfScore
      : (() => {
          let sum = 0;
          let count = 0;
          snapshots.forEach((s) => {
            if (s.selfRating && s.selfRating > 0) {
              sum += (s.selfRating * (s.weight || 0)) / 100;
              count++;
            }
          });
          return count > 0 ? Number(sum.toFixed(2)) : null;
        })();

  const reflections = [
    { title: 'Accomplishments and strengths', text: review.selfStrengths, empty: 'No strengths reported.' },
    { title: 'Growth areas', text: review.selfImprovements, empty: 'No growth areas reported.' },
    { title: 'Obstacles and support needed', text: review.selfObstacles, empty: 'No obstacles reported.' },
  ];

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-prose">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Read the employee's self-assessment</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Review what they reported about their own work before you score it in the next step.
          </p>
          {isSubmitted ? (
            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Submitted{submittedDate ? ` on ${submittedDate}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Waiting for the employee to submit
            </p>
          )}
        </div>

        {displaySelfScore ? (
          <div className="text-right">
            <div className="tabular-nums">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{displaySelfScore.toFixed(2)}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400"> / 5</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Self-rating</div>
          </div>
        ) : null}
      </div>

      {/* Qualitative self inputs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700/80">
        {reflections.map((r) => (
          <div key={r.title} className="p-4 space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{r.title}</h4>
            <p className={`text-xs whitespace-pre-wrap leading-relaxed ${r.text ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
              {r.text || r.empty}
            </p>
          </div>
        ))}
      </div>

      {/* Per-KRA self ratings */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          Self-ratings by KRA <span className="font-normal text-slate-500 dark:text-slate-400 tabular-nums">({snapshots.length})</span>
        </h4>
        <ul className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 divide-y divide-slate-200 dark:divide-slate-700/80">
          {snapshots.map((item, idx) => (
            <li key={item.id || idx} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">{idx + 1}</span>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">{item.kraName || item.title}</h5>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{item.weight}% weight</span>
                </div>
                {item.selfRating ? (
                  <span className="text-xs text-slate-600 dark:text-slate-300 shrink-0">
                    Rated <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.selfRating}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">Not rated</span>
                )}
              </div>

              {(item.selfAchievement || item.selfJustification) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-5">
                  {item.selfAchievement && <QuotedNote label="Employee's note" text={item.selfAchievement} />}
                  {item.selfJustification && (
                    <QuotedNote label={`Reasoning for a ${item.selfRating}`} text={item.selfJustification} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
