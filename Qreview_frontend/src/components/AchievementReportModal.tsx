import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Employee, Department } from '../types';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { financialYearFor } from '../utils/salesChampsExport';
import {
  AchievementReport, AchievementRow, sheetTotals, formatAmount, formatPercent,
} from '../utils/achievementSheet';
import { Button } from './ui/Button';
import { INPUT_CLASS, LABEL_CLASS } from './ui/formStyles';

interface Props {
  report?: AchievementReport | null;
  employees: Employee[];
  departments?: Department[];
  /** Financial years that already have a report, so a duplicate is caught before saving. */
  takenYears: string[];
  onSave: (data: { financialYear: string; rows: AchievementRow[] }) => Promise<void>;
  onClose: () => void;
}

const normFy = (s: string) => s.toLowerCase().replace(/^fy\s*/, '').replace(/\s+/g, '');

const blankRow = (): AchievementRow => ({ employeeId: '', employeeName: '', targetAchieved: 0, actualTarget: 0, turnover: 0, percentage: null });

const NUM_INPUT =
  'w-full text-right tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600';

export const AchievementReportModal: React.FC<Props> = ({ report, employees, departments, takenYears, onSave, onClose }) => {
  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({ onClose });

  const [financialYear, setFinancialYear] = useState(report?.financialYear || financialYearFor().label);
  const [rows, setRows] = useState<AchievementRow[]>(report?.rows?.length ? report.rows.map((r) => ({ ...r })) : [blankRow()]);
  const [onlySales, setOnlySales] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const snapshot = JSON.stringify({ financialYear, rows });
  const initial = useRef(snapshot);
  const isDirty = snapshot !== initial.current;
  const requestClose = () => (isDirty ? setShowCloseConfirm(true) : handleClose());

  const isSalesOrService = (emp: Employee) => {
    const dept = (emp.departmentName || departments?.find((d) => d.id === emp.departmentId)?.name || '').toLowerCase();
    const desig = (emp.designationName || '').toLowerCase();
    return ['sales', 'service', 'business development', 'bd'].some((k) => dept.includes(k) || desig.includes(k));
  };

  const usedIds = new Set(rows.map((r) => r.employeeId).filter(Boolean));
  const optionsFor = (current: string) =>
    [...employees]
      .filter((e) => e.id === current || (!usedIds.has(e.id) && (!onlySales || isSalesOrService(e))))
      .sort((a, b) => a.name.localeCompare(b.name));

  const update = (i: number, patch: Partial<AchievementRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const pickEmployee = (i: number, id: string) => {
    const emp = employees.find((e) => e.id === id);
    update(i, { employeeId: id, employeeName: emp?.name || '' });
  };

  const setAmount = (i: number, field: 'targetAchieved' | 'actualTarget' | 'turnover', raw: string) =>
    update(i, { [field]: raw === '' ? 0 : Math.max(0, Number(raw) || 0) } as Partial<AchievementRow>);

  const setPercent = (i: number, raw: string) =>
    update(i, { percentage: raw === '' ? null : Math.max(0, Number(raw) || 0) });

  const duplicateYear =
    !!financialYear.trim() &&
    takenYears.some((y) => normFy(y) === normFy(financialYear) && normFy(y) !== normFy(report?.financialYear || ''));
  const incomplete = rows.some((r) => !r.employeeId);
  const canSave = !!financialYear.trim() && rows.length > 0 && !incomplete && !duplicateYear;

  const totals = sheetTotals(rows);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ financialYear: financialYear.trim(), rows });
      handleClose();
    } catch {
      // The view shows the error toast; keep the form open so nothing is lost
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClass}`}>
      <div className={`relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] ${cardClass}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#0d3b5e] to-[#1d4ed8] rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">{report?.id ? 'Edit' : 'Create'} Sales Achievement Report</h2>
            <p className="text-xs text-blue-200 mt-0.5">One report per financial year, one row per BDM</p>
          </div>
          <button onClick={requestClose} aria-label="Close" className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="max-w-xs space-y-1">
            <label htmlFor="ach-fy" className={LABEL_CLASS}>Financial year <span className="text-rose-500">*</span></label>
            <input id="ach-fy" type="text" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} placeholder="FY 2024-25" className={INPUT_CLASS} />
            {duplicateYear && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">A report for this financial year already exists. Edit that one instead.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">BDMs</h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={onlySales} onChange={(e) => setOnlySales(e.target.checked)} className="accent-indigo-600" />
                Sales &amp; Service only
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-3 py-2 font-medium">BDM</th>
                    <th className="px-3 py-2 font-medium text-right">Target Achieved</th>
                    <th className="px-3 py-2 font-medium text-right">Actual Target</th>
                    <th className="px-3 py-2 font-medium text-right">Turnover</th>
                    <th className="px-3 py-2 font-medium text-right">Percentage Achievement</th>
                    <th className="px-3 py-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`BDM ${i + 1}`}
                          value={r.employeeId}
                          onChange={(e) => pickEmployee(i, e.target.value)}
                          className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                        >
                          <option value="">Select employee</option>
                          {optionsFor(r.employeeId).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}
                        </select>
                      </td>
                      {(['targetAchieved', 'actualTarget', 'turnover'] as const).map((f) => (
                        <td key={f} className="px-3 py-2">
                          <input
                            type="number" min={0} step="any" inputMode="decimal"
                            aria-label={`${r.employeeName || `Row ${i + 1}`} ${f}`}
                            value={r[f] === 0 ? '' : r[f]}
                            placeholder="0"
                            onChange={(e) => setAmount(i, f, e.target.value)}
                            className={NUM_INPUT}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={10000} step="any" inputMode="decimal"
                            aria-label={`${r.employeeName || `Row ${i + 1}`} percentage achievement`}
                            value={r.percentage ?? ''}
                            placeholder="0"
                            onChange={(e) => setPercent(i, e.target.value)}
                            className={NUM_INPUT}
                          />
                          <span aria-hidden="true" className="text-sm text-slate-500 dark:text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" icon={Trash2} aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((p) => p.filter((_x, idx) => idx !== i))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-amber-50 dark:bg-amber-950/20 border-t-2 border-amber-200 dark:border-amber-900/50 text-slate-900 dark:text-white">
                    <td className="px-3 py-2">Total Amount</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(totals.targetAchieved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(totals.actualTarget)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(totals.turnover)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatPercent(totals.percent)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <Button icon={Plus} onClick={() => setRows((p) => [...p, blankRow()])}>Add BDM</Button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <Button onClick={requestClose}>Cancel</Button>
          <Button variant="primary" icon={isSaving ? Loader2 : Save} iconSpin={isSaving} disabled={!canSave || isSaving} onClick={handleSave}>
            {report?.id ? 'Save changes' : 'Save as draft'}
          </Button>
        </div>
      </div>

      {showCloseConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div role="alertdialog" aria-modal="true" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Discard your changes?</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">What you entered won't be saved.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setShowCloseConfirm(false)} autoFocus>Keep editing</Button>
              <Button variant="primary" onClick={() => { setShowCloseConfirm(false); handleClose(); }}>Discard</Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
