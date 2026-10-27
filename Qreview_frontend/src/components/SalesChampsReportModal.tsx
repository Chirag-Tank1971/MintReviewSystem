import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronRight, ChevronLeft, AlertTriangle,
  Printer, Download, Loader2, CheckCircle2, Save,
} from 'lucide-react';
import { Employee, Department } from '../types';
import { ChampsReportData, ChampsSlab, DEFAULT_CHAMPS_RULES, ChampsRules, printChampsReport, downloadChampsPdf, financialYearFor } from '../utils/salesChampsExport';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Button } from './ui/Button';

export interface SalesChampsReport {
  id?: string;
  employeeId: string;
  employeeName: string;
  financialYear: string;
  fyDateRange: string;
  publishedDate: string;
  gm2TargetCr: string;
  slabs: ChampsSlab[];
  mintValue: string;
  incentiveSchemeName: string;
  rules: Partial<ChampsRules>;
  customRuleText: string;
  status?: 'DRAFT' | 'FINAL' | 'LOCKED';
  createdByName?: string;
  updatedAt?: string;
}

interface Props {
  report?: SalesChampsReport | null;
  employees: Employee[];
  departments?: Department[];
  /** All existing reports, so an employee who already has one for the chosen year can't be picked. */
  existingReports?: SalesChampsReport[];
  onSave: (data: Omit<SalesChampsReport, 'id' | 'status'>) => Promise<void>;
  onClose: () => void;
}

const EMPTY_SLAB: ChampsSlab = { amcTargetLacs: 0, amcIncentiveLacs: 0, gm2AchievementLacs: 0, salesIncentiveLacs: 0 };

const STEP_LABELS = ['Employee & Target', 'Incentive Slabs', 'Terms & Conditions', 'Preview'];

export const SalesChampsReportModal: React.FC<Props> = ({ report, employees, departments, existingReports = [], onSave, onClose }) => {
  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({ onClose });

  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // ── Step 1: Employee + FY + Target
  const [employeeId, setEmployeeId] = useState(report?.employeeId || '');
  const [onlySalesAndService, setOnlySalesAndService] = useState(true);
  const currentFy = financialYearFor();
  const [financialYear, setFinancialYear] = useState(report?.financialYear || currentFy.label);
  const [fyDateRange, setFyDateRange] = useState(report?.fyDateRange || currentFy.range);
  const [publishedDate, setPublishedDate] = useState(report?.publishedDate || currentFy.published);

  // Parse initial target number and unit (Cr / Lacs)
  const parseInitialTarget = (raw: string | undefined) => {
    if (!raw) return { value: '', unit: 'Cr' as 'Cr' | 'Lacs' };
    const trimmed = raw.trim();
    const match = trimmed.match(/^([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs)?$/i);
    if (match) {
      const val = match[1] || '';
      const unitRaw = (match[2] || '').toLowerCase();
      const unit: 'Cr' | 'Lacs' = (unitRaw.startsWith('lac') || unitRaw.startsWith('lakh')) ? 'Lacs' : 'Cr';
      return { value: val, unit };
    }
    return { value: trimmed, unit: 'Cr' as 'Cr' | 'Lacs' };
  };

  const initialTarget = parseInitialTarget(report?.gm2TargetCr);
  const [targetNumber, setTargetNumber] = useState(initialTarget.value);
  const [targetUnit, setTargetUnit] = useState<'Cr' | 'Lacs'>(initialTarget.unit);

  const gm2TargetCr = targetNumber.trim() ? `${targetNumber.trim()} ${targetUnit}` : '';
  const [mintValue, setMintValue] = useState(report?.mintValue || 'Strive for Excellence');
  const [incentiveSchemeName, setIncentiveSchemeName] = useState(report?.incentiveSchemeName || '');

  // ── Step 2: Slabs (4 rows)
  const [slabs, setSlabs] = useState<ChampsSlab[]>(
    report?.slabs?.length
      ? report.slabs
      : [{ ...EMPTY_SLAB }, { ...EMPTY_SLAB }, { ...EMPTY_SLAB }, { ...EMPTY_SLAB }]
  );

  // ── Step 3: Rules
  const [rules, setRules] = useState<ChampsRules>({ ...DEFAULT_CHAMPS_RULES, ...(report?.rules || {}) });
  const [customRuleText, setCustomRuleText] = useState(report?.customRuleText || '');

  const isSalesOrService = (emp: Employee): boolean => {
    const deptName = (
      emp.departmentName ||
      departments?.find((d) => d.id === emp.departmentId)?.name ||
      ''
    ).toLowerCase();
    const deptCode = (
      departments?.find((d) => d.id === emp.departmentId)?.code ||
      ''
    ).toLowerCase();
    const desigName = (emp.designationName || '').toLowerCase();

    return (
      deptName.includes('sales') ||
      deptName.includes('service') ||
      deptName.includes('bd') ||
      deptName.includes('business development') ||
      deptCode.includes('sale') ||
      deptCode.includes('sls') ||
      deptCode.includes('serv') ||
      deptCode.includes('ser') ||
      desigName.includes('sales') ||
      desigName.includes('service') ||
      desigName.includes('bd') ||
      desigName.includes('business development')
    );
  };

  const displayedEmployees = employees.filter((emp) => {
    if (emp.id === employeeId) return true;
    if (!onlySalesAndService) return true;
    return isSalesOrService(emp);
  });

  // One report per employee per financial year (the backend enforces this too)
  const normFy = (fy: string) => fy.trim().toLowerCase();
  const existingReportFor = (empId: string) =>
    existingReports.find(
      (r) => r.employeeId === empId && normFy(r.financialYear) === normFy(financialYear) && r.id !== report?.id
    );
  const conflict = employeeId ? existingReportFor(employeeId) : undefined;

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const employeeName = selectedEmployee
    ? selectedEmployee.name
    : report?.employeeName || '';

  const champsData: ChampsReportData = {
    employeeName,
    financialYear,
    fyDateRange,
    publishedDate,
    gm2TargetCr,
    slabs,
    mintValue,
    incentiveSchemeName,
    rules,
    customRuleText,
  };

  // Unsaved-changes guard: compare the form against how it looked when it opened
  const formSnapshot = JSON.stringify({ employeeId, ...champsData });
  const initialSnapshot = useRef(formSnapshot);
  const isDirty = formSnapshot !== initialSnapshot.current;
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const canSaveDraft = !!employeeId && !!financialYear && !!gm2TargetCr && !conflict;
  const requestClose = () => (isDirty ? setShowCloseConfirm(true) : handleClose());

  useEffect(() => {
    if (!isMounted) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isMounted]);

  if (!isMounted) return null;

  const updateSlab = (idx: number, field: keyof ChampsSlab, val: string) => {
    setSlabs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: parseFloat(val) || 0 };
      return next;
    });
  };

  const toggleRule = (key: keyof ChampsRules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const canProceed = () => {
    if (step === 0) return !!employeeId && !!financialYear && !!gm2TargetCr && !conflict;
    if (step === 1) return slabs.some((s) => s.gm2AchievementLacs > 0);
    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        employeeId,
        employeeName,
        financialYear,
        fyDateRange,
        publishedDate,
        gm2TargetCr,
        slabs,
        mintValue,
        incentiveSchemeName,
        rules,
        customRuleText,
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsPdfLoading(true);
    try {
      await downloadChampsPdf(champsData);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const RULE_LABELS: Record<keyof ChampsRules, string> = {
    collectionRiders: 'Collection Riders (payment timing multipliers)',
    mintAiMultiplier: 'MINT-AI™ Solutions 1.15× multiplier',
    q1Qualifier: 'Q1 Target qualifier (25% by Jun 30)',
    teamPerformanceLink: 'Team performance incentive linkage',
    oemBackend: '50% OEM back-end scheme in Contribution',
    advanceWithdrawal: 'AMC & Sales independence + ₹50K/qtr advance',
    bdDeduction: 'BD > 10% Net Margin → 2× deduction',
    schemeReview: 'Formal scheme review at end of Q2',
    repairContribution: 'One-time Repair: Contribution = GM × 0.8',
    miscMargin: 'Misc / page-per-print = margin after costing',
    collectionCycle: 'Achievement = complete sales cycle + collection',
    topLineDefinition: 'Top Line definition (billing price excl. GST)',
    teamThreshold: 'Team total < ₹600L GM2 → 25% payout reduction',
  };

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClass}`}>
      <div className={`relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] ${cardClass}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#0d3b5e] to-[#1d4ed8] rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">
              {report?.id ? 'Edit' : 'Create'} MINT Champs Report
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">Sales incentive scheme document</p>
          </div>
          <button onClick={requestClose} aria-label="Close" className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 overflow-x-auto">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  i === step
                    ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                    : i < step
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500 cursor-default'
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === step ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>{i + 1}</span>
                )}
                {label}
              </button>
              {i < STEP_LABELS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0 mx-1" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── STEP 0: Employee + FY + Target ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sales / Service Employee <span className="text-rose-500">*</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlySalesAndService}
                        onChange={(e) => setOnlySalesAndService(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                      />
                      <span className="font-medium">Filter: Sales &amp; Service only</span>
                    </label>
                  </div>

                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">— Select employee —</option>
                    {displayedEmployees.map((emp) => {
                      const dept = emp.departmentName || departments?.find((d) => d.id === emp.departmentId)?.name || '';
                      const desig = emp.designationName || '';
                      const tag = [dept, desig].filter(Boolean).join(' • ');
                      const taken = existingReportFor(emp.id);
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeCode}){tag ? ` — ${tag}` : ''}
                          {taken ? ` — already has a ${taken.financialYear} report (${(taken.status || 'DRAFT').toLowerCase()})` : ''}
                        </option>
                      );
                    })}
                  </select>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      Showing {displayedEmployees.length} of {employees.length} employees
                      {onlySalesAndService ? ' (filtered to Sales & Service)' : ' (showing all departments)'}
                    </span>
                    {onlySalesAndService && employees.length > displayedEmployees.length && (
                      <button
                        type="button"
                        onClick={() => setOnlySalesAndService(false)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                      >
                        Show all {employees.length} employees
                      </button>
                    )}
                    {!onlySalesAndService && (
                      <button
                        type="button"
                        onClick={() => setOnlySalesAndService(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                      >
                        Filter to Sales &amp; Service
                      </button>
                    )}
                  </div>

                  {conflict && (
                    <div role="alert" className="mt-2 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3 py-2.5 rounded-lg">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">
                          {selectedEmployee?.name || 'This employee'} already has a {conflict.financialYear} report ({(conflict.status || 'DRAFT').toLowerCase()}).
                        </p>
                        <p className="mt-0.5 text-rose-700 dark:text-rose-400">
                          A new report can't be created for the same year. Choose another employee or financial year, or edit the existing report from the list.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedEmployee && !conflict && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 px-3 py-2 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                      <span className="font-semibold">{selectedEmployee.name}</span>
                      <span className="text-indigo-300 dark:text-indigo-700">•</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {selectedEmployee.departmentName || departments?.find((d) => d.id === selectedEmployee.departmentId)?.name || 'No Department'}
                      </span>
                      {selectedEmployee.designationName && (
                        <>
                          <span className="text-indigo-300 dark:text-indigo-700">•</span>
                          <span className="text-slate-500 dark:text-slate-400">{selectedEmployee.designationName}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Financial Year <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    placeholder="e.g. FY 2026-27"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">FY Date Range</label>
                  <input
                    type="text"
                    value={fyDateRange}
                    onChange={(e) => setFyDateRange(e.target.value)}
                    placeholder="e.g. 01.04.2026 – 31.03.2027"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Published Date</label>
                  <input
                    type="text"
                    value={publishedDate}
                    onChange={(e) => setPublishedDate(e.target.value)}
                    placeholder="e.g. 1st April 2026"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GM2 Individual Target <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent overflow-hidden">
                    <span className="pl-3 pr-1 text-sm text-slate-500 dark:text-slate-400 font-medium select-none">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={targetNumber}
                      onChange={(e) => setTargetNumber(e.target.value)}
                      placeholder="e.g. 0.96"
                      className="flex-1 min-w-0 text-sm py-2 px-2 bg-transparent text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                    <select
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value as any)}
                      className="text-xs font-semibold border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 py-2.5 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Cr">Cr</option>
                      <option value="Lacs">Lacs</option>
                    </select>
                  </div>
                  {targetNumber && (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Target: <span className="text-amber-600 dark:text-amber-400 font-bold">₹{targetNumber} {targetUnit}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">MINT Value</label>
                  <input
                    type="text"
                    value={mintValue}
                    onChange={(e) => setMintValue(e.target.value)}
                    placeholder="e.g. Strive for Excellence"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Scheme Name / Subtitle <span className="text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={incentiveSchemeName}
                    onChange={(e) => setIncentiveSchemeName(e.target.value)}
                    placeholder="e.g. added Neeraj portion too"
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: Incentive Slabs ── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter the 4 incentive milestone rows. These will appear in the slab table on the document.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-[#0d3b5e] text-white text-xs">
                    <tr>
                      <th className="py-2.5 px-3 text-center font-semibold w-8">#</th>
                      <th className="py-2.5 px-3 text-center font-semibold">AMC Target (Lacs)</th>
                      <th className="py-2.5 px-3 text-center font-semibold">AMC Incentive (Lacs)</th>
                      <th className="py-2.5 px-3 text-center font-semibold">GM2 Achievement (Lacs)</th>
                      <th className="py-2.5 px-3 text-center font-semibold">Sales Incentive (Lacs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {slabs.map((slab, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'}>
                        <td className="py-2 px-3 text-center text-xs font-bold text-slate-500">{i + 1}</td>
                        {(['amcTargetLacs', 'amcIncentiveLacs', 'gm2AchievementLacs', 'salesIncentiveLacs'] as (keyof ChampsSlab)[]).map((field) => (
                          <td key={field} className="py-2 px-2">
                            <input
                              type="number"
                              value={slab[field] || ''}
                              onChange={(e) => updateSlab(i, field, e.target.value)}
                              className="w-full text-center text-sm border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tip: The table on the printed document will show exactly these 4 rows with the same column headers.
              </p>
            </div>
          )}

          {/* ── STEP 2: T&C Toggles ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Toggle each standard clause on/off. All enabled clauses will appear in the Terms & Conditions section of the document.</p>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(DEFAULT_CHAMPS_RULES) as (keyof ChampsRules)[]).map((key) => (
                  <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={rules[key]}
                      onChange={() => toggleRule(key)}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{RULE_LABELS[key]}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Custom Additional Rule <span className="text-slate-400">(optional)</span></label>
                <textarea
                  rows={3}
                  value={customRuleText}
                  onChange={(e) => setCustomRuleText(e.target.value)}
                  placeholder="Add any extra custom rule text here..."
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => printChampsReport(champsData)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Preview
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isPdfLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </button>
              </div>

              {/* Mini summary card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
                <div className="bg-[#0d3b5e] text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-base">{employeeName || '—'} — MINT Champs <span className="text-emerald-400">{financialYear}</span></div>
                    <div className="text-xs text-blue-200 mt-0.5">M Intergraph Systems Pvt Ltd | {financialYear} ({fyDateRange})</div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Bottom Line – Individual Target (GM2 Margin)</span>
                  <span className="text-sm font-extrabold bg-amber-600 text-white px-3 py-1 rounded-md">₹{gm2TargetCr}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#0d3b5e] text-white">
                      <tr>
                        <th className="py-2 px-3 text-center">AMC Target (L)</th>
                        <th className="py-2 px-3 text-center">AMC Incentive (L)</th>
                        <th className="py-2 px-3 text-center">GM2 Achievement (L)</th>
                        <th className="py-2 px-3 text-center">Sales Incentive (L)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {slabs.map((s, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'}>
                          <td className="py-2 px-3 text-center font-semibold">{s.amcTargetLacs}</td>
                          <td className="py-2 px-3 text-center font-semibold">{s.amcIncentiveLacs.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center font-semibold">{s.gm2AchievementLacs}</td>
                          <td className="py-2 px-3 text-center font-semibold">{s.salesIncentiveLacs.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-[#0d3b5e] px-5 py-2 text-center text-xs text-slate-400">
                  MINT Value: {mintValue} | solutions@mintergraph.com | www.mintergraph.com
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : requestClose()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {/* Save part-way and finish later: needs only the step-1 essentials (employee, year, target) */}
            {step < STEP_LABELS.length - 1 && (!report?.status || report.status === 'DRAFT') && (
              <button
                onClick={handleSave}
                disabled={isSaving || !employeeId || !financialYear || !gm2TargetCr}
                title={!employeeId || !financialYear || !gm2TargetCr ? 'Pick the employee, financial year and GM2 target first' : undefined}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save as draft
              </button>
            )}
            {step < STEP_LABELS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {report?.id ? 'Save Changes' : 'Create Report'}
              </button>
            )}
          </div>
        </div>

        {/* Unsaved changes prompt (close / cancel with edits) */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 rounded-2xl p-4 modal-backdrop-enter">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="champs-close-title"
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 modal-card-enter"
            >
              <h3 id="champs-close-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                Save your changes before closing?
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {canSaveDraft
                  ? report?.status === 'FINAL'
                    ? 'Saving moves this report back to Draft so it can be reviewed again.'
                    : 'Save it as a draft and finish it later, or discard what you entered.'
                  : 'To save a draft, pick the employee, financial year and GM2 target first.'}
              </p>
              {/* Discard sits apart on the left so it isn't hit by accident; the safe choices group on the right */}
              <div className="mt-5 flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => { setShowCloseConfirm(false); handleClose(); }}
                  className="text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-800"
                >
                  Discard
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="md" onClick={() => setShowCloseConfirm(false)} autoFocus>
                    Keep editing
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={isSaving ? Loader2 : Save}
                    iconSpin={isSaving}
                    disabled={!canSaveDraft || isSaving}
                    onClick={() => { setShowCloseConfirm(false); handleSave().catch(() => {}); }}
                  >
                    Save draft &amp; close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
