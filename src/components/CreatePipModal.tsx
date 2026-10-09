import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Search, Plus, Trash2, Loader2, Send, Save } from 'lucide-react';
import { Employee, PerformanceImprovementPlan } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface CreatePipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  existingPlans: PerformanceImprovementPlan[];
  onCreated: () => void;
}

interface GoalRow {
  id: string;
  description: string;
  targetMetric: string;
  dueDate: string;
}

const blankGoal = (): GoalRow => ({
  id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  description: '',
  targetMetric: '',
  dueDate: '',
});

const ACTIVE_STATUSES: PerformanceImprovementPlan['status'][] = ['ACTIVE', 'EXTENDED'];

/** Starting points only — every field stays editable after a template is applied. */
const PIP_TEMPLATES: { category: string; reason: string; goals: { description: string; targetMetric: string }[] }[] = [
  {
    category: 'Quality',
    reason: 'Work output has repeatedly fallen below the expected quality standard, resulting in rework and defects reaching review or customers.',
    goals: [
      { description: 'Reduce defects / rework found in review on assigned work', targetMetric: '≤ 2 issues per deliverable' },
      { description: 'Follow the team checklist and self-review before every submission', targetMetric: '100% of submissions' },
      { description: 'Zero critical defects reaching production or customers', targetMetric: '0 critical defects' },
    ],
  },
  {
    category: 'Delivery',
    reason: 'Assigned work has consistently been delivered late or incomplete against agreed timelines.',
    goals: [
      { description: 'Deliver assigned tasks by the agreed due date', targetMetric: '≥ 90% on time' },
      { description: 'Flag risks to deadlines at least 2 working days in advance', targetMetric: 'Every at-risk task' },
      { description: 'Keep task status up to date in the tracker', targetMetric: 'Updated daily' },
    ],
  },
  {
    category: 'Attendance',
    reason: 'Attendance and punctuality have not met company policy, affecting team coverage and planning.',
    goals: [
      { description: 'Report on time for scheduled working hours and meetings', targetMetric: '≤ 1 late arrival per month' },
      { description: 'Apply for planned leave in advance through the leave system', targetMetric: '100% of planned leave' },
      { description: 'No unplanned absences without notifying the manager before shift start', targetMetric: '0 unreported absences' },
    ],
  },
  {
    category: 'Behaviour',
    reason: 'Workplace conduct has not been in line with company values and code of conduct, affecting collaboration with colleagues.',
    goals: [
      { description: 'Communicate respectfully with colleagues, clients and stakeholders', targetMetric: 'No substantiated complaints' },
      { description: 'Participate constructively in team meetings and reviews', targetMetric: 'Manager observation each week' },
      { description: 'Follow agreed team processes and escalation paths', targetMetric: 'No process breaches' },
    ],
  },
  {
    category: 'Communication',
    reason: 'Communication on work status, blockers and expectations has been unclear or missing, causing delays and misalignment.',
    goals: [
      { description: 'Share a written status update on assigned work', targetMetric: 'Every working day' },
      { description: 'Respond to messages from team and stakeholders within the agreed time', targetMetric: 'Within 4 working hours' },
      { description: 'Raise blockers to the manager as soon as they appear', targetMetric: 'Same day' },
    ],
  },
];

export const CreatePipModal: React.FC<CreatePipModalProps> = ({
  isOpen,
  onClose,
  employees,
  existingPlans,
  onCreated,
}) => {
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [durationDays, setDurationDays] = useState<number | ''>(30);
  const [goals, setGoals] = useState<GoalRow[]>([blankGoal(), blankGoal()]);
  const [isSubmitting, setIsSubmitting] = useState<'draft' | 'publish' | null>(null);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, isSubmitting, handleClose]);

  const employeesOnActivePip = useMemo(
    () => new Set(existingPlans.filter((p) => ACTIVE_STATUSES.includes(p.status)).map((p) => p.employeeId)),
    [existingPlans]
  );

  const eligibleEmployees = employees.filter((e) => e.status !== 'INACTIVE' && !employeesOnActivePip.has(e.id));
  const filteredEmployees = eligibleEmployees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q);
  });

  const endDatePreview = useMemo(() => {
    if (!startDate || durationDays === '' || Number(durationDays) <= 0) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + Number(durationDays));
    return d;
  }, [startDate, durationDays]);

  const applyTemplate = (category: string) => {
    const t = PIP_TEMPLATES.find((x) => x.category === category);
    if (!t) return;
    setCategory(t.category);
    if (!reason.trim()) setReason(t.reason);
    // Keep goals the user already typed; replace only the blank rows
    setGoals((prev) => [
      ...prev.filter((g) => g.description.trim()),
      ...t.goals.map((g) => ({ ...blankGoal(), ...g })),
    ]);
  };

  const handleAddGoal = () => setGoals((prev) => [...prev, blankGoal()]);
  const handleRemoveGoal = (id: string) => setGoals((prev) => prev.filter((g) => g.id !== id));
  const handleUpdateGoal = (id: string, field: keyof GoalRow, value: string) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  if (!isMounted) return null;

  const validate = (): string | null => {
    if (!selectedEmployee) return 'Please select an employee.';
    if (!reason.trim() || reason.trim().length < 10) return 'Reason must be at least 10 characters.';
    if (!startDate) return 'Start date is required.';
    if (durationDays === '' || Number(durationDays) < 7) return 'Duration must be at least 7 days.';
    if (Number(durationDays) > 365) return 'Duration cannot exceed 365 days.';
    const validGoals = goals.filter((g) => g.description.trim().length > 0);
    if (validGoals.length === 0) return 'Please add at least one improvement goal.';
    return null;
  };

  const handleSubmit = async (publish: boolean) => {
    const error = validate();
    if (error) {
      toast.warning(error, 'Validation error');
      return;
    }

    setIsSubmitting(publish ? 'publish' : 'draft');
    try {
      await api.createPip({
        employeeId: selectedEmployee!.id,
        reason: reason.trim(),
        category: category.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        durationDays: Number(durationDays),
        goals: goals
          .filter((g) => g.description.trim().length > 0)
          .map((g) => ({
            description: g.description.trim(),
            targetMetric: g.targetMetric.trim() || undefined,
            dueDate: g.dueDate ? new Date(g.dueDate).toISOString() : undefined,
          })),
        publish,
      });
      toast.success(
        publish ? 'Performance improvement plan published and employee notified.' : 'Plan saved as draft.',
        publish ? 'PIP published' : 'Draft saved'
      );
      handleClose();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create performance improvement plan.', 'Creation failed');
    } finally {
      setIsSubmitting(null);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9994] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${cardClass}`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Start performance improvement plan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                While active, the employee is not eligible for annual appraisal processing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={!!isSubmitting}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Employee picker */}
          {!selectedEmployee ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Employee</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee name or code..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-1.5">
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No eligible employees found (already-on-PIP employees are excluded).
                  </div>
                ) : (
                  filteredEmployees.slice(0, 50).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmployee(emp)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {emp.employeeCode} • {emp.designationName || 'Employee'} • {emp.departmentName || 'General'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{selectedEmployee.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedEmployee.employeeCode} • {selectedEmployee.designationName || 'Employee'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="pip-template" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start from template</label>
            <select
              id="pip-template"
              value=""
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Choose a template (optional)…</option>
              {PIP_TEMPLATES.map((t) => (
                <option key={t.category} value={t.category}>{t.category}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Fills category, reason (if empty) and goals. Everything stays editable.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reason for plan</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Consistently missed quarterly delivery targets over the last two review cycles..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Productivity"
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Duration (days)</label>
              <input
                type="number"
                min={7}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 30, 45, 60, 90"
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {endDatePreview && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Plan will run through <strong className="text-slate-600 dark:text-slate-300">{endDatePreview.toLocaleDateString()}</strong>.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Improvement goals</label>
              <button
                type="button"
                onClick={handleAddGoal}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add goal
              </button>
            </div>
            <div className="space-y-2">
              {goals.map((goal, idx) => (
                <div key={goal.id} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-2 w-4 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={goal.description}
                      onChange={(e) => handleUpdateGoal(goal.id, 'description', e.target.value)}
                      placeholder="Goal description, e.g. Close 90% of assigned tickets within SLA"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={goal.targetMetric}
                        onChange={(e) => handleUpdateGoal(goal.id, 'targetMetric', e.target.value)}
                        placeholder="Target metric (optional)"
                        className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="date"
                        value={goal.dueDate}
                        onChange={(e) => handleUpdateGoal(goal.id, 'dueDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  {goals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(goal.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={!!isSubmitting}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={!!isSubmitting}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
          >
            {isSubmitting === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={!!isSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
          >
            {isSubmitting === 'publish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publish & Notify Employee
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
