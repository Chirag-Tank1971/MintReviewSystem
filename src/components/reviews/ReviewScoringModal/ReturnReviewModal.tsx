import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Loader2, AlertTriangle, Save, Check, X } from 'lucide-react';
import {
  EmployeeReview,
  ReviewKraSnapshot,
  ReturnPolicy,
  ReturnReasonCode,
  ReturnSelection,
  ReturnSendTarget,
  RETURN_REASON_TEMPLATES,
} from '../../../types';
import { api } from '../../../services/api';
import { useModalAnimation } from '../../../hooks/useModalAnimation';
import { getReturnCount } from './returnUtils';

interface ReturnReviewModalProps {
  isOpen: boolean;
  review: EmployeeReview;
  snapshots: ReviewKraSnapshot[];
  /** 'HOD' returns always go to the Manager; 'HR' can choose Manager, HOD, or both (Manager first, then HOD). */
  mode: 'HOD' | 'HR';
  /** True when the caller is HR / Super Admin (never blocked by the return limit). */
  isPrivileged: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (selection: ReturnSelection) => void;
  /** KRAs to pre-select (e.g. ticked in the Final Review table). Overrides a saved draft's selection. */
  initialKraIds?: string[];
}

const RATING_PILL_STYLES = {
  self: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  manager: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  hod: 'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800',
} as const;

/** One person's rating, colour-coded by who gave it (same colours as the scoring steps). */
const RatingPill: React.FC<{ who: keyof typeof RATING_PILL_STYLES; label: string; value?: number }> = ({ who, label, value }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${RATING_PILL_STYLES[who]}`}>
    <span className="font-medium">{label}</span>
    <b>{value ? `${value}` : 'Not rated'}</b>
  </span>
);

export const ReturnReviewModal: React.FC<ReturnReviewModalProps> = ({
  isOpen,
  review,
  snapshots,
  mode,
  isPrivileged,
  saving,
  onClose,
  onConfirm,
  initialKraIds,
}) => {
  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({ isOpen, onClose });

  const [target, setTarget] = useState<ReturnSendTarget>('MANAGER');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** HOD's KRAs when returning to both (`selected` then holds the Manager's). */
  const [hodSelected, setHodSelected] = useState<Set<string>>(new Set());
  const [kraComments, setKraComments] = useState<Record<string, string>>({});
  const [reasonCodes, setReasonCodes] = useState<ReturnReasonCode[]>([]);
  const [reason, setReason] = useState('');
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'restored' | 'error'>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Used to bring the first missing field into view when the return is submitted incomplete
  const selectionRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const effectiveTarget: ReturnSendTarget = mode === 'HOD' ? 'MANAGER' : target;
  const isBoth = effectiveTarget === 'BOTH';
  const hodName = review.hodName || 'HOD';
  const recipientName =
    effectiveTarget === 'BOTH' ? `${review.managerName} & ${hodName}` : effectiveTarget === 'HOD' ? hodName : review.managerName;

  // Load policy + any saved draft whenever the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setTouched(false);
    setShowErrors(false);
    setDraftStatus('idle');
    setDraftSavedAt(null);
    setTarget('MANAGER');
    setSelected(new Set());
    setHodSelected(new Set());
    setKraComments({});
    setReasonCodes([]);
    setReason('');

    Promise.all([api.getReturnPolicy().catch(() => null), api.getReturnDraft(review.id).catch(() => ({ draft: null }))])
      .then(([pol, draftRes]) => {
        if (cancelled) return;
        setPolicy(pol);
        const draft = draftRes?.draft;
        if (draft) {
          const known = new Set(snapshots.map((k) => k.id));
          setTarget(mode === 'HOD' ? 'MANAGER' : draft.target);
          setSelected(new Set(draft.kraIds.filter((id) => known.has(id))));
          setHodSelected(new Set((draft.hodKraIds || []).filter((id) => known.has(id))));
          setKraComments(draft.kraComments || {});
          setReasonCodes(draft.reasonCodes || []);
          setReason(draft.reason || '');
          setDraftSavedAt(draft.savedAt);
          setDraftStatus('restored');
        }
        if (initialKraIds && initialKraIds.length > 0) {
          setSelected(new Set(initialKraIds));
          setTouched(true);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, review.id]);

  const selection: ReturnSelection = useMemo(
    () => ({
      target: effectiveTarget,
      kraIds: snapshots.filter((k) => selected.has(k.id)).map((k) => k.id),
      hodKraIds: isBoth ? snapshots.filter((k) => hodSelected.has(k.id)).map((k) => k.id) : undefined,
      kraComments: Object.fromEntries(
        Object.entries(kraComments).filter(([id, v]) => (selected.has(id) || (isBoth && hodSelected.has(id))) && v.trim())
      ),
      reasonCodes,
      reason,
    }),
    [effectiveTarget, isBoth, snapshots, selected, hodSelected, kraComments, reasonCodes, reason]
  );

  // Autosave the selection (debounced) once the reviewer has changed something.
  useEffect(() => {
    if (!isOpen || !touched) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setDraftStatus('saving');
      try {
        const res = await api.saveReturnDraft(review.id, selection);
        setDraftSavedAt(res.draft.savedAt);
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
      }
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [selection, touched, isOpen, review.id]);

  useEffect(() => {
    if (!isMounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMounted, saving, handleClose]);

  if (!isMounted) return null;

  const mark = () => setTouched(true);
  const toggleKra = (id: string, forHod = false) => {
    mark();
    (forHod ? setHodSelected : setSelected)((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleReasonCode = (code: ReturnReasonCode) => {
    mark();
    if (reasonCodes.includes(code)) {
      setReasonCodes(reasonCodes.filter((c) => c !== code));
      return;
    }
    setReasonCodes([...reasonCodes, code]);
    const tmpl = RETURN_REASON_TEMPLATES.find((t) => t.code === code);
    if (tmpl?.text && !reason.includes(tmpl.text)) {
      setReason(reason.trim() ? `${reason.trim()} ${tmpl.text}` : tmpl.text);
    }
  };

  const discardDraft = async () => {
    await api.deleteReturnDraft(review.id).catch(() => undefined);
    setSelected(new Set());
    setHodSelected(new Set());
    setKraComments({});
    setReasonCodes([]);
    setReason('');
    setDraftSavedAt(null);
    setDraftStatus('idle');
    setTouched(false);
  };

  const saveDraftNow = async () => {
    setDraftStatus('saving');
    try {
      const res = await api.saveReturnDraft(review.id, selection);
      setDraftSavedAt(res.draft.savedAt);
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
    }
  };

  // Return-limit messaging
  const priorReturns = getReturnCount(review);
  const thisRound = priorReturns + 1;
  const overLimit = policy ? priorReturns >= policy.maxReturnsPerReview : false;
  const blocked = overLimit && policy?.returnLimitAction === 'BLOCK' && !isPrivileged;

  const selectedCount = selection.kraIds.length;
  const hodCount = selection.hodKraIds?.length || 0;
  const allSelected = selectedCount === snapshots.length && snapshots.length > 0;
  const missingSelection = isBoth ? selectedCount === 0 || hodCount === 0 : selectedCount === 0;
  const missingReason = !reason.trim();
  const canConfirm = !saving && !blocked && !missingSelection && !missingReason && !loading;

  const kras = (n: number) => `${n} KRA${n === 1 ? '' : 's'}`;
  const confirmLabel = isBoth
    ? `Return ${kras(selectedCount)} to Manager, then ${kras(hodCount)} to HOD`
    : allSelected
    ? `Return full review to ${recipientName}`
    : `Return ${selectedCount || ''} KRA${selectedCount === 1 ? '' : 's'} to ${recipientName}`;

  const selectedWeight = snapshots.filter((k) => selected.has(k.id)).reduce((s, k) => s + (Number(k.weight) || 0), 0);

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-clip ${cardClass}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Return Review to {recipientName}</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isBoth
                ? `Pick KRAs for each person. ${review.managerName} re-evaluates theirs first, then the review goes to ${hodName} for theirs, then back to HR. Everything else stays locked.`
                : `Select the KRAs that need re-evaluation. Only these will be editable for ${recipientName}; everything else stays locked.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading return policy and saved draft…
            </div>
          )}

          {/* Return limit / round info */}
          {policy && (
            <div
              className={`text-xs rounded-xl px-3 py-2 border flex items-start gap-2 ${
                blocked
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : overLimit
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {(blocked || overLimit) && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>
                {blocked
                  ? `This review has already been returned ${priorReturns} times (limit ${policy.maxReturnsPerReview}). Please submit it to HR and raise your concerns there.`
                  : overLimit
                  ? `This will be return #${thisRound} — above the limit of ${policy.maxReturnsPerReview}. ${
                      isPrivileged ? 'Allowed for HR.' : 'HR will be alerted.'
                    }`
                  : isBoth
                  ? `Return #${thisRound} of ${policy.maxReturnsPerReview} allowed (a return to both counts once). Each person gets ${policy.returnSlaDays} day${
                      policy.returnSlaDays === 1 ? '' : 's'
                    } once it reaches them before reminders start.`
                  : `Return #${thisRound} of ${policy.maxReturnsPerReview} allowed. ${recipientName} will have ${policy.returnSlaDays} day${
                      policy.returnSlaDays === 1 ? '' : 's'
                    } to respond before reminders start.`}
              </span>
            </div>
          )}

          {/* Draft status */}
          {draftStatus === 'restored' && draftSavedAt && (
            <div className="text-xs rounded-xl px-3 py-2 border bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 flex items-center justify-between gap-2">
              <span>Restored your draft from {new Date(draftSavedAt).toLocaleString()}.</span>
              <button type="button" onClick={discardDraft} className="font-semibold underline cursor-pointer">
                Discard draft
              </button>
            </div>
          )}

          {/* Target selector (HR only) */}
          {mode === 'HR' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Send back to</label>
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {(['MANAGER', 'HOD', 'BOTH'] as ReturnSendTarget[]).map((t) => {
                  const disabled = t !== 'MANAGER' && !review.hodId;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={disabled}
                      title={disabled ? 'No HOD is configured for this employee' : undefined}
                      onClick={() => {
                        mark();
                        setTarget(t);
                      }}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        target === t
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {t === 'MANAGER'
                        ? `Manager (${review.managerName})`
                        : t === 'HOD'
                        ? `HOD ${review.hodName ? `(${review.hodName})` : ''}`
                        : 'Both (Manager, then HOD)'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* KRA checklist */}
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                KRAs to re-evaluate{' '}
                <span className="normal-case font-semibold text-slate-700 dark:text-slate-200">
                  · {isBoth
                    ? `${selectedCount} for Manager · ${hodCount} for HOD`
                    : `${selectedCount} of ${snapshots.length} selected${selectedCount > 0 ? ` (${selectedWeight}% of score)` : ''}`}
                </span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    mark();
                    setSelected(new Set(snapshots.map((k) => k.id)));
                  }}
                  className="font-semibold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                >
                  {isBoth ? 'All for Manager' : 'Select all'}
                </button>
                {isBoth && (
                  <button
                    type="button"
                    onClick={() => {
                      mark();
                      setHodSelected(new Set(snapshots.map((k) => k.id)));
                    }}
                    className="font-semibold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
                  >
                    All for HOD
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    mark();
                    setSelected(new Set());
                    setHodSelected(new Set());
                  }}
                  className="font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              ref={selectionRef}
              className={`rounded-xl border divide-y divide-slate-100 dark:divide-slate-800 scroll-mt-4 ${
                showErrors && missingSelection ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {snapshots.map((k, idx) => {
                const isMgrSel = selected.has(k.id);
                const isHodSel = isBoth && hodSelected.has(k.id);
                const isSel = isMgrSel || isHodSel;
                const RowTag = isBoth ? 'div' : 'label';
                return (
                  <div key={k.id} className={`px-3 py-2.5 ${isSel ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                    <RowTag className={`flex items-start gap-3 ${isBoth ? '' : 'cursor-pointer'}`}>
                      {isBoth ? (
                        <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isMgrSel}
                              onChange={() => toggleKra(k.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            Manager
                          </label>
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isHodSel}
                              onChange={() => toggleKra(k.id, true)}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                            />
                            HOD
                          </label>
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isMgrSel}
                          onChange={() => toggleKra(k.id)}
                          className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">{k.kraName || k.title}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-bold">
                            {k.weight}%
                          </span>
                        </div>
                        <div className="mt-1 flex gap-1.5 flex-wrap">
                          <RatingPill who="self" label="Employee (self)" value={k.selfRating} />
                          <RatingPill who="manager" label="Manager" value={k.rating} />
                          <RatingPill who="hod" label="HOD" value={k.hodRating} />
                        </div>
                      </div>
                    </RowTag>
                    {isSel && (
                      <textarea
                        rows={2}
                        value={kraComments[k.id] || ''}
                        onChange={(e) => {
                          mark();
                          setKraComments((prev) => ({ ...prev, [k.id]: e.target.value }));
                        }}
                        placeholder={`What should ${
                          isBoth ? (isMgrSel && isHodSel ? 'the Manager and HOD' : isHodSel ? hodName : review.managerName) : recipientName
                        } look at on this KRA? (optional)`}
                        className="mt-2 ml-7 w-[calc(100%-1.75rem)] text-xs p-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {showErrors && missingSelection && (
              <p className="text-[11px] text-rose-600 mt-1">
                {isBoth ? 'Pick at least one KRA for the Manager and one for the HOD.' : 'Select at least one KRA (or Select all).'}
              </p>
            )}
          </div>

          {/* Reason templates */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Reason</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {RETURN_REASON_TEMPLATES.map((t) => {
                const active = reasonCodes.includes(t.code);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggleReasonCode(t.code)}
                    className={`text-[11px] px-2 py-1 rounded-full border font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                      active
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <textarea
              ref={reasonRef}
              rows={3}
              value={reason}
              onChange={(e) => {
                mark();
                setReason(e.target.value);
              }}
              placeholder="Overall return instructions (required)…"
              aria-label="Return reason"
              aria-invalid={showErrors && missingReason}
              aria-describedby={showErrors && missingReason ? 'return-reason-error' : undefined}
              className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 ${
                showErrors && missingReason ? 'border-rose-300 dark:border-rose-800' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            {showErrors && missingReason && (
              <p id="return-reason-error" className="text-[11px] text-rose-600 mt-1">
                A return reason is required.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraftNow}
              disabled={saving || draftStatus === 'saving'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 font-semibold cursor-pointer disabled:opacity-60"
            >
              {draftStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save draft
            </button>
            {draftStatus === 'saved' && draftSavedAt && <span>Draft saved {new Date(draftSavedAt).toLocaleTimeString()}</span>}
            {draftStatus === 'error' && <span className="text-rose-600">Couldn’t save draft</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || blocked || loading}
              onClick={() => {
                if (!canConfirm) {
                  setShowErrors(true);
                  // Take HR to the first thing that's missing, so the error isn't hidden below the fold
                  if (missingSelection) {
                    selectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else if (missingReason && reasonRef.current) {
                    reasonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    reasonRef.current.focus({ preventScroll: true });
                  }
                  return;
                }
                onConfirm(selection);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
