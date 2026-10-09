import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ClipboardList,
  Calendar,
  Building2,
  Briefcase,
  Send,
  Loader2,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  Ban,
  Target,
  Clock,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import {
  PerformanceImprovementPlan,
  User,
  PIP_GOAL_RATING_LABELS,
  PipGoalRatingValue,
  PIP_FAILURE_RESOLUTION_LABELS,
  PipFailureResolutionAction,
} from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { StatusBadge } from './ui/StatusBadge';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { printPipLetter } from '../utils/pipLetterExport';

interface PipDetailModalProps {
  plan: PerformanceImprovementPlan;
  currentUser?: User | null;
  onClose: () => void;
  onChanged: (updated: PerformanceImprovementPlan) => void;
}

const STATUS_TONE: Record<PerformanceImprovementPlan['status'], 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  DRAFT: 'default',
  ACTIVE: 'primary',
  EXTENDED: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'default',
};

export const PipDetailModal: React.FC<PipDetailModalProps> = ({ plan, currentUser, onClose, onChanged }) => {
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInRatings, setCheckInRatings] = useState<Record<string, PipGoalRatingValue>>({});
  const [ackComments, setAckComments] = useState('');
  const [outcomeDecision, setOutcomeDecision] = useState<'SUCCEEDED' | 'FAILED' | 'EXTENDED' | ''>('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [extendDays, setExtendDays] = useState<number | ''>(15);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [failureAction, setFailureAction] = useState<PipFailureResolutionAction | ''>('');
  const [failureNotes, setFailureNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ onClose });

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, busy, handleClose]);

  const role = currentUser?.role;
  const myEmployeeId = currentUser?.employeeId;
  const isHrOrAdmin = role === 'SUPER_ADMIN' || role === 'HR';
  const isTheEmployee = plan.employeeId === myEmployeeId;
  const isManagerOrHod =
    ((role === 'MANAGER' || role === 'REPORTING_MANAGER') && plan.managerId === myEmployeeId) ||
    (role === 'HOD' && plan.hodId === myEmployeeId);
  const isActive = plan.status === 'ACTIVE' || plan.status === 'EXTENDED';

  const canCheckIn = isActive && (isManagerOrHod || isHrOrAdmin);
  // Only the employee's manager/HOD give goal-level progress ratings — HR/Admin can still
  // check in (e.g. to log a formal note) but the rating itself is the line manager's call.
  const canRateGoals = canCheckIn && isManagerOrHod;

  // Latest rating per goal, derived from the check-in history (most recent check-in that
  // rated a given goal wins) — informational for HR when deciding the outcome, never used to
  // auto-decide it.
  const latestGoalRatings = React.useMemo(() => {
    const map = new Map<string, { rating: PipGoalRatingValue; byName: string; date: string }>();
    for (const c of plan.checkIns) {
      for (const r of c.goalRatings || []) {
        map.set(r.goalId, { rating: r.rating, byName: c.byName, date: c.date });
      }
    }
    return map;
  }, [plan.checkIns]);
  const canAcknowledge = isActive && isTheEmployee && !plan.employeeAcknowledgement?.acknowledged;
  const canRecordOutcome = isActive && isHrOrAdmin;
  const canCancel = (plan.status === 'DRAFT' || isActive) && isHrOrAdmin;
  const canPublish = plan.status === 'DRAFT' && isHrOrAdmin;
  const canResolveFailure = plan.status === 'FAILED' && !plan.failureResolution && isHrOrAdmin;

  if (!isMounted) return null;

  const handlePublish = async () => {
    setBusy('publish');
    try {
      const updated = await api.publishPip(plan.id);
      toast.success(`Plan published for ${plan.employeeName}.`, 'Plan published');
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish plan.', 'Publish failed');
    } finally {
      setBusy(null);
    }
  };

  const handleAddCheckIn = async () => {
    if (checkInNote.trim().length < 3) {
      toast.warning('Check-in notes must be at least 3 characters.', 'Validation error');
      return;
    }
    setBusy('checkin');
    try {
      const goalRatings = Object.entries(checkInRatings).map(([goalId, rating]) => ({ goalId, rating }));
      const updated = await api.addPipCheckIn(plan.id, checkInNote.trim(), goalRatings.length > 0 ? goalRatings : undefined);
      setCheckInNote('');
      setCheckInRatings({});
      toast.success('Check-in logged.', 'Check-in added');
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add check-in.', 'Check-in failed');
    } finally {
      setBusy(null);
    }
  };

  const handleAcknowledge = async () => {
    setBusy('acknowledge');
    try {
      const updated = await api.acknowledgePip(plan.id, ackComments.trim() || undefined);
      toast.success('You have acknowledged this plan.', 'Acknowledged');
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge plan.', 'Acknowledgement failed');
    } finally {
      setBusy(null);
    }
  };

  const handleRecordOutcome = async () => {
    if (!outcomeDecision) {
      toast.warning('Please select an outcome.', 'Validation error');
      return;
    }
    if (outcomeDecision === 'EXTENDED' && (extendDays === '' || Number(extendDays) <= 0)) {
      toast.warning('Please provide the number of additional days.', 'Validation error');
      return;
    }
    setBusy('outcome');
    try {
      const updated = await api.recordPipOutcome(plan.id, {
        decision: outcomeDecision,
        notes: outcomeNotes.trim() || undefined,
        additionalDays: outcomeDecision === 'EXTENDED' ? Number(extendDays) : undefined,
      });
      toast.success(`Outcome recorded: ${outcomeDecision}.`, 'Outcome recorded');
      setOutcomeDecision('');
      setOutcomeNotes('');
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record outcome.', 'Outcome failed');
    } finally {
      setBusy(null);
    }
  };

  const handleResolveFailure = async () => {
    if (!failureAction) {
      toast.warning('Please select what happened next.', 'Validation error');
      return;
    }
    setBusy('resolve-failure');
    try {
      const updated = await api.resolvePipFailure(plan.id, {
        action: failureAction,
        notes: failureNotes.trim() || undefined,
      });
      toast.success('Next-step decision recorded.', 'Resolved');
      setFailureAction('');
      setFailureNotes('');
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record decision.', 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (cancelReason.trim().length < 3) {
      toast.warning('A cancellation reason is required.', 'Validation error');
      return;
    }
    setBusy('cancel');
    try {
      const updated = await api.cancelPip(plan.id, cancelReason.trim());
      toast.success('Plan cancelled.', 'Plan cancelled');
      setShowCancelForm(false);
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel plan.', 'Cancellation Failed');
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9995] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${cardClass}`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ClipboardList className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{plan.employeeName}'s Improvement Plan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{plan.employeeCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={plan.status} tone={STATUS_TONE[plan.status]} />
            <button
              type="button"
              onClick={handleClose}
              disabled={!!busy}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5" />
              {plan.departmentName || 'General'}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Briefcase className="w-3.5 h-3.5" />
              {plan.designationName || 'Employee'}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(plan.startDate).toLocaleDateString()} — {new Date(plan.endDate).toLocaleDateString()}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Reason</p>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{plan.reason}</p>
            {plan.category && (
              <span className="inline-block mt-2 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {plan.category}
              </span>
            )}
          </div>

          {plan.employeeAcknowledgement?.acknowledged && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Acknowledged by {plan.employeeName} on {new Date(plan.employeeAcknowledgement.acknowledgedAt!).toLocaleDateString()}
              {plan.employeeAcknowledgement.comments && <span> — "{plan.employeeAcknowledgement.comments}"</span>}
            </div>
          )}

          {plan.outcome && (
            <div
              className={`flex items-start gap-2 p-2.5 rounded-xl border text-[11px] ${
                plan.outcome.decision === 'FAILED'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : plan.outcome.decision === 'SUCCEEDED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <strong>Outcome: {plan.outcome.decision}</strong> by {plan.outcome.decidedByName} on{' '}
                {new Date(plan.outcome.decidedAt).toLocaleDateString()}
                {plan.outcome.notes && <p className="mt-0.5">{plan.outcome.notes}</p>}
              </div>
            </div>
          )}

          {plan.status === 'FAILED' && plan.failureResolution && (
            <div className="flex items-start gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <strong>Next Step: {PIP_FAILURE_RESOLUTION_LABELS[plan.failureResolution.action]}</strong> — recorded by{' '}
                {plan.failureResolution.resolvedByName} on {new Date(plan.failureResolution.resolvedAt).toLocaleDateString()}
                {plan.failureResolution.notes && <p className="mt-0.5">{plan.failureResolution.notes}</p>}
              </div>
            </div>
          )}

          {canResolveFailure && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl space-y-2.5">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Record next-step decision
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                This clears the "Not Successful" alert from {plan.employeeName}'s dashboard once recorded.
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PIP_FAILURE_RESOLUTION_LABELS) as PipFailureResolutionAction[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setFailureAction(a)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      failureAction === a
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {PIP_FAILURE_RESOLUTION_LABELS[a]}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={failureNotes}
                onChange={(e) => setFailureNotes(e.target.value)}
                placeholder="Notes (optional)..."
                className="w-full text-xs p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={handleResolveFailure}
                disabled={!!busy || !failureAction}
                className="w-full px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {busy === 'resolve-failure' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Decision
              </button>
            </div>
          )}

          {plan.status === 'CANCELLED' && plan.cancelledReason && (
            <div className="flex items-start gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300">
              <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                Cancelled by {plan.cancelledByName} on {new Date(plan.cancelledAt!).toLocaleDateString()}: {plan.cancelledReason}
              </div>
            </div>
          )}

          {/* Goals */}
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Target className="w-3.5 h-3.5" />
              Improvement goals
            </p>
            <div className="space-y-1.5">
              {plan.goals.map((g, idx) => {
                const latest = latestGoalRatings.get(g.id);
                return (
                  <div key={g.id} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-400 dark:text-slate-500 font-bold shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-slate-800 dark:text-slate-100">{g.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {g.targetMetric && <span>{g.targetMetric}</span>}
                        {g.dueDate && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            Due {new Date(g.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {latest && (
                      <span
                        title={`Rated by ${latest.byName} on ${new Date(latest.date).toLocaleDateString()}`}
                        className={`shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-full ${
                          latest.rating >= 5
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : latest.rating >= 3
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {PIP_GOAL_RATING_LABELS[latest.rating]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Check-ins */}
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Check-Ins ({plan.checkIns.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {plan.checkIns.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No check-ins logged yet.</p>
              ) : (
                [...plan.checkIns].reverse().map((c) => (
                  <div key={c.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{c.byName}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{new Date(c.date).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{c.notes}</p>
                    {c.goalRatings && c.goalRatings.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.goalRatings.map((r) => {
                          const goal = plan.goals.find((g) => g.id === r.goalId);
                          return (
                            <span
                              key={r.goalId}
                              className="px-1.5 py-0.5 text-[11px] font-medium rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                            >
                              {goal ? goal.description.slice(0, 24) + (goal.description.length > 24 ? '…' : '') : 'Goal'}: {PIP_GOAL_RATING_LABELS[r.rating]}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {canCheckIn && (
              <div className="mt-2 space-y-2">
                {canRateGoals && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Rate goal progress (optional)
                    </p>
                    {plan.goals.map((g) => (
                      <div key={g.id} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 flex-1 truncate">{g.description}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {([1, 2, 3, 4, 5] as PipGoalRatingValue[]).map((val) => (
                            <button
                              key={val}
                              type="button"
                              title={PIP_GOAL_RATING_LABELS[val]}
                              onClick={() =>
                                setCheckInRatings((prev) => {
                                  const next = { ...prev };
                                  if (next[g.id] === val) {
                                    delete next[g.id];
                                  } else {
                                    next[g.id] = val;
                                  }
                                  return next;
                                })
                              }
                              className={`w-6 h-6 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${
                                checkInRatings[g.id] === val
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={checkInNote}
                    onChange={(e) => setCheckInNote(e.target.value)}
                    placeholder="Log a check-in note — visible to the employee immediately..."
                    className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCheckIn}
                    disabled={!!busy}
                    className="px-3 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 shrink-0 flex items-center gap-1.5"
                  >
                    {busy === 'checkin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Employee acknowledgement */}
          {canAcknowledge && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                Please review the goals above and acknowledge this plan.
              </p>
              <textarea
                rows={2}
                value={ackComments}
                onChange={(e) => setAckComments(e.target.value)}
                placeholder="Optional comments..."
                className="w-full text-xs p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={!!busy}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {busy === 'acknowledge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Acknowledge Plan
              </button>
            </div>
          )}

          {/* HR/Admin outcome recording */}
          {canRecordOutcome && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Record outcome</p>
              {latestGoalRatings.size > 0 && (
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Latest manager/HOD goal ratings (informational — decision is yours)
                  </p>
                  {plan.goals.map((g) => {
                    const latest = latestGoalRatings.get(g.id);
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{g.description}</span>
                        <span className={`shrink-0 font-semibold ${
                          !latest ? 'text-slate-400 dark:text-slate-500' :
                          latest.rating >= 5 ? 'text-emerald-600 dark:text-emerald-400' :
                          latest.rating >= 3 ? 'text-amber-600 dark:text-amber-400' :
                          'text-rose-600 dark:text-rose-400'
                        }`}>
                          {latest ? PIP_GOAL_RATING_LABELS[latest.rating] : 'Not rated'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(['SUCCEEDED', 'EXTENDED', 'FAILED'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOutcomeDecision(d)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      outcomeDecision === d
                        ? d === 'SUCCEEDED'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : d === 'FAILED'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {outcomeDecision === 'EXTENDED' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Additional days</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <textarea
                rows={2}
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Notes (optional)..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleRecordOutcome}
                disabled={!!busy || !outcomeDecision}
                className="w-full px-4 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {busy === 'outcome' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Outcome
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2.5 p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            {canCancel &&
              (showCancelForm ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Cancellation reason..."
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 w-52"
                  />
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!!busy}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {busy === 'cancel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelForm(true)}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Cancel plan
                </button>
              ))}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (!printPipLetter(plan)) toast.warning('Allow pop-ups for this site to open the letter.', 'Pop-up blocked');
              }}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Open the formal PIP letter to print or save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              Print letter
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
            {canPublish && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={!!busy}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {busy === 'publish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Publish & Notify Employee
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
