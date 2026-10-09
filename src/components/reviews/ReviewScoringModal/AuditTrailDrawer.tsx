import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { History, X, ArrowRight } from 'lucide-react';
import { EmployeeReview, KraRevisionChange, RETURN_REASON_TEMPLATES } from '../../../types';
import { useModalAnimation } from '../../../hooks/useModalAnimation';

interface AuditTrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  review: EmployeeReview;
}

const KraChangeList: React.FC<{ changes: KraRevisionChange[] }> = ({ changes }) => (
  <div className="mt-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 divide-y divide-indigo-100 dark:divide-indigo-900/50">
    {changes.map((c) => {
      const ratingChanged = c.before !== c.after;
      return (
        <div key={c.kraId} className="px-2.5 py-1.5 text-[11px] space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{c.kraName}</span>
            <span className="text-[11px] text-slate-400">{c.field === 'hodRating' ? 'HOD' : 'Manager'}</span>
            {ratingChanged ? (
              <span className="inline-flex items-center gap-1 tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
                {c.before || '–'} <ArrowRight className="w-3 h-3" /> {c.after}
              </span>
            ) : c.kept ? (
              <span className="font-semibold text-amber-700 dark:text-amber-300">kept {c.after}</span>
            ) : (
              <span className="text-slate-500">{c.after} unchanged</span>
            )}
            {c.justificationChanged && (
              <span className="px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">justification updated</span>
            )}
            {c.achievementChanged && (
              <span className="px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">achievement updated</span>
            )}
          </div>
          {c.keepReason && <p className="text-slate-600 dark:text-slate-400 italic">Kept because: {c.keepReason}</p>}
          {c.reply && <p className="text-slate-600 dark:text-slate-400 italic">Reply: {c.reply}</p>}
        </div>
      );
    })}
  </div>
);

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({
  isOpen,
  onClose,
  review,
}) => {
  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  useEffect(() => {
    if (!isMounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, handleClose]);

  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden ${cardClass}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center space-x-2.5">
            <History className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Review lifecycle & audit trail</span>
                <span className="tabular-nums text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                  {review.actionHistory?.length || 0} events
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {review.employeeName} ({review.employeeCode}) • Period: {review.reviewPeriodName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body / Timeline */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {(!review.actionHistory || review.actionHistory.length === 0) ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
              No lifecycle events recorded for this review yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {review.actionHistory.map((action, idx) => {
                const isReturned = action.action === 'RETURNED' || action.action === 'HOD_RETURNED';
                const isApproved = action.action === 'APPROVED' || action.action === 'HOD_APPROVED';
                const returnRequest = action.returnRequestId
                  ? review.returnRequests?.find((r) => r.id === action.returnRequestId)
                  : undefined;
                const returnRecipient = action.hodKraIds?.length
                  ? `${review.managerName} (Manager), then ${review.hodName || 'HOD'} (HOD)`
                  : action.returnTarget === 'HOD'
                  ? `HOD: ${review.hodName || 'HOD'}`
                  : `Reporting Manager: ${review.managerName}`;
                const reasonLabels = (action.reasonCodes || [])
                  .map((c) => RETURN_REASON_TEMPLATES.find((t) => t.code === c)?.label)
                  .filter(Boolean);
                const isClosed = action.action === 'CLOSED';
                const isException = action.action === 'HOD_MISSING_EXCEPTION';

                return (
                  <div key={action.id || idx} className="relative">
                    <div
                      className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-850 border-2 flex items-center justify-center ${
                        isException
                          ? 'border-red-500'
                          : isReturned
                          ? 'border-rose-500'
                          : isApproved
                          ? 'border-emerald-500'
                          : isClosed
                          ? 'border-slate-500'
                          : 'border-indigo-600'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isException
                            ? 'bg-red-500'
                            : isReturned
                            ? 'bg-rose-500'
                            : isApproved
                            ? 'bg-emerald-500'
                            : isClosed
                            ? 'bg-slate-500'
                            : 'bg-indigo-600'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                            isException
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                              : isReturned
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                              : isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : isClosed
                              ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                          }`}
                        >
                          {action.action}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {action.performedByName}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums">
                          {action.performedByRole}
                        </span>
                      </div>

                      {isReturned && (
                        <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                          ↩ Returned to <span className="font-semibold text-slate-800 dark:text-slate-200">{returnRecipient}</span>
                          {returnRequest && (
                            <span className="text-slate-500 dark:text-slate-400">
                              {' '}· round {returnRequest.round} ·{' '}
                              {returnRequest.status === 'OPEN'
                                ? `due ${new Date(returnRequest.dueAt).toLocaleDateString()}`
                                : returnRequest.status === 'QUEUED'
                                ? 'waiting for the Manager'
                                : returnRequest.status === 'RESOLVED'
                                ? `resolved ${returnRequest.resolvedAt ? new Date(returnRequest.resolvedAt).toLocaleDateString() : ''}`
                                : 'superseded'}
                            </span>
                          )}
                        </div>
                      )}

                      {isReturned && action.returnedKraTitles && action.returnedKraTitles.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {action.returnedKraTitles.map((t, i) => {
                            const kraId = action.returnedKraIds?.[i];
                            const note = kraId ? returnRequest?.kraComments?.[kraId] : undefined;
                            return (
                              <span
                                key={`${t}_${i}`}
                                title={note}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold"
                              >
                                {t}
                                {note ? ' 💬' : ''}
                              </span>
                            );
                          })}
                          {action.hodKraTitles && action.hodKraTitles.length > 0 && (
                            <>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 self-center ml-1">then HOD:</span>
                              {action.hodKraTitles.map((t, i) => (
                                <span
                                  key={`hod_${t}_${i}`}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-semibold"
                                >
                                  {t}
                                </span>
                              ))}
                            </>
                          )}
                          {reasonLabels.map((l) => (
                            <span
                              key={l}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      )}

                      {action.kraChanges && action.kraChanges.length > 0 && <KraChangeList changes={action.kraChanges} />}

                      {action.remarks && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 leading-relaxed">
                          <span className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Remarks / reason:</span>
                          {action.remarks}
                        </div>
                      )}

                      <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                        {new Date(action.performedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
