import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy, Plus, Search, RefreshCw, Lock, CheckCircle2,
  Download, Printer, Pencil, Loader2, Trash2, AlertTriangle,
} from 'lucide-react';
import { Employee, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/StatusBadge';
import { SegmentedControl } from './ui/SegmentedControl';
import { SELECT_CLASS } from './ui/formStyles';
import { SalesChampsReportModal, SalesChampsReport } from './SalesChampsReportModal';
import { downloadChampsPdf, printChampsReport, champsTermsHtml, ChampsReportData } from '../utils/salesChampsExport';
import { cn } from '../utils/cn';

interface Props {
  employees: Employee[];
  departments?: Department[];
}

type FilterStatus = 'ALL' | 'DRAFT' | 'FINAL' | 'LOCKED';

const STATUS_TONE = {
  DRAFT: { label: 'Draft', tone: 'warning' },
  FINAL: { label: 'Final', tone: 'info' },
  LOCKED: { label: 'Locked', tone: 'success' },
} as const;

function toChampsData(r: SalesChampsReport): ChampsReportData {
  return {
    employeeName: r.employeeName,
    financialYear: r.financialYear,
    fyDateRange: r.fyDateRange,
    publishedDate: r.publishedDate,
    gm2TargetCr: r.gm2TargetCr,
    slabs: r.slabs,
    mintValue: r.mintValue,
    incentiveSchemeName: r.incentiveSchemeName,
    rules: r.rules,
    customRuleText: r.customRuleText,
  };
}

type PendingConfirm = { kind: 'lock' | 'delete'; report: SalesChampsReport } | null;

export const SalesChampsView: React.FC<Props> = ({ employees, departments }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isHR = user?.role === 'HR';
  const isManagementOrAdmin = isAdmin || isHR;

  const [reports, setReports] = useState<SalesChampsReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [fyFilter, setFyFilter] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<SalesChampsReport | null>(null);

  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isManagementOrAdmin) {
        // Year and status are filtered client-side: the counts and year list stay complete, and the
        // create form can see every existing report to block duplicates
        const data = await api.getSalesChampsReports();
        setReports(data || []);
      } else if (user?.employeeId) {
        const data = await api.getMySalesChampsReports(user.employeeId);
        setReports(data || []);
      } else {
        setReports([]);
      }
      setSelectedIdx(0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Sales Champs reports.');
    } finally {
      setIsLoading(false);
    }
  }, [isManagementOrAdmin, user?.employeeId]);

  useEffect(() => { load(); }, [load]);

  const fyOptions = useMemo(() => {
    const years = Array.from(new Set(reports.map((r) => r.financialYear).filter(Boolean)));
    return years.sort();
  }, [reports]);

  const yearReports = fyFilter ? reports.filter((r) => r.financialYear === fyFilter) : reports;
  const filtered = yearReports.filter((r) => {
    if (statusFilter !== 'ALL' && (r.status || 'DRAFT') !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || r.employeeName.toLowerCase().includes(q) || r.financialYear.toLowerCase().includes(q);
  });

  const handleCreate = async (data: Omit<SalesChampsReport, 'id' | 'status'>) => {
    try {
      if (editingReport?.id) {
        const wasFinal = editingReport.status === 'FINAL';
        await api.updateSalesChampsReport(editingReport.id, data);
        toast.success(wasFinal ? 'Report updated and moved back to Draft for review.' : 'Report updated.');
      } else {
        await api.createSalesChampsReport(data);
        toast.success('Report created.');
      }
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save report.');
      throw err;
    }
  };

  const runAction = async (id: string, kind: string, fn: () => Promise<unknown>, success: string) => {
    setActionLoading((p) => ({ ...p, [id]: kind }));
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${kind} report.`);
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleFinalize = (id: string) =>
    runAction(id, 'finalize', () => api.finalizeSalesChampsReport(id), 'Report marked as Final.');

  const handleConfirmed = async () => {
    if (!pendingConfirm?.report.id) return;
    const { kind, report } = pendingConfirm;
    const id = report.id!;
    setPendingConfirm(null);
    if (kind === 'lock') {
      await runAction(id, 'lock', () => api.lockSalesChampsReport(id), `Report locked. ${report.employeeName} has been notified.`);
    } else {
      await runAction(id, 'delete', () => api.deleteSalesChampsReport(id), 'Report deleted.');
    }
  };

  const handleDownloadPdf = async (r: SalesChampsReport) => {
    setPdfLoading(r.id!);
    try {
      await downloadChampsPdf(toChampsData(r));
    } finally {
      setPdfLoading(null);
    }
  };

  if (!isManagementOrAdmin) {
    const activeReport = reports[selectedIdx] || reports[0];
    const isPdfDl = activeReport?.id ? pdfLoading === activeReport.id : false;
    const terms = activeReport ? champsTermsHtml(activeReport) : { left: [], right: [] };

    return (
      <div className="space-y-6">
        <PageHeader
          title="My Sales Champs Scheme"
          description="Your officially approved and locked sales incentive scheme document."
          actions={
            activeReport ? (
              <>
                <Button icon={Printer} onClick={() => printChampsReport(toChampsData(activeReport))}>
                  Print preview
                </Button>
                <Button
                  variant="primary"
                  icon={isPdfDl ? Loader2 : Download}
                  iconSpin={isPdfDl}
                  disabled={isPdfDl}
                  onClick={() => handleDownloadPdf(activeReport)}
                >
                  Download PDF
                </Button>
              </>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your scheme document…
          </div>
        ) : !activeReport ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-lg mx-auto">
            <Trophy className="w-8 h-8 mx-auto mb-3 text-slate-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No incentive scheme yet</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Your MINT Champs incentive document will appear here once it has been reviewed and locked by administration.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {reports.length > 1 && (
              <SegmentedControl
                ariaLabel="Financial year"
                options={reports.map((r, i) => ({ value: String(i), label: r.financialYear }))}
                value={String(selectedIdx)}
                onChange={(v) => setSelectedIdx(Number(v))}
              />
            )}

            {/* Scheme document: keeps the printed letterhead's look so it matches the PDF */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
              <div className="bg-[#0d3b5e] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tracking-tight">M<span className="text-emerald-400">INT</span></div>
                  <div className="text-[11px] text-slate-300 italic">MINT Value: {activeReport.mintValue || 'Strive for Excellence'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">MINT Champs {activeReport.financialYear}</div>
                  <div className="text-[11px] text-slate-300">M Intergraph Systems Pvt Ltd · MINT-Internal Document</div>
                </div>
              </div>

              <div className="bg-[#1e3a5f] text-white px-6 py-4 text-center">
                <div className="text-xl font-semibold tracking-tight">
                  {activeReport.employeeName} — MINT Champs <span className="text-emerald-400">{activeReport.financialYear}</span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center justify-center gap-2 flex-wrap">
                  <span>{activeReport.financialYear}{activeReport.fyDateRange ? ` (${activeReport.fyDateRange})` : ''}</span>
                  {activeReport.publishedDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Published {activeReport.publishedDate}</span>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-[11px] font-medium px-2 py-0.5 rounded-md ml-1">
                    <Lock className="w-3 h-3" aria-hidden="true" /> Locked &amp; official
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      Bottom line: individual target (GM2 margin)
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Your annual GM2 achievement requirement
                    </p>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                    ₹{activeReport.gm2TargetCr}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Incentive scheme {activeReport.incentiveSchemeName ? `(${activeReport.incentiveSchemeName})` : ''}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs tabular-nums">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="py-2.5 px-3 text-right font-medium">Total AMC target (Lacs)</th>
                          <th className="py-2.5 px-3 text-right font-medium">Incentive for AMC (Lacs)</th>
                          <th className="py-2.5 px-3 text-right font-medium">GM2 contribution achievement (Lacs)</th>
                          <th className="py-2.5 px-3 text-right font-medium">Total incentive for sales (Lacs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {activeReport.slabs?.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 text-right">{s.amcTargetLacs}</td>
                            <td className="py-2.5 px-3 text-right">{(Number(s.amcIncentiveLacs) || 0).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right">{s.gm2AchievementLacs}</td>
                            <td className="py-2.5 px-3 text-right font-semibold">{(Number(s.salesIncentiveLacs) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-850 rounded-lg p-5 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Terms &amp; conditions</h4>
                  {/* Same HR-selected terms as the PDF; fixed strings plus escaped custom text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                    <ul className="space-y-2 list-disc pl-4 [&_ul]:list-[circle] [&_ul]:text-slate-600 dark:[&_ul]:text-slate-400" dangerouslySetInnerHTML={{ __html: terms.left.join('') }} />
                    <ul className="space-y-2 list-disc pl-4" dangerouslySetInnerHTML={{ __html: terms.right.join('') }} />
                  </div>
                </div>
              </div>

              <div className="bg-[#0d3b5e] text-white px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span><strong>MINT Value:</strong> {activeReport.mintValue || 'Strive for Excellence'}</span>
                <span>solutions@mintergraph.com · www.mintergraph.com</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const countFor = (s: FilterStatus) => (s === 'ALL' ? yearReports.length : yearReports.filter((r) => (r.status || 'DRAFT') === s).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Champs"
        description="Incentive scheme documents for the sales team. Draft → Final (HR) → Locked (Super Admin), then the employee can see it."
        actions={
          <Button variant="primary" size="md" icon={Plus} onClick={() => { setEditingReport(null); setIsModalOpen(true); }}>
            New report
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or year…"
            aria-label="Search reports"
            className="w-full h-8 pl-8 pr-3 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600"
          />
        </div>

        {fyOptions.length > 0 && (
          <select value={fyFilter} onChange={(e) => setFyFilter(e.target.value)} aria-label="Financial year" className={SELECT_CLASS}>
            <option value="">All years</option>
            {fyOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        )}

        <SegmentedControl
          ariaLabel="Status"
          options={(['ALL', 'DRAFT', 'FINAL', 'LOCKED'] as FilterStatus[]).map((s) => ({
            value: s,
            label: `${s === 'ALL' ? 'All' : STATUS_TONE[s].label} (${countFor(s)})`,
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        <Button variant="ghost" icon={RefreshCw} iconSpin={isLoading} onClick={load} aria-label="Refresh" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading reports…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
            <Trophy className="w-8 h-8 text-slate-400" aria-hidden="true" />
            <p className="text-sm">No reports found</p>
            {reports.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => { setEditingReport(null); setIsModalOpen(true); }}>
                Create first report
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Employee</th>
                  <th className="py-3 px-4 text-left font-medium">Financial year</th>
                  <th className="py-3 px-4 text-right font-medium">GM2 target</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Created by</th>
                  <th className="py-3 px-4 text-left font-medium">Updated</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((r) => {
                  const status = STATUS_TONE[r.status || 'DRAFT'];
                  const isActing = actionLoading[r.id!];
                  const isPdfDl = pdfLoading === r.id;
                  const isLocked = r.status === 'LOCKED';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{r.employeeName}</td>
                      <td className="py-3 px-4">{r.financialYear}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900 dark:text-white">₹{r.gm2TargetCr}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={status.label} tone={status.tone} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{r.createdByName || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 tabular-nums">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              icon={Pencil}
                              aria-label={`Edit ${r.employeeName}`}
                              title={r.status === 'FINAL' ? 'Edit (moves the report back to Draft)' : 'Edit'}
                              onClick={() => { setEditingReport(r); setIsModalOpen(true); }}
                            />
                          )}
                          {r.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              icon={isActing === 'finalize' ? Loader2 : CheckCircle2}
                              iconSpin={isActing === 'finalize'}
                              disabled={!!isActing}
                              title="Mark as Final"
                              onClick={() => handleFinalize(r.id!)}
                            >
                              Finalize
                            </Button>
                          )}
                          {isAdmin && r.status === 'FINAL' && (
                            <Button
                              variant="secondary"
                              icon={isActing === 'lock' ? Loader2 : Lock}
                              iconSpin={isActing === 'lock'}
                              disabled={!!isActing}
                              title="Lock and publish to the employee"
                              onClick={() => setPendingConfirm({ kind: 'lock', report: r })}
                            >
                              Lock
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            icon={Printer}
                            aria-label="Print preview"
                            title="Print preview"
                            onClick={() => printChampsReport(toChampsData(r))}
                          />
                          <Button
                            variant="ghost"
                            icon={isPdfDl ? Loader2 : Download}
                            iconSpin={isPdfDl}
                            disabled={isPdfDl}
                            aria-label="Download PDF"
                            title="Download PDF"
                            onClick={() => handleDownloadPdf(r)}
                          />
                          {isAdmin && !isLocked && (
                            <Button
                              variant="ghost"
                              icon={isActing === 'delete' ? Loader2 : Trash2}
                              iconSpin={isActing === 'delete'}
                              disabled={!!isActing}
                              aria-label={`Delete ${r.employeeName}'s report`}
                              title="Delete"
                              className="hover:text-rose-700 dark:hover:text-rose-400"
                              onClick={() => setPendingConfirm({ kind: 'delete', report: r })}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {isModalOpen && (
        <SalesChampsReportModal
          report={editingReport}
          employees={employees}
          departments={departments}
          existingReports={reports}
          onSave={handleCreate}
          onClose={() => { setIsModalOpen(false); setEditingReport(null); }}
        />
      )}

      {/* Lock / delete confirmation */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-900/60 p-4 modal-backdrop-enter">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="champs-confirm-title"
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 modal-card-enter"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={cn('w-5 h-5 shrink-0 mt-0.5', pendingConfirm.kind === 'delete' ? 'text-rose-600' : 'text-amber-600')}
                aria-hidden="true"
              />
              <div>
                <h3 id="champs-confirm-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                  {pendingConfirm.kind === 'lock'
                    ? `Lock ${pendingConfirm.report.employeeName}'s ${pendingConfirm.report.financialYear} scheme?`
                    : `Delete ${pendingConfirm.report.employeeName}'s ${pendingConfirm.report.financialYear} report?`}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {pendingConfirm.kind === 'lock'
                    ? 'The employee will be notified and can view and download it. A locked report can never be edited or deleted.'
                    : 'This removes the report permanently. It cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setPendingConfirm(null)} autoFocus>Cancel</Button>
              <Button
                variant="primary"
                icon={pendingConfirm.kind === 'lock' ? Lock : Trash2}
                className={pendingConfirm.kind === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : undefined}
                onClick={handleConfirmed}
              >
                {pendingConfirm.kind === 'lock' ? 'Lock report' : 'Delete report'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
