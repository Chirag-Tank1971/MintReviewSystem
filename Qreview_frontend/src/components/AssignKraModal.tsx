import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Search } from 'lucide-react';
import { Employee, Cycle, KraTemplate, Kra } from '../types';
import { CustomKraScorecardModal, CustomKraRow } from './CustomKraScorecardModal';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';

interface AssignKraModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Full employee roster — filtered down to those with no KRA scorecard yet for the picker step. */
  employees: Employee[];
  /** Used to resolve a reliable cycle display name — an employee's own denormalized cycleName can be stale/empty. */
  cycles: Cycle[];
  /** All available KRA templates to choose from or auto-apply */
  templates?: KraTemplate[];
  /** Master standard KRA catalog */
  kraLibrary?: Kra[];
  /** Called after a scorecard is successfully created/updated, so the caller can refresh master data. */
  onAssigned: () => void;
  /**
   * Skips the employee-picker step and edits/assigns this employee's scorecard directly —
   * used for the per-row "Assign" action and for editing an existing employee-owned template.
   */
  preselectedEmployee?: Employee | null;
  /** Pre-fills the scorecard builder — used when editing an existing employee-owned template. */
  initialKras?: CustomKraRow[];
}

/**
 * Standalone "create & assign a KRA scorecard" flow for the KRA Templates configuration
 * page. Unlike the old KraTemplateBuilderModal (which created department/designation-scoped
 * library blueprints), this always assigns an exclusive, employee-owned scorecard — matching
 * the backend invariant that every employee's KRA template belongs to them alone. When no
 * employee is preselected, it first asks HR to pick one of the employees who don't have a
 * scorecard yet, then hands off to the same CustomKraScorecardModal used from the employee
 * profile editor.
 */
export const AssignKraModal: React.FC<AssignKraModalProps> = ({
  isOpen,
  onClose,
  employees,
  cycles,
  templates,
  kraLibrary,
  onAssigned,
  preselectedEmployee = null,
  initialKras = [],
}) => {
  const [search, setSearch] = useState('');
  const [pickedEmployee, setPickedEmployee] = useState<Employee | null>(null);
  const [resolvedKras, setResolvedKras] = useState<CustomKraRow[]>(initialKras);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) {
      setPickedEmployee(null);
      setSearch('');
      setResolvedKras(initialKras);
    }
  }, [isOpen, initialKras]);

  const activeEmployee = preselectedEmployee || pickedEmployee;

  // Auto-fetch existing employee KRA template/scorecard if not pre-provided
  useEffect(() => {
    if (initialKras && initialKras.length > 0) {
      setResolvedKras(initialKras);
      return;
    }

    if (!activeEmployee) {
      setResolvedKras([]);
      return;
    }

    let isSubscribed = true;

    (async () => {
      try {
        // 1. Try template by currentKraTemplateId
        if (activeEmployee.currentKraTemplateId) {
          const tmpl = await api.getKraTemplateById(activeEmployee.currentKraTemplateId);
          if (isSubscribed && tmpl?.items?.length) {
            setResolvedKras(
              tmpl.items.map((it, idx) => ({
                id: it.id || `kra_${idx}`,
                title: it.title || '',
                weight: it.weight ?? 0,
                target: it.target || '100% Target SLA',
                description: it.description,
                measurementCriteria: it.measurementCriteria,
              }))
            );
            return;
          }
        }

        // 2. Try template by employeeId or employeeCode
        const allTemplates = await api.getKraTemplates();
        const match = allTemplates.find(
          (t) =>
            (t.employeeId && t.employeeId === activeEmployee.id) ||
            (t.employeeCode && t.employeeCode.toUpperCase() === activeEmployee.employeeCode?.toUpperCase())
        );
        if (isSubscribed && match?.items?.length) {
          setResolvedKras(
            match.items.map((it, idx) => ({
              id: it.id || `kra_${idx}`,
              title: it.title || '',
              weight: it.weight ?? 0,
              target: it.target || '100% Target SLA',
              description: it.description,
              measurementCriteria: it.measurementCriteria,
            }))
          );
          return;
        }

        // 2.5 Try shared blueprint template by designation and/or department
        const isShared = (t: KraTemplate) => !t.employeeId && t.items?.length > 0;
        const sharedMatch =
          (activeEmployee.designationId &&
            allTemplates.find((t) => isShared(t) && t.designationId === activeEmployee.designationId)) ||
          (activeEmployee.departmentId &&
            allTemplates.find((t) => isShared(t) && t.departmentId === activeEmployee.departmentId)) ||
          undefined;
        if (isSubscribed && sharedMatch?.items?.length) {
          setResolvedKras(
            sharedMatch.items.map((it, idx) => ({
              id: it.id || `kra_${idx}`,
              title: it.title || '',
              weight: it.weight ?? 0,
              target: it.target || '100% Target SLA',
              description: it.description,
              measurementCriteria: it.measurementCriteria,
            }))
          );
          return;
        }

        // 3. Fallback: check reviews for this employee to extract snapshot
        const reviews = await api.getReviews();
        const empReview = reviews?.find((r) => r.employeeId === activeEmployee.id && r.kraSnapshot?.length > 0);
        if (isSubscribed && empReview?.kraSnapshot?.length) {
          setResolvedKras(
            empReview.kraSnapshot.map((k, idx) => ({
              id: k.id || `kra_${idx}`,
              title: k.kraName || k.title || '',
              weight: k.weight ?? 0,
              target: k.targetSnapshot || '100% Target SLA',
              description: k.description || '',
              measurementCriteria: k.measurementCriteria,
            }))
          );
        } else if (isSubscribed) {
          setResolvedKras([]);
        }
      } catch (err) {
        console.warn('Could not auto-fetch employee KRA template:', err);
        if (isSubscribed) setResolvedKras([]);
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [activeEmployee?.id, activeEmployee?.currentKraTemplateId, initialKras]);

  useEffect(() => {
    if (!isMounted || activeEmployee) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, activeEmployee, handleClose]);

  if (!isMounted) return null;

  if (activeEmployee) {
    const resolvedCycleName =
      cycles.find((c) => c.id === activeEmployee.cycleId)?.name ||
      activeEmployee.cycleName ||
      activeEmployee.cycleCode;

    return (
      <CustomKraScorecardModal
        isOpen
        onClose={() => (preselectedEmployee ? onClose() : setPickedEmployee(null))}
        onDone={async (rows) => {
          try {
            await api.updateEmployee(activeEmployee.id, { customKras: rows });
            toast.success(`KRA scorecard assigned to ${activeEmployee.name}.`, 'Scorecard Assigned');
            onAssigned();
            onClose();
          } catch (err: any) {
            toast.error(err?.message || 'Failed to assign the KRA scorecard.', 'Assignment Failed');
          }
        }}
        initialKras={resolvedKras}
        employeeCode={activeEmployee.employeeCode}
        name={activeEmployee.name}
        designationName={activeEmployee.designationName}
        departmentName={activeEmployee.departmentName}
        managerName={activeEmployee.managerName}
        hodName={activeEmployee.hodName}
        cycleName={resolvedCycleName}
        templates={templates}
        kraLibrary={kraLibrary}
      />
    );
  }

  const unassigned = employees.filter((e) => !e.currentKraTemplateId && e.status !== 'INACTIVE');
  const filtered = unassigned.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q);
  });

  return createPortal(
    <div
      className={`fixed inset-0 z-[9994] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col ${cardClass}`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Assign new KRA scorecard</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pick an employee who doesn't have a KRA scorecard yet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unassigned employees..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              {unassigned.length === 0
                ? 'Every active employee already has a KRA scorecard assigned.'
                : 'No employees match your search.'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setPickedEmployee(emp)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{emp.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {emp.employeeCode} • {emp.designationName || 'Employee'} • {emp.departmentName || 'General'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
