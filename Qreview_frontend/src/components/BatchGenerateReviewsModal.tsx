import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReviewPeriod, Department, Cycle } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  X,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building2,
  Calendar,
  RotateCw,
} from 'lucide-react';

interface BatchGenerateReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
  periods: ReviewPeriod[];
  departments: Department[];
  cycles: Cycle[];
}

export const BatchGenerateReviewsModal: React.FC<BatchGenerateReviewsModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
  periods,
  departments,
  cycles,
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('ALL');
  const [overrideExisting, setOverrideExisting] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  // Accurate eligible-employee count, sourced from the same filtering the backend actually
  // uses to generate reviews (status/department/cycle + already-has-a-review + tenure) —
  // never computed client-side, so it can't drift from what generation actually does.
  const [eligiblePreview, setEligiblePreview] = useState<{ eligibleCount: number; skippedExisting: number; skippedTenure: number; skippedNoKra: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, handleClose]);

  // Default to active period
  useEffect(() => {
    if (!isMounted) return;
    if (periods.length > 0) {
      const active = periods.find((p) => p.status === 'ACTIVE') || periods[0];
      setSelectedPeriodId((prev) => prev || active.id);
    }
  }, [periods, isMounted]);

  // Accurate eligible count from the backend — mirrors the exact same status/department/
  // cycle/existing-review/tenure filtering the generate-batch route uses, so this number
  // always matches what generation will actually do (a purely client-side status+dept+cycle
  // filter previously overcounted employees who already had a review for this period, or
  // who fail the minimum-tenure check).
  useEffect(() => {
    if (!isMounted || !selectedPeriodId) {
      setEligiblePreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    api
      .previewBatchReviews({
        reviewPeriodId: selectedPeriodId,
        departmentId: selectedDepartmentId !== 'ALL' ? selectedDepartmentId : undefined,
        cycleId: selectedCycleId !== 'ALL' ? selectedCycleId : undefined,
        overrideExisting,
      })
      .then((res) => {
        if (!cancelled) setEligiblePreview(res);
      })
      .catch(() => {
        if (!cancelled) setEligiblePreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPeriodId, selectedDepartmentId, selectedCycleId, overrideExisting, isMounted]);

  const eligibleCount = eligiblePreview?.eligibleCount ?? 0;

  if (!isMounted) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId) {
      setErrorMessage('Please select a target review period.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.generateBatchReviews({
        reviewPeriodId: selectedPeriodId,
        departmentId: selectedDepartmentId !== 'ALL' ? selectedDepartmentId : undefined,
        cycleId: selectedCycleId !== 'ALL' ? selectedCycleId : undefined,
        overrideExisting,
      });

      setSuccessMessage(res.message);
      toast.success(res.message || 'Review batch generated successfully!', 'Batch Generation');
      setTimeout(() => {
        onGenerated();
        handleClose();
      }, 900);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to initiate review batch.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Batch Error');
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden ${cardClass}`}>
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Initiate quarterly reviews</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Generate review sheets & freeze immutable KRA snapshots</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate}>
          <div className="p-6 space-y-5">
            {/* MESSAGES */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* IMMUTABLE SNAPSHOT EXPLANATION BANNER */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3.5 rounded-lg flex items-start space-x-3 text-xs text-indigo-900 dark:text-indigo-200">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-semibold">KRA snapshot:</strong> Generating reviews takes a frozen snapshot of each employee's designated KRA template at this point in time. Subsequent template edits will not distort ongoing or past quarterly reviews.
              </p>
            </div>

            {/* TARGET REVIEW PERIOD SELECTOR */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Target review period *</span>
              </label>
              <select
                required
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    {p.name} {p.status === 'ACTIVE' ? '(ACTIVE)' : `(${p.status})`}
                  </option>
                ))}
              </select>
            </div>

            {/* COHORT FILTERS: DEPARTMENT & CYCLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Target department</span>
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All departments (entire company)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Appraisal cycle cohort</span>
                </label>
                <select
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All cycles</option>
                  {cycles.filter((c) => c.active !== false).map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RE-SNAPSHOT OVERRIDE CHECKBOX */}
            <div className="flex items-start space-x-2.5 pt-1">
              <input
                id="override-reviews"
                type="checkbox"
                checked={overrideExisting}
                onChange={(e) => setOverrideExisting(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="override-reviews" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Re-snapshot existing reviews</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  If checked, un-scored existing reviews for this period will be updated with the latest KRA template.
                </span>
              </label>
            </div>

            {/* BATCH SCOPE SUMMARY CARD */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Eligible employees in scope:</span>
              </div>
              {previewLoading ? (
                <RotateCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              ) : (
                <span className="text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  {eligibleCount} employees
                </span>
              )}
            </div>
            {!previewLoading && eligiblePreview && (eligiblePreview.skippedExisting > 0 || eligiblePreview.skippedTenure > 0 || eligiblePreview.skippedNoKra > 0) && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">
                {eligiblePreview.skippedExisting > 0 && (
                  <>{eligiblePreview.skippedExisting} already have a review for this period{!overrideExisting ? ' (unchecked "Re-snapshot" above skips them)' : ''}. </>
                )}
                {eligiblePreview.skippedNoKra > 0 && <>{eligiblePreview.skippedNoKra} have no KRA scorecard assigned yet. </>}
                {eligiblePreview.skippedTenure > 0 && <>{eligiblePreview.skippedTenure} don't yet meet the minimum tenure for this quarter.</>}
              </p>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || previewLoading || eligibleCount === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate {eligibleCount} Reviews</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};
