import React from 'react';
import { createPortal } from 'react-dom';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Employee } from '../types';
import { ShieldAlert, X, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';

export interface MasterDeleteTarget {
  type: 'department' | 'designation' | 'location';
  id: string;
  name: string;
  code?: string;
  level?: number;
  associatedDeptName?: string;
  assignedEmployees: Employee[];
}

interface MasterDeleteModalProps {
  deleteTarget: MasterDeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export const MasterDeleteModal: React.FC<MasterDeleteModalProps> = ({
  deleteTarget,
  onClose,
  onConfirm,
  loading,
}) => {
  const cachedTargetRef = React.useRef(deleteTarget);
  if (deleteTarget) {
    cachedTargetRef.current = deleteTarget;
  }
  const target = deleteTarget || cachedTargetRef.current;

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen: !!deleteTarget,
    onClose,
  });

  if (!isMounted || !target) return null;
  if (typeof document === 'undefined') return null;

  const typeLabel = target.type === 'department' ? 'Department' : target.type === 'designation' ? 'Designation' : 'Location';

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full my-auto overflow-hidden ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                target.assignedEmployees.length > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {target.assignedEmployees.length > 0
                  ? `Cannot Delete ${typeLabel}`
                  : `Delete ${typeLabel}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {target.assignedEmployees.length > 0
                  ? 'Active employee dependencies detected'
                  : 'Confirm master registry removal'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Details Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                Target {typeLabel}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {target.name}
              </span>
            </div>
            {target.code && (
              <span className="text-xs tabular-nums px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {target.code}
              </span>
            )}
            {target.level !== undefined && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Role Level {target.level}
              </span>
            )}
          </div>

          {target.assignedEmployees.length > 0 ? (
            /* Blocked State */
            <div className="space-y-3">
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{target.assignedEmployees.length} Active Employee(s) Assigned</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  To prevent orphaned employee profiles, broken review cycles, and missing office linkages, this {target.type} cannot be deleted while employees are actively assigned.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  Assigned personnel:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {target.assignedEmployees.slice(0, 8).map((emp) => (
                    <span
                      key={emp.id}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                    >
                      <span className="font-semibold">{emp.name}</span>
                      <span className="text-[11px] text-slate-400">({emp.employeeCode})</span>
                    </span>
                  ))}
                  {target.assignedEmployees.length > 8 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                      +{target.assignedEmployees.length - 8} more
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Tip: Reassign or update these employees before deleting this {target.type}.
              </p>
            </div>
          ) : (
            /* Allowed to Delete State */
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete <strong>&quot;{target.name}&quot;</strong> from the database?
              </p>

              <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Permanent action</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                  {target.type === 'department'
                    ? 'All associated designations and department settings will be permanently removed. This action is recorded in the master audit log.'
                    : target.type === 'designation'
                    ? 'This designation role will be permanently removed from the master registry.'
                    : 'This work location will be permanently removed from the master registry.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          {target.assignedEmployees.length > 0 ? (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Understood
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleClose}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{loading ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
