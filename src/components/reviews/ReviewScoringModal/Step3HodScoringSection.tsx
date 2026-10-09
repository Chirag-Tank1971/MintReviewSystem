import React, { useState } from 'react';
import { AlertTriangle, PenLine, RotateCcw } from 'lucide-react';
import { KraReturnFlag, ReviewKraSnapshot } from '../../../types';
import { RatingJustificationInput } from '../RatingJustificationInput';
import { ReturnedKraPanel } from './ReturnedKraPanel';
import { RatingScale } from './RatingScale';
import { CardStatus, KraCardHeader, LockedKraRow, LockedStatus, QuotedNote } from './KraCardParts';
import { TEXTAREA_CLASS } from '../../ui/formStyles';
import { m, accordionVariants } from '../../../animations';

interface Step3HodScoringSectionProps {
  snapshots: ReviewKraSnapshot[];
  canHodScore: boolean;
  onKraChange: (index: number, field: keyof ReviewKraSnapshot, value: any) => void;
  hodOverallComments: string;
  setHodOverallComments: (val: string) => void;
  onReturnFlagChange?: (index: number, patch: Partial<KraReturnFlag>) => void;
}

type Revision = NonNullable<ReviewKraSnapshot['revisedAfterReturn']>;

const describeRevision = (revised: Revision) =>
  revised.before !== revised.after
    ? `Manager revised the rating from ${revised.before || 'none'} to ${revised.after}`
    : revised.kept
    ? `Manager kept the rating at ${revised.after}`
    : 'Revised by the manager';

/**
 * HOD's own independent KRA-by-KRA scoring pass — mirrors Step2ManagerSection's layout but
 * writes exclusively to the hod* fields on each snapshot item. The Manager's own rating is
 * shown read-only for context; it is never editable or overwritten from here.
 */
export const Step3HodScoringSection: React.FC<Step3HodScoringSectionProps> = ({
  snapshots,
  canHodScore,
  onKraChange,
  hodOverallComments,
  setHodOverallComments,
  onReturnFlagChange,
}) => {
  // While HR has returned specific KRAs to the HOD, only those are editable; the rest are locked.
  const hasOpenReturn = snapshots.some((k) => k.returnFlag?.target === 'HOD');
  const revisedCount = snapshots.filter((k) => k.revisedAfterReturn).length;
  const ratedCount = snapshots.filter((k) => (k.hodRating || 0) > 0).length;
  const [expandedLocked, setExpandedLocked] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="max-w-prose">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Score each key result area independently</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Your rating is separate from the manager's, which is marked on each scale for reference. The final score is the
            average of both.
          </p>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          <span className="font-bold text-slate-900 dark:text-white">{ratedCount}</span> of {snapshots.length} rated
        </p>
      </div>

      {revisedCount > 0 && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 text-xs leading-relaxed text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
          <PenLine className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {hasOpenReturn ? (
            // HR returned to both: the Manager went first; the HOD's own ratings were kept.
            <span>
              The manager has already revised <b>{revisedCount}</b> KRA{revisedCount === 1 ? '' : 's'}, marked on each card. Your
              ratings were kept. Re-evaluate the KRAs HR returned to you.
            </span>
          ) : (
            <span>
              The manager revised <b>{revisedCount}</b> KRA{revisedCount === 1 ? '' : 's'} you returned. Your rating on those KRAs
              was reset, so score them again. Your ratings on the other KRAs are unchanged.
            </span>
          )}
        </div>
      )}

      {/* KRA Cards */}
      <div className="space-y-3">
        {snapshots.map((item, idx) => {
          const hodRating = item.hodRating || 0;
          const itemContribution = (hodRating * (item.weight || 0)) / 100;
          const kraDomId = item.id || (item as any).kraId || String(idx);
          const title = item.kraName || item.title;
          const isReturnedToMe = item.returnFlag?.target === 'HOD';
          const isLocked = hasOpenReturn && !isReturnedToMe;
          const cardEditable = canHodScore && !isLocked;
          const revised = item.revisedAfterReturn;
          const isMissingHodJustification =
            cardEditable &&
            [1, 2, 5].includes(hodRating) &&
            (!item.hodJustification || item.hodJustification.trim().length < 15);
          const hasContext = item.achievement || item.comments || item.ratingJustification || item.selfJustification;

          if (isLocked && !expandedLocked.has(item.id)) {
            return (
              <LockedKraRow
                key={item.id || idx}
                id={`hod-kra-card-${kraDomId}`}
                title={title}
                summary={`${hodRating ? `You rated ${hodRating}` : 'Not rated'}, ${item.weight}% weight`}
                onExpand={() => setExpandedLocked((prev) => new Set(prev).add(item.id))}
              >
                {revised && <span className="font-semibold text-indigo-700 dark:text-indigo-300">{describeRevision(revised)}</span>}
              </LockedKraRow>
            );
          }

          return (
            <m.section
              variants={accordionVariants}
              initial={isLocked ? 'collapsed' : false}
              animate="expanded"
              key={item.id || idx}
              id={`hod-kra-card-${kraDomId}`}
              aria-labelledby={`hod-kra-title-${kraDomId}`}
              className={`rounded-2xl border bg-white dark:bg-slate-800/90 p-5 space-y-4 ${
                isReturnedToMe || isMissingHodJustification
                  ? 'border-amber-400 dark:border-amber-600/80'
                  : revised
                  ? 'border-indigo-300 dark:border-indigo-700/80'
                  : 'border-slate-200 dark:border-slate-700/80'
              }`}
            >
              <KraCardHeader
                index={idx}
                titleId={`hod-kra-title-${kraDomId}`}
                title={title}
                description={item.description}
                rating={hodRating}
                contribution={itemContribution}
                weight={item.weight}
              >
                {isReturnedToMe ? (
                  <CardStatus icon={RotateCcw} tone="warning">Sent back to you for re-evaluation</CardStatus>
                ) : isMissingHodJustification ? (
                  <CardStatus icon={AlertTriangle} tone="warning">Add a justification to keep this score</CardStatus>
                ) : null}
                {revised && <CardStatus icon={PenLine} tone="info">{describeRevision(revised)}</CardStatus>}
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

              {/* Manager's & employee's notes, read-only for context */}
              {hasContext && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3">
                  {item.achievement && <QuotedNote label="Results the manager recorded" text={item.achievement} />}
                  {item.comments && <QuotedNote label="Manager's notes" text={item.comments} />}
                  {item.selfJustification && (
                    <QuotedNote label={`Employee's reasoning for a ${item.selfRating}`} text={item.selfJustification} />
                  )}
                  {item.ratingJustification && (
                    <QuotedNote label={`Manager's reasoning for a ${item.rating}`} text={item.ratingJustification} />
                  )}
                </div>
              )}

              {revised && (revised.reply || revised.previousHodRating) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3">
                  {revised.reply && (
                    <QuotedNote label="Manager's response" text={revised.reply} accent="border-indigo-300 dark:border-indigo-700" />
                  )}
                  {revised.previousHodRating ? (
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">Your previous rating</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{revised.previousHodRating}</div>
                    </div>
                  ) : null}
                </div>
              )}

              {isReturnedToMe && (
                <ReturnedKraPanel
                  item={item}
                  target="HOD"
                  canEdit={canHodScore}
                  onFlagChange={(patch) => onReturnFlagChange?.(idx, patch)}
                />
              )}

              <RatingScale
                name={`hod-kra-rating-${kraDomId}`}
                label="Your rating"
                rating={hodRating}
                markers={[
                  { label: 'Employee', value: item.selfRating, tone: 'employee' },
                  { label: 'Manager', value: item.rating, tone: 'manager' },
                ]}
                disabled={!cardEditable}
                onSelect={(value) => onKraChange(idx, 'hodRating', value)}
              />

              {/* Mandatory HOD justification (renders only for ratings 1, 2 and 5) */}
              <RatingJustificationInput
                rating={hodRating}
                value={item.hodJustification || ''}
                onChange={(val) => onKraChange(idx, 'hodJustification', val)}
                disabled={!cardEditable}
                roleLabel="HOD"
                minChars={15}
              />

              {/* Results & notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`hod-kra-achievement-${kraDomId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Results you observed
                  </label>
                  <textarea
                    id={`hod-kra-achievement-${kraDomId}`}
                    rows={2}
                    disabled={!cardEditable}
                    value={item.hodAchievement || ''}
                    onChange={(e) => onKraChange(idx, 'hodAchievement', e.target.value)}
                    placeholder="Milestones and outcomes you observed"
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor={`hod-kra-comments-${kraDomId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your notes
                  </label>
                  <textarea
                    id={`hod-kra-comments-${kraDomId}`}
                    rows={2}
                    disabled={!cardEditable}
                    value={item.hodComments || ''}
                    onChange={(e) => onKraChange(idx, 'hodComments', e.target.value)}
                    placeholder="Execution, ownership and impact"
                    className={TEXTAREA_CLASS}
                  />
                </div>
              </div>
            </m.section>
          );
        })}
      </div>

      {/* HOD Overall Comments */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 space-y-2">
        <div>
          <label htmlFor="hod-overall-comments" className="block text-sm font-bold text-slate-900 dark:text-white">
            Overall comments
          </label>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">HR reads these before approving the review.</p>
        </div>
        <textarea
          id="hod-overall-comments"
          rows={3}
          disabled={!canHodScore}
          value={hodOverallComments}
          onChange={(e) => setHodOverallComments(e.target.value)}
          placeholder="Calibration remarks for HR"
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
};
