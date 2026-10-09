import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ReviewPeriod, Employee } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  X,
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCw,
  Search,
  FileText,
  User,
} from 'lucide-react';

interface InitiateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
  periods: ReviewPeriod[];
  employees: Employee[];
  initialPeriodId?: string;
}

interface EligibilityData {
  eligible: boolean;
  canInitiateManually: boolean;
  requiresManualOverride: boolean;
  tenureDays: number;
  minTenureDays: number;
  reason?: string;
  checks: {
    statusActive: boolean;
    hasManager: boolean;
    hasKraTemplate: boolean;
    alreadyHasReview: boolean;
    periodActiveOrUpcoming: boolean;
    tenureMet: boolean;
  };
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    status: string;
    joiningDate?: string;
    managerName?: string;
    departmentName?: string;
    designationName?: string;
  };
  period: {
    id: string;
    name: string;
    quarter: number;
    year: number;
    startDate: string;
    endDate: string;
    status: string;
  };
}

/**
 * Format date cleanly as "15 Sep 2026", completely omitting any time component.
 */
function formatJoiningDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  // Strip any time portion (e.g. "2026-09-15T00:00:00.000Z" -> "2026-09-15")
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(day, 10)} ${months[mIdx]} ${year}`;
    }
  }
  const d = new Date(dateOnly);
  return isNaN(d.getTime()) ? dateOnly : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const InitiateReviewModal: React.FC<InitiateReviewModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
  periods,
  employees,
  initialPeriodId,
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(initialPeriodId || '');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');

  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);
  const [eligibilityError, setEligibilityError] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  // Lock body scroll and handle Escape key
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

  // Set default period
  useEffect(() => {
    if (!isOpen) return;
    if (initialPeriodId) {
      setSelectedPeriodId(initialPeriodId);
    } else if (periods.length > 0) {
      const active = periods.find((p) => p.status === 'ACTIVE') || periods[0];
      setSelectedPeriodId(active.id);
    }
    setSubmitError('');
  }, [isOpen, initialPeriodId, periods]);

  // Real-time eligibility evaluation
  useEffect(() => {
    if (!isOpen || !selectedEmployeeId || !selectedPeriodId) {
      setEligibilityData(null);
      setEligibilityError('');
      return;
    }

    let active = true;
    setCheckingEligibility(true);
    setEligibilityError('');

    api
      .checkReviewEligibility(selectedEmployeeId, selectedPeriodId)
      .then((data) => {
        if (active) {
          setEligibilityData(data);
          setCheckingEligibility(false);
        }
      })
      .catch((err) => {
        if (active) {
          setEligibilityError(err.message || 'Failed to verify eligibility');
          setEligibilityData(null);
          setCheckingEligibility(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedEmployeeId, selectedPeriodId]);

  // Filtered employees for quick selection
  const filteredEmployees = useMemo(() => {
    const q = searchEmployeeQuery.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.departmentName && e.departmentName.toLowerCase().includes(q))
    );
  }, [employees, searchEmployeeQuery]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !selectedPeriodId) {
      setSubmitError('Please select both an employee and a review period.');
      return;
    }

    if (!eligibilityData?.canInitiateManually) {
      setSubmitError(eligibilityData?.reason || 'Employee cannot be initiated for this review period.');
      return;
    }

    if (eligibilityData.requiresManualOverride && (!overrideReason || !overrideReason.trim())) {
      setSubmitError(
        `A justification reason is mandatory because this employee has ${eligibilityData.tenureDays} days tenure in this quarter (< ${eligibilityData.minTenureDays} days requirement).`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.initiateSingleReview({
        employeeId: selectedEmployeeId,
        reviewPeriodId: selectedPeriodId,
        reason: overrideReason.trim() || undefined,
      });

      toast.success(res.message || 'Quarterly review initiated successfully!', 'Review Initiated');
      onGenerated();
      handleClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to initiate review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs ${backdropClass}`}
    >
      <div className={`relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col ${cardClass}`}>
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <UserCheck className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Initiate review
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Start a quarterly review for an employee with tenure verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start space-x-2 text-rose-700 dark:text-rose-300 text-xs">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* 1. Target Review Period */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Review period</span>
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.status}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Employee Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Employee</span>
            </label>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchEmployeeQuery}
                onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                placeholder="Search employee by name, code or department..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Employee Dropdown */}
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setOverrideReason('');
                setSubmitError('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Choose an employee --</option>
              {filteredEmployees.map((emp) => {
                const joining = formatJoiningDate(emp.joiningDate || (emp as any).dateOfJoining);
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode}) · {emp.departmentName || 'General'} · Joined {joining}
                  </option>
                );
              })}
            </select>

            {/* Selected Employee Summary Card */}
            {selectedEmployee && (
              <div className="mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedEmployee.name} ({selectedEmployee.employeeCode})
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-2">
                    {selectedEmployee.departmentName || 'General'}
                  </span>
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Joined: <strong className="font-medium text-slate-800 dark:text-slate-200">{formatJoiningDate(selectedEmployee.joiningDate || (selectedEmployee as any).dateOfJoining)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* 3. Eligibility & Diagnostics Feedback */}
          {selectedEmployeeId && selectedPeriodId && (
            <div className="space-y-2">
              {checkingEligibility && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-500 flex items-center space-x-2 text-[11px]">
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Evaluating review eligibility and tenure...</span>
                </div>
              )}

              {eligibilityError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px]">
                  {eligibilityError}
                </div>
              )}

              {eligibilityData && !checkingEligibility && (
                <>
                  {/* Case 1: Review already exists */}
                  {eligibilityData.checks.alreadyHasReview && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start space-x-2 text-rose-800 dark:text-rose-300 text-xs">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Review already exists</strong>
                        A review record already exists for {eligibilityData.employee.name} in {eligibilityData.period.name}.
                      </div>
                    </div>
                  )}

                  {/* Case 2: Inactive or Missing Manager */}
                  {!eligibilityData.canInitiateManually && !eligibilityData.checks.alreadyHasReview && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start space-x-2 text-rose-800 dark:text-rose-300 text-xs">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Cannot initiate review</strong>
                        {eligibilityData.reason || 'Core requirements are not satisfied.'}
                      </div>
                    </div>
                  )}

                  {/* Case 3: New Joiner (Tenure < 30 days) -> Amber notice */}
                  {eligibilityData.requiresManualOverride && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="block font-semibold text-amber-900 dark:text-amber-200">
                          New Joiner Tenure Notice ({eligibilityData.tenureDays} of {eligibilityData.minTenureDays} days)
                        </strong>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                          Joined on <strong>{formatJoiningDate(eligibilityData.employee.joiningDate)}</strong>. Automatic review requires {eligibilityData.minTenureDays} days of tenure in this quarter. Please provide a justification reason below.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Case 4: Eligible (Tenure >= 30 days) */}
                  {eligibilityData.canInitiateManually && !eligibilityData.requiresManualOverride && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Eligible for Review · {eligibilityData.tenureDays} days tenure in {eligibilityData.period.name}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 4. Justification Reason Input */}
          {eligibilityData?.canInitiateManually && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Justification / Reason{' '}
                    {eligibilityData.requiresManualOverride ? (
                      <span className="text-rose-500 font-bold">* (Mandatory)</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(Optional)</span>
                    )}
                  </span>
                </span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={
                  eligibilityData.requiresManualOverride
                    ? 'Enter the reason for initiating review for this new joiner (e.g., Fast-track probation evaluation, agreed onboarding review)...'
                    : 'Optional remarks...'
                }
                rows={2}
                required={eligibilityData.requiresManualOverride}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              checkingEligibility ||
              !eligibilityData?.canInitiateManually ||
              (eligibilityData?.requiresManualOverride && !overrideReason.trim())
            }
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all ${
              submitting ||
              checkingEligibility ||
              !eligibilityData?.canInitiateManually ||
              (eligibilityData?.requiresManualOverride && !overrideReason.trim())
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            }`}
          >
            {submitting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Initiating...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Initiate review</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
