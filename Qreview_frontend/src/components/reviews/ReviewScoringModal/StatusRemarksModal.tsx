import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, UserCheck, Loader2 } from 'lucide-react';
import { EmployeeReview, ReviewStatus } from '../../../types';
import { useModalAnimation } from '../../../hooks/useModalAnimation';

/**
 * HR sign-off confirmation: "Approve (HR)" (HR_COMPLETED) or "Final Lock & Close" (CLOSED).
 * Returns go through ReturnReviewModal instead.
 */
interface StatusRemarksModalProps {
  isOpen: boolean;
  status: ReviewStatus | null;
  review: EmployeeReview;
  remarks: string;
  setRemarks: (val: string) => void;
  onClose: () => void;
  onConfirm: (status: ReviewStatus) => void;
  saving: boolean;
}

export const StatusRemarksModal: React.FC<StatusRemarksModalProps> = ({
  isOpen,
  status,
  review,
  remarks,
  setRemarks,
  onClose,
  onConfirm,
  saving,
}) => {
  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  useEffect(() => {
    if (!isMounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, saving, handleClose]);

  if (!isMounted || !status) return null;

  const isClosing = status === 'CLOSED';

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 ${cardClass}`}>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          {isClosing ? (
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{isClosing ? 'Final Lock & Close Quarterly Review' : 'Approve Review (HR Calibration)'}</span>
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {isClosing
            ? `This will permanently lock the review for ${review.employeeName}. All ratings, scores, and growth comments will be preserved and locked.`
            : 'Mark this review as HR Approved and record calibration remarks in the audit trail:'}
        </p>

        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={
            isClosing
              ? 'e.g. Approved and final locked by HR following performance calibration...'
              : 'e.g. Scores aligned with cohort distribution. Approved for appraisal processing...'
          }
          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500"
        />
        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={() => onConfirm(status)}
            className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
              isClosing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isClosing ? 'Confirm & Final Lock' : 'Confirm HR Approval'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
