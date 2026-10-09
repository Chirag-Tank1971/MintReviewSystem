import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Sparkles,
  HelpCircle,
  Award,
  Layers,
  FileText,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { EmployeeReview, ReviewKraSnapshot } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { RatingJustificationInput } from './reviews/RatingJustificationInput';

interface SelfAssessmentModalProps {
  review: EmployeeReview;
  onClose: () => void;
  onSuccess: (updatedReview: EmployeeReview) => void;
}

const RATING_DESCRIPTIONS: Record<number, { title: string; desc: string; color: string }> = {
  1: { title: 'Unsatisfactory', desc: 'Did not meet core deliverables; significant gaps.', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  2: { title: 'Needs Development', desc: 'Partially met targets; needs closer mentoring/support.', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  3: { title: 'Meets Expectations', desc: 'Consistently achieved committed sprint and quality goals.', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  4: { title: 'Exceeds Expectations', desc: 'Frequently surpassed targets; high quality and initiative.', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  5: { title: 'Outstanding Outperformer', desc: 'Exceptional strategic impact; sets organizational benchmark.', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

export const SelfAssessmentModal: React.FC<SelfAssessmentModalProps> = ({
  review,
  onClose,
  onSuccess,
}) => {
  const [kraStates, setKraStates] = useState<
    Array<{
      id: string;
      kraId?: string;
      kraName: string;
      title?: string;
      description?: string;
      targetSnapshot: string;
      measurementCriteria?: string;
      weight: number;
      selfRating: number;
      selfAchievement: string;
      selfComments: string;
      selfJustification?: string;
      rating?: number;
      achievement?: string;
      comments?: string;
    }>
  >(() => {
    return (review.kraSnapshot || []).map((k) => ({
      id: k.id,
      kraId: k.kraId,
      kraName: k.kraName || k.title || 'Assigned KRA',
      title: k.title || k.kraName,
      description: k.description,
      targetSnapshot: k.targetSnapshot || 'Meet assigned quarterly milestone',
      measurementCriteria: k.measurementCriteria,
      weight: k.weight || 0,
      selfRating: k.selfRating || (k.rating ? k.rating : 3),
      selfAchievement: k.selfAchievement || k.achievement || '',
      selfComments: k.selfComments || '',
      selfJustification: k.selfJustification || '',
      rating: k.rating,
      achievement: k.achievement,
      comments: k.comments,
    }));
  });

  const [selfStrengths, setSelfStrengths] = useState(review.selfStrengths || '');
  const [selfImprovements, setSelfImprovements] = useState(review.selfImprovements || '');
  const [selfObstacles, setSelfObstacles] = useState(review.selfObstacles || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedKraId, setHighlightedKraId] = useState<string | null>(null);

  const missingJustificationsCount = useMemo(() => {
    return kraStates.filter(
      (k) => [1, 2, 5].includes(k.selfRating) && (!k.selfJustification || k.selfJustification.trim().length < 15)
    ).length;
  }, [kraStates]);

  const firstInvalidKra = useMemo(() => {
    return kraStates.find(
      (k) => [1, 2, 5].includes(k.selfRating) && (!k.selfJustification || k.selfJustification.trim().length < 15)
    );
  }, [kraStates]);

  const scrollToKra = (kraId: string) => {
    const el = document.getElementById(`self-kra-card-${kraId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const isClosed = review.isClosed;
  const isAlreadySubmitted = review.isSelfSubmitted;
  const hasManagerSubmitted = Boolean(review.submittedAt) || (review.status !== 'ASSIGNED' && review.status !== 'MANAGER_PENDING' && review.status !== 'DRAFT');
  const isReadOnly = isClosed || hasManagerSubmitted;

  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const handleAttemptCloseRef = useRef<() => void>(() => {});

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen: true,
    onClose,
  });

  const hasUnsavedChanges = useMemo(() => {
    if (isReadOnly) return false;
    if (selfStrengths !== (review.selfStrengths || '')) return true;
    if (selfImprovements !== (review.selfImprovements || '')) return true;
    if (selfObstacles !== (review.selfObstacles || '')) return true;

    const origMap = new Map((review.kraSnapshot || []).map((k) => [k.id, k]));
    for (const k of kraStates) {
      const orig = origMap.get(k.id) as any;
      if (!orig) return true;
      if ((k.selfRating || 0) !== (orig.selfRating || 0)) return true;
      if ((k.selfAchievement || '') !== (orig.selfAchievement || '')) return true;
      if ((k.selfComments || '') !== (orig.selfComments || '')) return true;
      if ((k.selfJustification || '') !== (orig.selfJustification || '')) return true;
    }
    return false;
  }, [isReadOnly, selfStrengths, selfImprovements, selfObstacles, kraStates, review]);

  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedAlert(true);
    } else {
      handleClose();
    }
  };

  handleAttemptCloseRef.current = handleAttemptClose;

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAttemptCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Calculate live weighted self score
  const calculatedSelfScore = Number(
    kraStates
      .reduce((sum, item) => sum + (item.selfRating * (item.weight || 0)) / 100, 0)
      .toFixed(2)
  );

  const handleRatingChange = (id: string, newRating: number) => {
    if (isReadOnly) return;
    setKraStates((prev) =>
      prev.map((k) => (k.id === id ? { ...k, selfRating: newRating } : k))
    );
  };

  const handleAchievementChange = (id: string, text: string) => {
    if (isReadOnly) return;
    setKraStates((prev) =>
      prev.map((k) => (k.id === id ? { ...k, selfAchievement: text } : k))
    );
  };

  const handleJustificationChange = (id: string, text: string) => {
    if (isReadOnly) return;
    setKraStates((prev) =>
      prev.map((k) => (k.id === id ? { ...k, selfJustification: text } : k))
    );
    if (highlightedKraId === id && text.trim().length >= 15) {
      setHighlightedKraId(null);
      setError(null);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (isReadOnly) return;
    try {
      setIsSubmitting(true);
      setError(null);

      // Validation if submitting
      if (!isDraft) {
        const unratedKra = kraStates.find((k) => !k.selfRating || k.selfRating < 1);
        if (unratedKra) {
          const warnMsg = `Please provide a self-rating for "${unratedKra.kraName || unratedKra.title}".`;
          setError(warnMsg);
          toast.warning(warnMsg, 'Self-rating required');
          setIsSubmitting(false);
          return;
        }

        const invalidJustification = kraStates.find(
          (k) => [1, 2, 5].includes(k.selfRating) && (!k.selfJustification || k.selfJustification.trim().length < 15)
        );
        if (invalidJustification) {
          const targetId = invalidJustification.id || (invalidJustification as any).kraId || '';
          const warnMsg = `Add a justification of at least 15 characters for "${invalidJustification.kraName || invalidJustification.title}", which you rated ${invalidJustification.selfRating}.`;
          setError(warnMsg);
          setHighlightedKraId(targetId);
          toast.warning(warnMsg, 'Mandatory justification required');
          setIsSubmitting(false);

          // Auto-scroll to the invalid KRA card smoothly
          setTimeout(() => {
            const el = document.getElementById(`self-kra-card-${targetId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
          return;
        }
      }

      const updated = await api.submitSelfAssessment(review.id, {
        kraSnapshot: kraStates as ReviewKraSnapshot[],
        selfStrengths,
        selfImprovements,
        selfObstacles,
        isDraft,
      });

      if (isDraft) {
        toast.info('Self-assessment draft saved.', 'Draft saved');
      } else {
        toast.success('Self-assessment submitted to your manager!', 'Evaluation submitted');
      }

      onSuccess(updated);
      handleClose();
    } catch (err: any) {
      console.error('Error submitting self evaluation:', err);
      const errMsg = err.message || 'Failed to submit self-assessment.';
      setError(errMsg);
      toast.error(errMsg, 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-clip my-auto ${cardClass}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isReadOnly ? 'Quarterly Review Breakdown' : isAlreadySubmitted ? 'Edit Self-Assessment' : 'Quarterly Self-Evaluation'}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  {review.reviewPeriodName}
                </span>
                {hasManagerSubmitted ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    ✓ Manager Evaluated
                  </span>
                ) : isAlreadySubmitted ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                    ✓ Submitted to Manager
                  </span>
                ) : null}
                {!isReadOnly && missingJustificationsCount > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>{missingJustificationsCount} Justification{missingJustificationsCount > 1 ? 's' : ''} Needed</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {review.employeeName} ({review.employeeCode}) • {review.designationName} • {review.departmentName}
              </p>
            </div>
          </div>

          <button
            onClick={handleAttemptClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasManagerSubmitted && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Evaluation submitted:</strong> Your reporting manager has submitted their evaluation for this quarterly review. Self-ratings and reflection are now locked and in read-only mode.
              </span>
            </div>
          )}

          {/* Quick Score Banner */}
          <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border border-slate-800">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-indigo-300">
                  Your self-rating score
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold tracking-tight tabular-nums">
                    {calculatedSelfScore.toFixed(2)}
                  </span>
                  <span className="text-sm text-indigo-300">/ 5.00</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-800/80 text-indigo-200 border border-indigo-600/50 font-semibold ml-2">
                    {calculatedSelfScore >= 4.5
                      ? 'Outstanding'
                      : calculatedSelfScore >= 3.75
                      ? 'Exceeds Expectations'
                      : calculatedSelfScore >= 2.75
                      ? 'Meets Expectations'
                      : 'Needs Improvement'}
                  </span>
                </div>
              </div>

              {hasManagerSubmitted && review.finalScore ? (
                <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-700 pt-3 sm:pt-0 sm:pl-6">
                  <span className="text-[11px] font-bold text-emerald-400">
                    Final manager score
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold tracking-tight tabular-nums text-emerald-400">
                      {review.finalScore.toFixed(2)}
                    </span>
                    <span className="text-sm text-emerald-300">/ 5.00</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="text-center sm:text-right space-y-1">
              <p className="text-xs text-slate-300">
                Calculated weighted composite from {kraStates.length} assigned KRAs ({kraStates.reduce((acc, k) => acc + (k.weight || 0), 0)}% total weight)
              </p>
            </div>
          </div>

          {/* KRAs Self-Evaluation List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Assigned KRAs & self-ratings</span>
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {kraStates.length} Key Result Areas
              </span>
            </div>

            {kraStates.map((kra, index) => {
              const currentDesc = RATING_DESCRIPTIONS[kra.selfRating] || RATING_DESCRIPTIONS[3];
              const kraDomId = kra.id || (kra as any).kraId || String(index);
              const isMissingJustification =
                [1, 2, 5].includes(kra.selfRating) &&
                (!kra.selfJustification || kra.selfJustification.trim().length < 15);
              const isCardHighlighted = highlightedKraId === kraDomId || highlightedKraId === kra.id;

              return (
                <div
                  key={kra.id || index}
                  id={`self-kra-card-${kraDomId}`}
                  className={`p-4 sm:p-5 rounded-xl border transition-all space-y-3.5 ${
                    isCardHighlighted
                      ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-50/15 dark:bg-rose-950/20'
                      : isMissingJustification
                      ? 'border-amber-400 dark:border-amber-600/80 ring-1 ring-amber-400/30 bg-amber-50/10 dark:bg-amber-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {isCardHighlighted && (
                    <div className="p-2.5 rounded-lg bg-rose-100/90 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Add a justification of at least 15 characters below for your rating of {kra.selfRating}.</span>
                    </div>
                  )}

                  {/* KRA Title & Weight Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                          {kra.kraName || kra.title}
                        </h5>
                      </div>
                      {kra.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-7">{kra.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start pl-7 sm:pl-0">
                      {isMissingJustification && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>Justification required</span>
                        </span>
                      )}
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 tabular-nums">
                        Weight: {kra.weight}%
                      </span>
                    </div>
                  </div>

                  {/* Target and Rubric Details */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Target metric:</span>
                      <span className="text-slate-600 dark:text-slate-400">{kra.targetSnapshot}</span>
                    </div>
                    {kra.measurementCriteria && (
                      <div className="flex items-start gap-1.5 pt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Rubric:</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">{kra.measurementCriteria}</span>
                      </div>
                    )}
                  </div>

                  {/* Rating Selector */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span>Your self-rating:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">{kra.selfRating} / 5</span>
                      </label>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${currentDesc.color}`}>
                        {currentDesc.title}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {[1, 2, 3, 4, 5].map((ratingVal) => {
                        const isSelected = kra.selfRating === ratingVal;
                        return (
                          <button
                            key={ratingVal}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleRatingChange(kra.id, ratingVal)}
                            className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold transition-all ${
                              isReadOnly ? 'cursor-default' : 'cursor-pointer'
                            } ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white scale-102'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-0.5 mb-0.5">
                              <Star className={`w-3 h-3 ${isSelected ? 'fill-white text-white' : 'text-slate-400'}`} />
                              <span>{ratingVal}</span>
                            </div>
                            <div className={`text-[11px] truncate hidden sm:block ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {RATING_DESCRIPTIONS[ratingVal].title.split(' ')[0]}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mandatory Self Rating Justification for 1, 2, 5 */}
                  <RatingJustificationInput
                    rating={kra.selfRating}
                    value={kra.selfJustification || ''}
                    onChange={(val) => handleJustificationChange(kra.id, val)}
                    disabled={isReadOnly}
                    roleLabel="Self-Assessment"
                    minChars={15}
                  />

                  {/* Read-Only Justification Display when completed */}
                  {isReadOnly && [1, 2, 5].includes(kra.selfRating) && kra.selfJustification && (
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/50 text-xs">
                      <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                        Your justification for a {kra.selfRating}:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 italic">{kra.selfJustification}</p>
                    </div>
                  )}

                  {/* Self Achievement Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Key deliverables & milestones achieved (self-reflection):
                    </label>
                    {isReadOnly ? (
                      kra.selfAchievement ? (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                          {kra.selfAchievement}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-850/50 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 italic">
                          No self-reflection deliverables recorded for this KRA.
                        </div>
                      )
                    ) : (
                      <textarea
                        disabled={isReadOnly}
                        value={kra.selfAchievement}
                        onChange={(e) => handleAchievementChange(kra.id, e.target.value)}
                        placeholder="e.g. Successfully shipped sprint modules on time; resolved 12 P1 bugs; automated test runs to 92% coverage..."
                        rows={2}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>

                  {/* Manager comparison if available */}
                  {kra.rating !== undefined && (
                    <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold text-indigo-950 dark:text-indigo-200">
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Manager calibrated score: <strong>{kra.rating} / 5</strong></span>
                        </span>
                        <span className="text-[11px] text-indigo-700 dark:text-indigo-300 tabular-nums px-2 py-0.5 rounded-md bg-indigo-100/60 dark:bg-indigo-900/40">
                          Variance: {kra.selfRating - kra.rating > 0 ? `+${(kra.selfRating - kra.rating).toFixed(1)}` : (kra.selfRating - kra.rating).toFixed(1)}
                        </span>
                      </div>
                      {kra.comments && (
                        <p className="text-[11px] text-indigo-800 dark:text-indigo-300 italic pl-5">
                          "{kra.comments}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* MANAGER EVALUATION & GROWTH FEEDBACK (Submitted by Manager) */}
          {(hasManagerSubmitted || review.strengths || review.improvements || review.managerOverallComments || (review as any).managerComments) && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/60 dark:bg-slate-850 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Manager evaluation & growth feedback</span>
                      <span className="text-[11px] normal-case font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ✓ Verified
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Evaluated by <strong>{review.managerName || 'Reporting Manager'}</strong>
                    </p>
                  </div>
                </div>

                {review.finalScore ? (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 tabular-nums">
                      Live weighted: <span className="text-emerald-600 dark:text-emerald-400">{review.finalScore.toFixed(2)}</span> / 5.00
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3.5">
                {/* 1. Key Strengths & Core Contributions */}
                <div className="p-4 rounded-xl border border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Key strengths & core contributions</span>
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                      Manager feedback
                    </span>
                  </div>
                  {review.strengths ? (
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-white dark:bg-slate-800/90 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 font-normal">
                      {review.strengths}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic p-1">No specific strengths documented.</p>
                  )}
                </div>

                {/* 2. Development Areas & Growth Opportunities */}
                <div className="p-4 rounded-xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Development areas & growth opportunities</span>
                    </label>
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/40">
                      Growth roadmap
                    </span>
                  </div>
                  {review.improvements ? (
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-white dark:bg-slate-800/90 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40 font-normal">
                      {review.improvements}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic p-1">No specific development areas documented.</p>
                  )}
                </div>

                {/* 3. Manager Overall Summary & Appraisal Recommendations */}
                {(review.managerOverallComments || (review as any).managerComments) && (
                  <div className="p-4 rounded-xl border border-indigo-200/90 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Manager overall summary & appraisal recommendations</span>
                      </label>
                      <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                        Overarching calibration note
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-white dark:bg-slate-800/90 p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 font-normal italic">
                      "{review.managerOverallComments || (review as any).managerComments}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Qualitative Reflection */}
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Strategic self-reflection & growth</span>
            </h4>

            {isReadOnly ? (
              selfStrengths || selfImprovements || selfObstacles ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Key strengths & major accomplishments:
                      </label>
                      {selfStrengths ? (
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">{selfStrengths}</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No notes recorded.</p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Areas for growth & skill acquisition:
                      </label>
                      {selfImprovements ? (
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">{selfImprovements}</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No notes recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Blockers, dependencies & manager support needed:
                    </label>
                    {selfObstacles ? (
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">{selfObstacles}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No notes recorded.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No employee self-reflection submitted</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Employee did not submit self-reflection remarks prior to manager evaluation.</p>
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Key strengths & major accomplishments:
                    </label>
                    <textarea
                      disabled={isReadOnly}
                      value={selfStrengths}
                      onChange={(e) => setSelfStrengths(e.target.value)}
                      placeholder="What went particularly well this quarter? What are you most proud of?"
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Areas for growth & skill acquisition:
                    </label>
                    <textarea
                      disabled={isReadOnly}
                      value={selfImprovements}
                      onChange={(e) => setSelfImprovements(e.target.value)}
                      placeholder="What skills, technical competencies, or processes do you aim to enhance?"
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Blockers, dependencies & manager support needed:
                  </label>
                  <textarea
                    disabled={isReadOnly}
                    value={selfObstacles}
                    onChange={(e) => setSelfObstacles(e.target.value)}
                    placeholder="What tooling, architectural clarity, or managerial support would help you unlock greater velocity next quarter?"
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sticky Inline In-Modal Warning Banner pinned right above the footer */}
        {(error || (!isReadOnly && missingJustificationsCount > 0)) && (
          <div
            className={`px-4 sm:px-6 py-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 shrink-0 ${
              error
                ? 'bg-rose-50 dark:bg-rose-950/95 border-rose-200 dark:border-rose-900/80 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/95 border-amber-200 dark:border-amber-900/80 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  error ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              />
              <span className="font-semibold">
                {error ||
                  `${missingJustificationsCount} KRA${
                    missingJustificationsCount > 1 ? 's' : ''
                  } rated 1, 2 or 5 need a justification of at least 15 characters before you submit.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {firstInvalidKra && (
                <button
                  type="button"
                  onClick={() => scrollToKra(firstInvalidKra.id || (firstInvalidKra as any).kraId || '')}
                  className={`text-xs font-bold underline cursor-pointer shrink-0 ${
                    error
                      ? 'text-rose-700 hover:text-rose-900 dark:text-rose-300'
                      : 'text-amber-800 hover:text-amber-950 dark:text-amber-300'
                  }`}
                >
                  Jump to KRA →
                </button>
              )}
              {error && (
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs ml-1 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 order-2 sm:order-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {isReadOnly
                ? 'This review evaluation is finalized and view-only.'
                : isAlreadySubmitted
                ? 'You can update your self-assessment until your manager submits their review.'
                : 'Submitting moves the review to your manager for evaluation.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save draft</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSubmitting ? 'Submitting...' : isAlreadySubmitted ? 'Update Self-Assessment' : 'Submit to Manager'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* UNSAVED CHANGES CONFIRMATION ALERT */}
        {showUnsavedAlert && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 modal-backdrop-enter"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-slate-900 dark:text-white modal-card-enter">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Unsaved self-assessment
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    You have unsaved changes in your self-evaluation. If you exit now without saving, your self-ratings and reflection entries will be lost.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUnsavedAlert(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedAlert(false);
                    handleClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-colors cursor-pointer"
                >
                  Discard & exit
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    setShowUnsavedAlert(false);
                    await handleSubmit(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save draft & exit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
