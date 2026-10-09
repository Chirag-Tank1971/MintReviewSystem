import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  FileSpreadsheet,
  Printer,
  Archive,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
} from 'lucide-react';
import { Appraisal, Cycle, Department } from '../types';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  DEFAULT_LETTER_SETTINGS,
  LetterSettings,
  exportAppraisalsToZip,
  downloadPayrollCsv,
  generateLetterHtml,
} from '../utils/letterExport';

interface BatchLetterExportModalProps {
  appraisals: Appraisal[];
  departments: Department[];
  cycles: Cycle[];
  onClose: () => void;
}

export const BatchLetterExportModal: React.FC<BatchLetterExportModalProps> = ({
  appraisals,
  departments,
  cycles,
  onClose,
}) => {
  // Filter state
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [filterCycle, setFilterCycle] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOCKED_ONLY' | 'HR_APPROVED_ONLY' | 'LOCKED_OR_APPROVED'>('LOCKED_OR_APPROVED');

  // Selected appraisals for batch export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Template branding settings
  const [settings, setSettings] = useState<LetterSettings>(DEFAULT_LETTER_SETTINGS);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);

  // Progress state
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ onClose });

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExportingZip) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, isExportingZip, handleClose]);

  if (!isMounted) return null;

  // Filter appraisals based on controls
  const filteredAppraisals = appraisals.filter((a) => {
    if (filterStatus === 'LOCKED_OR_APPROVED') {
      if (a.status !== 'LOCKED' && a.status !== 'HR_APPROVED' && !a.isLocked) return false;
    } else if (filterStatus === 'LOCKED_ONLY') {
      if (a.status !== 'LOCKED' && !a.isLocked) return false;
    } else if (filterStatus === 'HR_APPROVED_ONLY') {
      if (a.status !== 'HR_APPROVED') return false;
    }
    if (filterDept !== 'ALL' && a.departmentId !== filterDept) return false;
    if (filterCycle !== 'ALL' && a.cycleId !== filterCycle) return false;
    return true;
  });

  const selectedAppraisalsList = filteredAppraisals.filter((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (selectedAppraisalsList.length === filteredAppraisals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAppraisals.map((a) => a.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Aggregated metrics for selected cohort
  const totalBudgetImpact = selectedAppraisalsList.reduce((acc, a) => {
    const ctc = a.currentCtc || 1800000;
    const incPct = a.approvedIncrementPercentage || a.proposedIncrementPercentage || 12;
    return acc + (a.incrementAmount || Math.round((ctc * incPct) / 100));
  }, 0);

  const avgIncrement =
    selectedAppraisalsList.length > 0
      ? (
          selectedAppraisalsList.reduce((acc, a) => {
            return acc + (a.approvedIncrementPercentage || a.proposedIncrementPercentage || 12);
          }, 0) / selectedAppraisalsList.length
        ).toFixed(1)
      : '0.0';

  const promotionCount = selectedAppraisalsList.filter((a) => a.promotionRecommended).length;

  // Handler: Batch ZIP download
  const handleDownloadZip = async () => {
    if (selectedAppraisalsList.length === 0) {
      const msg = 'Please select at least one employee appraisal to export.';
      setErrorMessage(msg);
      toast.warning(msg, 'No Selection');
      return;
    }

    setIsExportingZip(true);
    setExportProgress({ current: 0, total: selectedAppraisalsList.length });
    setErrorMessage(null);
    setSuccessMessage(null);
    toast.info(`Generating ${selectedAppraisalsList.length} appraisal letters in ZIP archive...`, 'Packaging ZIP');

    try {
      await exportAppraisalsToZip(selectedAppraisalsList, settings, (current, total) => {
        setExportProgress({ current, total });
      });
      const succMsg = `Successfully generated and packaged ${selectedAppraisalsList.length} appraisal letters with payroll CSV into ZIP!`;
      setSuccessMessage(succMsg);
      toast.success(succMsg, 'Batch Export Complete');
    } catch (err: any) {
      console.error('Batch export failed:', err);
      const errMsg = err.message || 'Failed to generate batch ZIP. Please try again.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Export Failed');
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Handler: Payroll CSV
  const handleDownloadCsv = () => {
    if (selectedAppraisalsList.length === 0) {
      const msg = 'Please select at least one record to export.';
      setErrorMessage(msg);
      toast.warning(msg, 'No Selection');
      return;
    }
    downloadPayrollCsv(selectedAppraisalsList);
    const succMsg = `Exported payroll reconciliation CSV with ${selectedAppraisalsList.length} records.`;
    setSuccessMessage(succMsg);
    toast.success(succMsg, 'Payroll CSV Ready');
  };

  // Handler: Multi-page Print
  const handlePrintAll = () => {
    if (selectedAppraisalsList.length === 0) {
      setErrorMessage('Please select at least one appraisal to print.');
      return;
    }

    // Build concatenated HTML document with page breaks
    const pagesHtml = selectedAppraisalsList
      .map((appraisal, index) => {
        const rawHtml = generateLetterHtml(appraisal, settings);
        // Extract inner container content
        const match = rawHtml.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/i);
        const innerContent = match ? match[1] : '';
        return `
          <div class="page" style="page-break-after: ${index === selectedAppraisalsList.length - 1 ? 'auto' : 'always'}; padding: 24px; max-width: 760px; margin: 0 auto;">
            ${innerContent}
          </div>
        `;
      })
      .join('');

    const fullDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Batch Appraisal Letters (${selectedAppraisalsList.length} Employees)</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; font-size: 11.5px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #312e81; padding-bottom: 10px; margin-bottom: 14px; }
          .brand-title { font-size: 16px; font-weight: 800; color: #1e1b4b; }
          .brand-sub { font-size: 10px; color: #64748b; }
          .ref-block { text-align: right; font-size: 11px; }
          .confidential-tag { font-size: 9px; font-weight: 800; color: #dc2626; letter-spacing: 1px; }
          .recipient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
          .recipient-name { grid-column: span 2; font-size: 13px; font-weight: 800; }
          .subject-line { font-weight: 800; font-size: 12px; margin: 10px 0 8px 0; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; }
          .highlight-pill { background: #eef2ff; color: #3730a3; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe; }
          .promotion-box { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 8px 10px; margin: 10px 0; font-size: 10.5px; color: #92400e; }
          .table-container { margin: 12px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th { background: #f1f5f9; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
          td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
          .table-total { background: #f8fafc; font-weight: 700; border-top: 1.5px solid #cbd5e1; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .positive-inc { color: #059669; font-weight: 700; }
          .quarterly-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0; }
          .q-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; }
          .q-score { font-size: 12px; font-weight: 800; }
          .signatures-section { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
          .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; text-align: center; }
          .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; }
          .sig-name { font-weight: 700; font-size: 10.5px; }
          .sig-role { font-size: 9px; color: #64748b; }
          .sig-status { font-size: 8px; color: #059669; font-weight: 600; }
          .ack-box { margin-top: 10px; padding: 6px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 9.5px; color: #166534; }
          .footer-note { font-size: 8.5px; color: #94a3b8; text-align: center; margin-top: 14px; border-top: 1px solid #f1f5f9; padding-top: 6px; }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(fullDoc);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print restricted:', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 400);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] overflow-y-auto bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 my-auto ${cardClass}`}>
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Export letters and payroll</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Automated
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Bulk generate branded PDF compensation letters, ZIP archives, and payroll reconciliation sheets.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isExportingZip}
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-800 dark:text-slate-200 text-xs">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 block">
                Selected for export
              </span>
              <div className="text-xl font-bold text-indigo-950 dark:text-white tabular-nums mt-0.5">
                {selectedAppraisalsList.length}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {filteredAppraisals.length}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                Avg increment
              </span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">+{avgIncrement}%</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                Annual payroll impact
              </span>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                +₹{(totalBudgetImpact / 100000).toFixed(2)} Lakhs
              </div>
            </div>

            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block">
                Promotions
              </span>
              <div className="text-xl font-bold text-amber-800 dark:text-amber-400 tabular-nums mt-0.5">
                {promotionCount}{' '}
                <span className="text-xs font-normal text-amber-600 dark:text-amber-400">employees</span>
              </div>
            </div>
          </div>

          {/* Filtering & Controls Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Workflow status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOCKED_OR_APPROVED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Locked & HR approved (ready for letters)</option>
                    <option value="LOCKED_ONLY" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Locked & released only</option>
                    <option value="HR_APPROVED_ONLY" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">HR approved only</option>
                    <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All appraisals (including pending)</option>
                  </select>
                </div>

                {/* Department Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Department
                  </label>
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cycle Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Cohort cycle
                  </label>
                  <select
                    value={filterCycle}
                    onChange={(e) => setFilterCycle(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All cycles</option>
                    {cycles.filter((c) => c.active !== false).map((c) => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {c.name} (Month {c.appraisalMonth})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Customizer Toggle Button */}
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors self-end cursor-pointer ${
                  showSettingsDrawer
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Letterhead & format settings</span>
              </button>
            </div>

            {/* Template Settings Form (Collapsible) */}
            {showSettingsDrawer && (
              <div className="p-4 bg-white dark:bg-slate-850 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3 mt-3 animate-in fade-in duration-150">
                <div className="font-bold text-xs text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Corporate letterhead & signatory customization</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Company / entity name</label>
                    <input
                      type="text"
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Division / org header</label>
                    <input
                      type="text"
                      value={settings.divisionName}
                      onChange={(e) => setSettings({ ...settings, divisionName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Authorized signatory name</label>
                    <input
                      type="text"
                      value={settings.signatoryName}
                      onChange={(e) => setSettings({ ...settings, signatoryName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Signatory title</label>
                    <input
                      type="text"
                      value={settings.signatoryTitle}
                      onChange={(e) => setSettings({ ...settings, signatoryTitle: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={settings.includeBreakdown}
                      onChange={(e) => setSettings({ ...settings, includeBreakdown: e.target.checked })}
                      className="rounded text-indigo-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    />
                    <span>Include 5-component CTC breakdown (basic, HRA, special allowance, PF)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={settings.includeQuarterlyHistory}
                      onChange={(e) => setSettings({ ...settings, includeQuarterlyHistory: e.target.checked })}
                      className="rounded text-indigo-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    />
                    <span>Include rolling 4-quarter review scorecard</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Progress Indicator when Generating ZIP */}
          {isExportingZip && exportProgress && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-2 text-center animate-in fade-in">
              <div className="flex items-center justify-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span>
                  Generating High-Res PDF Letters: {exportProgress.current} / {exportProgress.total} completed...
                </span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-900/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Packaging formatted PDF documents and payroll CSV into .zip archive.
              </p>
            </div>
          )}

          {/* Table of Appraisals with Checkboxes */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredAppraisals.length > 0 && selectedAppraisalsList.length === filteredAppraisals.length}
                  onChange={toggleSelectAll}
                  className="rounded text-indigo-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-4 h-4"
                />
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Select All Filtered ({selectedAppraisalsList.length} / {filteredAppraisals.length} selected)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Cohort: {filterCycle === 'ALL' ? 'All Cycles' : filterCycle}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAppraisals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  No appraisal records match your selected filters.
                </div>
              ) : (
                filteredAppraisals.map((appraisal) => {
                  const isChecked = selectedIds.has(appraisal.id);
                  const incPct =
                    appraisal.approvedIncrementPercentage || appraisal.proposedIncrementPercentage || 12;
                  const currentCtc = appraisal.currentCtc || 1800000;
                  const revisedCtc =
                    appraisal.revisedCtc || currentCtc + Math.round((currentCtc * incPct) / 100);

                  return (
                    <div
                      key={appraisal.id}
                      onClick={() => toggleSelectOne(appraisal.id)}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-4 h-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{appraisal.employeeName}</span>
                            <span className="text-[11px] tabular-nums px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {appraisal.employeeCode}
                            </span>
                            {appraisal.promotionRecommended && (
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                                Promoted
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                            <span>{appraisal.departmentName}</span>
                            <span>•</span>
                            <span>{appraisal.designationName}</span>
                            <span>•</span>
                            <span style={{ color: appraisal.cycleColor || '#4f46e5' }} className="font-semibold">
                              {appraisal.cycleName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <div className="tabular-nums font-bold text-slate-900 dark:text-white">
                            ₹{revisedCtc.toLocaleString()}
                          </div>
                          <div className="text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                            +{incPct}% (₹{currentCtc.toLocaleString()} prev)
                          </div>
                        </div>

                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                            appraisal.status === 'LOCKED'
                              ? 'bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600'
                              : appraisal.status === 'HR_APPROVED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {appraisal.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <strong className="text-slate-800 dark:text-slate-200">{selectedAppraisalsList.length}</strong> of <strong className="text-slate-800 dark:text-slate-200">{appraisals.length}</strong> employee letters selected
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action 1: Payroll Reconciliation CSV */}
            <button
              type="button"
              disabled={selectedAppraisalsList.length === 0 || isExportingZip}
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Download detailed payroll reconciliation CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export payroll CSV</span>
            </button>

            {/* Action 2: Multi-Page Print Preview */}
            <button
              type="button"
              disabled={selectedAppraisalsList.length === 0 || isExportingZip}
              onClick={handlePrintAll}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Print all selected letters with page breaks"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Print All ({selectedAppraisalsList.length})</span>
            </button>

            {/* Action 3: Batch ZIP Download */}
            <button
              type="button"
              disabled={selectedAppraisalsList.length === 0 || isExportingZip}
              onClick={handleDownloadZip}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isExportingZip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isExportingZip ? 'Packaging ZIP...' : `Download Letters ZIP (${selectedAppraisalsList.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
