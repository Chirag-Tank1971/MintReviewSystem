import React, { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { KraReturnFlag, ReviewKraSnapshot } from '../../../types';
import { RatingJustificationInput } from '../RatingJustificationInput';
import { ReturnedKraPanel } from './ReturnedKraPanel';
import { RatingScale } from './RatingScale';
import { CardStatus, KraCardHeader, LockedKraRow, LockedStatus, QuotedNote } from './KraCardParts';
import { TEXTAREA_CLASS } from '../../ui/formStyles';
import { m, accordionVariants } from '../../../animations';

interface Step2ManagerSectionProps {
  snapshots: ReviewKraSnapshot[];
  canEdit: boolean;
  onKraChange: (index: number, field: keyof ReviewKraSnapshot, value: any) => void;
  onReturnFlagChange?: (index: number, patch: Partial<KraReturnFlag>) => void;
}

export const Step2ManagerSection: React.FC<Step2ManagerSectionProps> = ({
  snapshots,
  canEdit,
  onKraChange,
  onReturnFlagChange,
}) => {
  // While a return to the Manager is open, only the returned KRAs are editable; the rest are
  // locked (and collapsed) so unrelated ratings can't change silently.
  const hasOpenReturn = snapshots.some((k) => k.returnFlag?.target === 'MANAGER');
  const [expandedLocked, setExpandedLocked] = useState<Set<string>>(new Set());
  const ratedCount = snapshots.filter((k) => (k.rating || 0) > 0).length;

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="max-w-prose">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Score each key result area</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Rate every KRA from 1 to 5 against its target. Scores of 1, 2 or 5 need a short justification.
          </p>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          <span className="font-bold text-slate-900 dark:text-white">{ratedCount}</span> of {snapshots.length} rated
        </p>
      </div>

      {/* KRA Cards */}
      <div className="space-y-3">
        {snapshots.map((item, idx) => {
          const rating = item.rating || 0;
          const itemContribution = (rating * (item.weight || 0)) / 100;
          const kraDomId = item.id || (item as any).kraId || String(idx);
          const title = item.kraName || item.title;
          const isReturnedToMe = item.returnFlag?.target === 'MANAGER';
          const isLocked = hasOpenReturn && !isReturnedToMe;
          const cardEditable = canEdit && !isLocked;
          const isMissingJustification =
            cardEditable &&
            [1, 2, 5].includes(rating) &&
            (!item.ratingJustification || item.ratingJustification.trim().length < 15);

          if (isLocked && !expandedLocked.has(item.id)) {
            return (
              <LockedKraRow
                key={item.id || idx}
                id={`mgr-kra-card-${kraDomId}`}
                title={title}
                summary={`${rating ? `Rated ${rating}` : 'Not rated'}, ${item.weight}% weight`}
                onExpand={() => setExpandedLocked((prev) => new Set(prev).add(item.id))}
              />
            );
          }

          return (
            <m.section
              variants={accordionVariants}
              initial={isLocked ? 'collapsed' : false}
              animate="expanded"
              key={item.id || idx}
              id={`mgr-kra-card-${kraDomId}`}
              aria-labelledby={`mgr-kra-title-${kraDomId}`}
              className={`rounded-2xl border bg-white dark:bg-slate-800/90 p-5 space-y-4 ${
                isReturnedToMe || isMissingJustification
                  ? 'border-amber-400 dark:border-amber-600/80'
                  : 'border-slate-200 dark:border-slate-700/80'
              }`}
            >
              <KraCardHeader
                index={idx}
                titleId={`mgr-kra-title-${kraDomId}`}
                title={title}
                description={item.description}
                rating={rating}
                contribution={itemContribution}
                weight={item.weight}
              >
                {isReturnedToMe ? (
                  <CardStatus icon={RotateCcw} tone="warning">Sent back to you for re-evaluation</CardStatus>
                ) : isMissingJustification ? (
                  <CardStatus icon={AlertTriangle} tone="warning">Add a justification to keep this score</CardStatus>
                ) : null}
                {isLocked && (
                  <LockedStatus
                    onCollapse={() =>
                      setExpandedLocked((prev) => {
                        const next = new Set(prev);
                        next.delete(item.id);
                        return next;
                      })
                    }
                  />
                )}
              </KraCardHeader>

              {/* Target & measurement */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-slate-500 dark:text-slate-400">Target</dt>
                <dd className="text-slate-800 dark:text-slate-200">{item.targetSnapshot || 'Quality execution within SLA'}</dd>
                <dt className="text-slate-500 dark:text-slate-400">Measured by</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {item.measurementCriteria || '1: Below SLA | 3: Meets SLA | 5: Exceeds SLA'}
                </dd>
              </dl>

              {isReturnedToMe && (
                <ReturnedKraPanel
                  item={item}
                  target="MANAGER"
                  canEdit={canEdit}
                  onFlagChange={(patch) => onReturnFlagChange?.(idx, patch)}
                />
              )}

              <RatingScale
                name={`mgr-kra-rating-${kraDomId}`}
                label="Your rating"
                rating={rating}
                markers={[{ label: 'Employee', value: item.selfRating, tone: 'employee' }]}
                disabled={!cardEditable}
                onSelect={(value) => onKraChange(idx, 'rating', value)}
              />

              {/* Mandatory justification (renders only for ratings 1, 2 and 5) */}
              <RatingJustificationInput
                rating={rating}
                value={item.ratingJustification || ''}
                onChange={(val) => onKraChange(idx, 'ratingJustification', val)}
                disabled={!cardEditable}
                roleLabel="Manager"
                minChars={15}
              />

              {/* Large gap: employee self-rated 5 but manager rates 1 or 2 */}
              {item.selfRating === 5 && (rating === 1 || rating === 2) && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 space-y-2.5 animate-in fade-in">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    The employee rated this 5 and you rated it {rating}, a gap of {5 - rating} points
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <QuotedNote
                      label="Employee's reasoning"
                      text={item.selfJustification || item.selfAchievement || 'No reasoning given.'}
                    />
                    <QuotedNote
                      label="Your reasoning"
                      text={item.ratingJustification || 'Explain the difference in the justification above.'}
                      accent="border-amber-400 dark:border-amber-600"
                    />
                  </div>
                </div>
              )}

              {/* Results & notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`mgr-kra-achievement-${kraDomId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Results delivered
                  </label>
                  <textarea
                    id={`mgr-kra-achievement-${kraDomId}`}
                    rows={2}
                    disabled={!cardEditable}
                    value={item.achievement || ''}
                    onChange={(e) => onKraChange(idx, 'achievement', e.target.value)}
                    placeholder="Milestones, releases or metrics achieved"
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor={`mgr-kra-comments-${kraDomId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your notes
                  </label>
                  <textarea
                    id={`mgr-kra-comments-${kraDomId}`}
                    rows={2}
                    disabled={!cardEditable}
                    value={item.comments || ''}
                    onChange={(e) => onKraChange(idx, 'comments', e.target.value)}
                    placeholder="What went well and what to work on"
                    className={TEXTAREA_CLASS}
                  />
                </div>
              </div>
            </m.section>
          );
        })}
      </div>
    </div>
  );
};
