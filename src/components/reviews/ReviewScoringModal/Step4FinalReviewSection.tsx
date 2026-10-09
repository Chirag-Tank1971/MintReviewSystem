import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Lock, UserCheck, RotateCcw } from 'lucide-react';
import { EmployeeReview, ReviewKraSnapshot, ReviewStatus } from '../../../types';
import { getOpenReturn, getReturnCount } from './returnUtils';
import { TEXTAREA_CLASS } from '../../ui/formStyles';
import { m, AnimatePresence, accordionVariants } from '../../../animations';

interface Step4FinalReviewSectionProps {
  review: EmployeeReview;
  snapshots: ReviewKraSnapshot[];
  /** Live Manager / HOD weighted scores (from the current snapshot). */
  managerScore: number;
  hodScore: number;
  strengths: string;
  improvements: string;
  managerComments: string;
  hrComments: string;
  setHrComments: (val: string) => void;
  isHrOrAdmin: boolean;
  saving: boolean;
  onOpenStatusModal: (status: ReviewStatus) => void;
  /** Opens the return dialog with these KRAs pre-selected (HR, while HR_PENDING). */
  onReturnSelected?: (kraIds: string[]) => void;
}

type Who = 'MANAGER' | 'HOD';

const bracketFor = (s: number) => {
  if (s === 0) return { label: 'Unscored', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
  if (s >= 4.5) return { label: 'Outstanding', cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
  if (s >= 3.5) return { label: 'Exceeds Expectations', cls: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' };
  if (s >= 2.5) return { label: 'Meets Expectations', cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
  return { label: 'Needs Improvement', cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
};

const needsReason = (rating: number, reason?: string) => [1, 2, 5].includes(rating) && (reason || '').trim().length < 15;

/**
 * A written reason is "outdated" when a return changed the rating but the reason text was left
 * as it was (e.g. still says "not good at this" after 2★ → 4★). Uses the recorded return diffs.
 */
function findOutdatedReasons(review: EmployeeReview, snapshots: ReviewKraSnapshot[]): Map<string, Set<Who>> {
  const latest = new Map<string, { stale: boolean; after: number }>();
  [...(review.returnRequests || [])]
    .filter((r) => r.status === 'RESOLVED' && r.changes)
    .sort((a, b) => (a.resolvedAt || '').localeCompare(b.resolvedAt || ''))
    .forEach((r) =>
      r.changes!.forEach((c) => {
        const who: Who = c.field === 'hodRating' ? 'HOD' : 'MANAGER';
        latest.set(`${c.kraId}|${who}`, { stale: c.before !== c.after && !c.justificationChanged, after: c.after });
      })
    );

  const out = new Map<string, Set<Who>>();
  snapshots.forEach((k) => {
    (['MANAGER', 'HOD'] as Who[]).forEach((who) => {
      const entry = latest.get(`${k.id}|${who}`);
      const rating = who === 'MANAGER' ? k.rating : k.hodRating;
      const reason = who === 'MANAGER' ? k.ratingJustification : k.hodJustification;
      if (entry?.stale && entry.after === (Number(rating) || 0) && (reason || '').trim()) {
        if (!out.has(k.id)) out.set(k.id, new Set());
        out.get(k.id)!.add(who);
      }
    });
  });
  return out;
}

const RatingCell: React.FC<{ value?: number; emphasis?: boolean }> = ({ value, emphasis }) =>
  value ? (
    <span className={`tabular-nums text-slate-800 dark:text-slate-200 ${emphasis ? 'font-bold text-slate-900 dark:text-white' : ''}`}>
      {Number(value.toFixed(1))}
    </span>
  ) : (
    <span className="text-slate-400">Not rated</span>
  );

const DetailColumn: React.FC<{
  title: string;
  rating?: number;
  reason?: string;
  achievement?: string;
  comments?: string;
  warning?: string;
}> = ({ title, rating, reason, achievement, comments, warning }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 text-xs">
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-semibold text-slate-900 dark:text-white">{title}</span>
      <span className="text-slate-600 dark:text-slate-400">
        {rating ? (
          <>
            Rated <span className="font-bold text-slate-900 dark:text-white tabular-nums">{rating}</span>
          </>
        ) : (
          'Not rated'
        )}
      </span>
    </div>
    {warning && (
      <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {warning}
      </div>
    )}
    <Field label="Reason" value={reason} />
    <Field label="Achievement" value={achievement} />
    <Field label="Comments" value={comments} />
    {!reason && !achievement && !comments && <p className="text-slate-400">No notes.</p>}
  </div>
);

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value ? (
    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
      <span className="font-semibold text-slate-500 dark:text-slate-400">{label}: </span>
      {value}
    </p>
  ) : null;

/**
 * Step 4 — Final Review: one page with every role's ratings and notes side by side, a
 * pre-approval checklist, overall comments, HR remarks and the HR sign-off actions.
 */
export const Step4FinalReviewSection: React.FC<Step4FinalReviewSectionProps> = ({
  review,
  snapshots,
  managerScore,
  hodScore,
  strengths,
  improvements,
  managerComments,
  hrComments,
  setHrComments,
  isHrOrAdmin,
  saving,
  onOpenStatusModal,
  onReturnSelected,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyDisagreements, setOnlyDisagreements] = useState(false);
  const [sortByGap, setSortByGap] = useState(false);

  const outdated = useMemo(() => findOutdatedReasons(review, snapshots), [review, snapshots]);
  const openReturn = getOpenReturn(review);
  const returnCount = getReturnCount(review);
  const canReturn = Boolean(onReturnSelected) && isHrOrAdmin && review.status === 'HR_PENDING' && !review.isClosed;

  const finalScore = hodScore > 0 ? Number(((managerScore + hodScore) / 2).toFixed(2)) : managerScore;
  const bracket = bracketFor(finalScore);

  const rows = useMemo(() => {
    const list = snapshots.map((k, idx) => {
      const mgr = Number(k.rating) || 0;
      const hod = Number(k.hodRating) || 0;
      const final = hod > 0 && mgr > 0 ? (mgr + hod) / 2 : mgr || hod;
      const gap = mgr > 0 && hod > 0 ? Math.abs(mgr - hod) : 0;
      return { k, idx, mgr, hod, final, gap };
    });
    const filtered = onlyDisagreements ? list.filter((r) => r.gap >= 2) : list;
    return sortByGap ? [...filtered].sort((a, b) => b.gap - a.gap) : filtered;
  }, [snapshots, onlyDisagreements, sortByGap]);

  const disagreementCount = snapshots.filter((k) => (Number(k.rating) || 0) > 0 && (Number(k.hodRating) || 0) > 0 && Math.abs(Number(k.rating) - Number(k.hodRating)) >= 2).length;

  // Pre-approval checklist
  const unratedByManager = snapshots.filter((k) => !k.rating).length;
  const unratedByHod = review.hodId ? snapshots.filter((k) => !k.hodRating).length : 0;
  const missingReasons = snapshots.reduce(
    (n, k) => n + (needsReason(Number(k.rating) || 0, k.ratingJustification) ? 1 : 0) + (needsReason(Number(k.hodRating) || 0, k.hodJustification) ? 1 : 0),
    0
  );
  const outdatedCount = Array.from(outdated.values()).reduce((n, s) => n + s.size, 0);
  const checklist = [
    { ok: !openReturn, label: openReturn ? `A return is still open with the ${openReturn.target === 'HOD' ? 'HOD' : 'Manager'}` : 'No open returns' },
    { ok: unratedByManager === 0, label: unratedByManager ? `${unratedByManager} KRA(s) not rated by the Manager` : 'Manager rated every KRA' },
    ...(review.hodId
      ? [{ ok: unratedByHod === 0, label: unratedByHod ? `${unratedByHod} KRA(s) not rated by the HOD` : 'HOD rated every KRA' }]
      : []),
    { ok: missingReasons === 0, label: missingReasons ? `${missingReasons} rating(s) of 1, 2 or 5 have no written reason` : 'Every rating of 1, 2 or 5 has a reason' },
    { ok: outdatedCount === 0, label: outdatedCount ? `${outdatedCount} reason(s) may be outdated after a rating change` : 'No outdated reasons' },
  ];
  const failedChecks = checklist.filter((c) => !c.ok).length;

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const historyFor = (kraId: string) => (review.returnRequests || []).filter((r) => r.kraIds.includes(kraId));

  const hasOverall = strengths || improvements || managerComments || review.hodOverallComments || review.selfStrengths || review.selfImprovements;

  const scores = [
    { label: 'Employee (self)', value: review.selfScore },
    { label: 'Manager', value: managerScore },
    { label: 'HOD', value: hodScore },
  ];

  return (
    <div className="space-y-5">
      {/* Score summary */}
      <div className="space-y-3">
        <div className="max-w-prose">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Final review</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Every role's ratings and notes in one place.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Final score, manager and HOD average</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="tabular-nums">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{finalScore ? finalScore.toFixed(2) : '—'}</span>
                <span className="text-xs text-slate-400"> / 5</span>
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${bracket.cls}`}>{bracket.label}</span>
            </div>
          </div>
          {scores.map((s) => (
            <div key={s.label}>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
              <div className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5">{s.value ? s.value.toFixed(2) : '—'}</div>
            </div>
          ))}
          <p className="text-xs text-slate-600 dark:text-slate-400 basis-full sm:basis-auto sm:ml-auto">
            {disagreementCount > 0 ? `Manager and HOD disagree on ${disagreementCount} KRA(s).` : 'Manager and HOD broadly agree.'}
            {returnCount > 0 ? ` Returned ${returnCount} time${returnCount === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
      </div>

      {/* KRA comparison table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap text-xs">
          <h4 className="font-bold text-slate-900 dark:text-white">Ratings by KRA</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={onlyDisagreements} onChange={(e) => setOnlyDisagreements(e.target.checked)} className="rounded border-slate-300" />
              Only disagreements
            </label>
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={sortByGap} onChange={(e) => setSortByGap(e.target.checked)} className="rounded border-slate-300" />
              Biggest disagreement first
            </label>
            {canReturn && (
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onReturnSelected!(Array.from(selected))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Return selected ({selected.size})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
              <tr>
                {canReturn && (
                  <th className="pl-4 py-2 w-6">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-3 py-2 font-semibold">KRA</th>
                <th className="px-3 py-2 font-semibold">Weight</th>
                <th className="px-3 py-2 font-semibold">Employee (self)</th>
                <th className="px-3 py-2 font-semibold">Manager</th>
                <th className="px-3 py-2 font-semibold">HOD</th>
                <th className="px-3 py-2 font-semibold">Final</th>
                <th className="px-3 py-2 font-semibold">Manager vs HOD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ k, idx, mgr, hod, final, gap }) => {
                const isOpen = expanded.has(k.id);
                const rowTone = gap >= 3 ? 'bg-rose-50/70 dark:bg-rose-950/20' : gap >= 2 ? 'bg-amber-50/70 dark:bg-amber-950/20' : '';
                const staleWho = outdated.get(k.id);
                const history = historyFor(k.id);
                return (
                  <React.Fragment key={k.id}>
                    <tr className={`${rowTone} hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer`} onClick={() => toggle(expanded, k.id, setExpanded)}>
                      {canReturn && (
                        <td className="pl-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(k.id)}
                            onChange={() => toggle(selected, k.id, setSelected)}
                            aria-label={`Select ${k.kraName || k.title} to return`}
                            className="rounded border-slate-300 text-amber-600 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        {/* No onClick: the click bubbles to the row, which toggles the details */}
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className="flex items-center gap-1.5 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />}
                          <span className="text-slate-400 font-semibold tabular-nums">{idx + 1}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{k.kraName || k.title}</span>
                        </button>
                        {(history.length > 0 || staleWho) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 ml-5 text-[11px]">
                            {history.length > 0 && (
                              <span className="text-slate-500 dark:text-slate-400">
                                Returned {history.length} time{history.length === 1 ? '' : 's'}
                              </span>
                            )}
                            {staleWho && (
                              <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                {Array.from(staleWho).map((w) => (w === 'HOD' ? 'HOD' : 'Manager')).join(' and ')} reason may be outdated
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{k.weight}%</td>
                      <td className="px-3 py-2.5"><RatingCell value={k.selfRating} /></td>
                      <td className="px-3 py-2.5"><RatingCell value={mgr} /></td>
                      <td className="px-3 py-2.5"><RatingCell value={hod} /></td>
                      <td className="px-3 py-2.5"><RatingCell value={final} emphasis /></td>
                      <td className="px-3 py-2.5">
                        {!mgr || !hod ? (
                          <span className="text-slate-400">—</span>
                        ) : gap === 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Agree</span>
                        ) : (
                          <span className={gap >= 2 ? 'text-rose-700 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                            {gap} point{gap === 1 ? '' : 's'} apart
                          </span>
                        )}
                      </td>
                    </tr>
                    <AnimatePresence initial={false}>
                    {isOpen && (
                      <tr key="details" className="bg-slate-50/80 dark:bg-slate-900/40">
                        <td colSpan={canReturn ? 8 : 7} className="p-0">
                          <m.div variants={accordionVariants} initial="collapsed" animate="expanded" exit="collapsed">
                          <div className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <DetailColumn
                              title="Employee (self)"
                              rating={k.selfRating}
                              reason={k.selfJustification}
                              achievement={k.selfAchievement}
                              comments={k.selfComments}
                            />
                            <DetailColumn
                              title="Manager"
                              rating={k.rating}
                              reason={k.ratingJustification}
                              achievement={k.achievement}
                              comments={k.comments}
                              warning={staleWho?.has('MANAGER') ? 'Reason not updated after the rating changed' : undefined}
                            />
                            <DetailColumn
                              title="HOD"
                              rating={k.hodRating}
                              reason={k.hodJustification}
                              achievement={k.hodAchievement}
                              comments={k.hodComments}
                              warning={staleWho?.has('HOD') ? 'Reason not updated after the rating changed' : undefined}
                            />
                          </div>
                          {history.length > 0 && (
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="font-semibold text-slate-700 dark:text-slate-300">Return history</div>
                              {history.map((r) => {
                                const change = r.changes?.find((c) => c.kraId === k.id);
                                return (
                                  <p key={r.id} className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {new Date(r.createdAt).toLocaleDateString()}, {r.returnedByRole} ({r.returnedByName}) returned it to the{' '}
                                      {r.target === 'HOD' ? 'HOD' : 'Manager'}:
                                    </span>{' '}
                                    {r.kraComments[k.id] || r.reason}
                                    {change && (
                                      <span className="text-indigo-700 dark:text-indigo-300">
                                        {'. '}
                                        {change.before !== change.after
                                          ? `Rating changed from ${change.before || 'none'} to ${change.after}`
                                          : change.kept
                                          ? `Rating kept at ${change.after}`
                                          : 'Rating unchanged'}
                                        {change.reply ? `, reply: “${change.reply}”` : ''}
                                      </span>
                                    )}
                                    {r.status === 'OPEN' && <span className="text-amber-700 dark:text-amber-300">. Still open.</span>}
                                    {r.status === 'QUEUED' && <span className="text-slate-500">. Waiting for the Manager to finish.</span>}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                          </div>
                          </m.div>
                        </td>
                      </tr>
                    )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">No KRAs where manager and HOD disagree.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overall comments from every role */}
      {hasOverall && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-4 space-y-3 text-xs">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Overall comments</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <h5 className="font-semibold text-slate-900 dark:text-white">Employee (self)</h5>
              <Field label="Strengths" value={review.selfStrengths} />
              <Field label="To improve" value={review.selfImprovements} />
              <Field label="Obstacles" value={review.selfObstacles} />
              {!review.selfStrengths && !review.selfImprovements && !review.selfObstacles && <p className="text-slate-400">No comments.</p>}
            </div>
            <div className="space-y-1.5">
              <h5 className="font-semibold text-slate-900 dark:text-white">Manager</h5>
              <Field label="Strengths" value={strengths} />
              <Field label="Development areas" value={improvements} />
              <Field label="Overall summary" value={managerComments} />
              {!strengths && !improvements && !managerComments && <p className="text-slate-400">No comments.</p>}
            </div>
            <div className="space-y-1.5">
              <h5 className="font-semibold text-slate-900 dark:text-white">HOD</h5>
              {review.hodOverallComments ? (
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{review.hodOverallComments}</p>
              ) : (
                <p className="text-slate-400">No comments.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HR-only: checklist, remarks, sign-off */}
      {isHrOrAdmin && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 space-y-4">
          {!review.isClosed && (
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Before you approve</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                {checklist.map((c) => (
                  <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300 font-semibold'}`}>
                    {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="hr-remarks" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              HR remarks <span className="font-normal text-slate-500 dark:text-slate-400">(internal)</span>
            </label>
            <textarea
              id="hr-remarks"
              rows={2}
              disabled={review.isClosed}
              value={hrComments}
              onChange={(e) => setHrComments(e.target.value)}
              placeholder="Calibration notes, appraisal recommendation or increment approval"
              className={TEXTAREA_CLASS}
            />
          </div>

          {!review.isClosed && (
            <div className="p-4 rounded-xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-300" aria-hidden="true" />
                    HR sign-off
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stage <span className="font-semibold text-indigo-300">{review.status}</span>, final score{' '}
                    <span className="font-bold text-white tabular-nums">{finalScore.toFixed(2)} / 5</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {review.status === 'HR_COMPLETED' ? (
                    <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      HR approved
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onOpenStatusModal('HR_COMPLETED')}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Approve (HR)
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onOpenStatusModal('CLOSED')}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    Final lock & close
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-2.5">
                {failedChecks > 0 && (
                  <span className="text-amber-300 font-semibold">
                    {failedChecks} check{failedChecks === 1 ? '' : 's'} above need{failedChecks === 1 ? 's' : ''} attention.{' '}
                  </span>
                )}
                {review.status === 'HR_COMPLETED' ? (
                  <>HR calibration is approved. Select <strong>Final lock & close</strong> to permanently lock and archive this evaluation.</>
                ) : (
                  <>Select <strong>Approve (HR)</strong> to approve calibration, or <strong>Final lock & close</strong> to permanently complete and archive this evaluation.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
