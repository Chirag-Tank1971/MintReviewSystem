import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy, Plus, Search, RefreshCw, Lock, CheckCircle2,
  FileText, Download, Printer, Pencil, Loader2, Filter,
  ShieldCheck, Clock, AlertCircle,
} from 'lucide-react';
import { Employee, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { PageHeader } from './ui/PageHeader';
import { SalesChampsReportModal, SalesChampsReport } from './SalesChampsReportModal';
import { downloadChampsPdf, printChampsReport, ChampsReportData } from '../utils/salesChampsExport';
import { cn } from '../utils/cn';

interface Props {
  employees: Employee[];
  departments?: Department[];
}

type FilterStatus = 'ALL' | 'DRAFT' | 'FINAL' | 'LOCKED';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  DRAFT: {
    label: 'Draft',
    icon: <Clock className="w-3 h-3" />,
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  FINAL: {
    label: 'Final',
    icon: <CheckCircle2 className="w-3 h-3" />,
    cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  LOCKED: {
    label: 'Locked',
    icon: <Lock className="w-3 h-3" />,
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

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

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isManagementOrAdmin) {
        const data = await (api as any).getSalesChampsReports({
          financialYear: fyFilter || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        });
        setReports(data || []);
      } else if (user?.employeeId) {
        const data = await (api as any).getMySalesChampsReports(user.employeeId, fyFilter || undefined);
        setReports(data || []);
      } else {
        setReports([]);
      }
    } catch {
      toast.error('Failed to load Sales Champs reports.');
    } finally {
      setIsLoading(false);
    }
  }, [fyFilter, statusFilter, isManagementOrAdmin, user?.employeeId]);

  useEffect(() => { load(); }, [load]);

  const fyOptions = useMemo(() => {
    const years = Array.from(new Set(reports.map((r) => r.financialYear).filter(Boolean)));
    return years.sort();
  }, [reports]);

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.employeeName.toLowerCase().includes(q) || r.financialYear.toLowerCase().includes(q);
  });

  const handleCreate = async (data: Omit<SalesChampsReport, 'id' | 'status'>) => {
    try {
      if (editingReport?.id) {
        await (api as any).updateSalesChampsReport(editingReport.id, data);
        toast.success('Report updated.');
      } else {
        await (api as any).createSalesChampsReport(data);
        toast.success('Report created.');
      }
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save report.');
      throw err;
    }
  };

  const handleFinalize = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: 'finalize' }));
    try {
      await (api as any).finalizeSalesChampsReport(id);
      toast.success('Report marked as Final.');
      await load();
    } catch {
      toast.error('Failed to finalize.');
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleLock = async (id: string) => {
    setActionLoading((p) => ({ ...p, [id]: 'lock' }));
    try {
      await (api as any).lockSalesChampsReport(id);
      toast.success('Report locked.');
      await load();
    } catch {
      toast.error('Failed to lock.');
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
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

    return (
      <div className="space-y-6">
        <PageHeader
          title="My Sales Champs Scheme"
          description="Your officially approved and locked sales incentive scheme document."
          actions={
            activeReport ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printChampsReport(toChampsData(activeReport))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Preview
                </button>
                <button
                  type="button"
                  disabled={isPdfDl}
                  onClick={() => handleDownloadPdf(activeReport)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isPdfDl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download Official PDF
                </button>
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your scheme document…
          </div>
        ) : !activeReport ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Locked Incentive Scheme Available</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Your MINT Champs incentive document will appear here once it has been officially reviewed and locked by administration.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {reports.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Financial Year:</span>
                <div className="flex gap-1.5">
                  {reports.map((r, i) => (
                    <button
                      key={r.id || i}
                      onClick={() => setSelectedIdx(i)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors',
                        selectedIdx === i
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                      )}
                    >
                      {r.financialYear}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scheme Document Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              <div className="bg-[#0d3b5e] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-black tracking-tight">M<span className="text-emerald-400">INT</span></div>
                  <div className="text-[11px] text-slate-300 italic">MINT Value: {activeReport.mintValue || 'Strive for Excellence'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">MINT Champs {activeReport.financialYear}</div>
                  <div className="text-[11px] text-slate-300">M Intergraph Systems Pvt Ltd &bull; MINT-Internal Document</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#1e3a5f] via-[#1e40af] to-[#1d4ed8] text-white px-6 py-4 text-center">
                <div className="text-xl font-bold tracking-tight">
                  {activeReport.employeeName} &mdash; MINT Champs <span className="text-emerald-400">{activeReport.financialYear}</span>
                </div>
                <div className="text-xs text-blue-100 mt-1 flex items-center justify-center gap-2 flex-wrap">
                  <span>M Intergraph Systems Pvt Ltd</span>
                  <span>&bull;</span>
                  <span>{activeReport.financialYear} ({activeReport.fyDateRange || '01.04.2026 – 31.03.2027'})</span>
                  <span>&bull;</span>
                  <span>Published {activeReport.publishedDate || '1st April 2026'}</span>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                    <Lock className="w-3 h-3" /> Locked &amp; Official
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#0d3b5e]">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Bottom Line &ndash; Individual Target (GM2 Margin)
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Your annual GM2 achievement milestone requirement
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black text-xl px-5 py-2 rounded-xl shadow-xs">
                    ₹{activeReport.gm2TargetCr}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0d3b5e] dark:text-blue-400 mb-2">
                    Incentive Scheme {activeReport.incentiveSchemeName ? `(${activeReport.incentiveSchemeName})` : ''}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0d3b5e] text-white">
                        <tr>
                          <th className="py-2.5 px-3 text-center font-semibold">Total AMC Target<br/>in Lacs</th>
                          <th className="py-2.5 px-3 text-center font-semibold">Incentive for AMC<br/>(in Lacs)</th>
                          <th className="py-2.5 px-3 text-center font-semibold">GM2 Contribution Achievement<br/>(in Lacs)</th>
                          <th className="py-2.5 px-3 text-center font-semibold">Total Incentive in Lacs<br/>(for Sales)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activeReport.slabs?.map((s, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-850' : 'bg-white dark:bg-slate-900'}>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{s.amcTargetLacs}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{s.amcIncentiveLacs?.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{s.gm2AchievementLacs}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">{s.salesIncentiveLacs?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-850 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-[#0d3b5e] dark:text-blue-400 mb-3">
                    Terms &amp; Conditions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                    <ul className="space-y-2 list-disc pl-4">
                      <li><strong>Collection riders</strong> (payment timing multipliers):
                        <ul className="list-circle pl-4 mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                          <li>Within 15 days: Achievement = Achv &times; 1.20</li>
                          <li>Within 21 days: Achievement = Achv &times; 1.10</li>
                          <li>Within 22–30 days: No adjustment</li>
                          <li>Within 31–45 days: Achievement = Achv &times; 0.85</li>
                          <li>After 45 days: Achievement = Achv &times; 0.75</li>
                          <li>Add 7 days for Public Undertakings and 15 days for other Govt.</li>
                        </ul>
                      </li>
                      <li><strong>Top Line</strong> is billing price to client without GST.</li>
                      <li><strong>All One-time Repair:</strong> Contribution = Gross Margin &times; 0.8</li>
                      <li><strong>Team Performance:</strong> Linked to individual achievement on sliding ratio scale.</li>
                      <li><strong>Advance Withdrawal:</strong> You can withdraw ₹50,000/- per Qtr from your annual incentive.</li>
                    </ul>
                    <ul className="space-y-2 list-disc pl-4">
                      <li><strong>MINT-AI™ Solutions:</strong> Orders carry a <strong>1.15&times; multiplier</strong> on GM2.</li>
                      <li><strong>Q1 Target:</strong> Minimum 25% of annual GM2 must be achieved by Q1 end.</li>
                      <li><strong>OEM back-end scheme:</strong> 50% calculated in Contribution achievement.</li>
                      <li><strong>Company Team Threshold:</strong> If company total &lt; ₹600 Lacs GM2, payouts reduced by 25%.</li>
                      <li><strong>BD Deductions:</strong> BD beyond 10% of Net Margin treated at 2&times; deduction.</li>
                      {activeReport.customRuleText && <li>{activeReport.customRuleText}</li>}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-[#0d3b5e] text-white px-6 py-3 flex flex-wrap items-center justify-between text-xs text-slate-300">
                <span><strong>MINT Value:</strong> {activeReport.mintValue || 'Strive for Excellence'}</span>
                <span>solutions@mintergraph.com &bull; www.mintergraph.com</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Champs"
        description="Incentive scheme documents for the sales team"
        actions={
          (isAdmin || isHR) ? (
            <button
              onClick={() => { setEditingReport(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Report
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or year…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {fyOptions.length > 0 && (
          <select
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Years</option>
            {fyOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        )}

        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 gap-0.5 text-xs font-semibold">
          {(['ALL', 'DRAFT', 'FINAL', 'LOCKED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                statusFilter === s
                  ? s === 'ALL' ? 'bg-slate-900 dark:bg-slate-600 text-white'
                    : s === 'DRAFT' ? 'bg-amber-500 text-white'
                    : s === 'FINAL' ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s === 'ALL' ? `All (${reports.length})` : `${s.charAt(0) + s.slice(1).toLowerCase()} (${reports.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>

        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading reports…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Trophy className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">No reports found</p>
            {(isAdmin || isHR) && (
              <button
                onClick={() => { setEditingReport(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 mt-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Report
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">#</th>
                  <th className="py-3 px-4 text-left">Employee</th>
                  <th className="py-3 px-4 text-left">Financial Year</th>
                  <th className="py-3 px-4 text-center">GM2 Target</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-left">Created By</th>
                  <th className="py-3 px-4 text-left">Updated</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {filtered.map((r, idx) => {
                  const statusCfg = STATUS_CONFIG[r.status || 'DRAFT'];
                  const isActing = actionLoading[r.id!];
                  const isPdfDl = pdfLoading === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{r.employeeName}</div>
                      </td>
                      <td className="py-3 px-4">{r.financialYear}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-amber-700 dark:text-amber-400">₹{r.gm2TargetCr}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.cls}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{(r as any).createdByName || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {(r as any).updatedAt ? new Date((r as any).updatedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Edit (HR only, non-locked) */}
                          {(isAdmin || isHR) && r.status !== 'LOCKED' && (
                            <button
                              title="Edit"
                              onClick={() => { setEditingReport(r); setIsModalOpen(true); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Finalize (HR, DRAFT only) */}
                          {(isAdmin || isHR) && r.status === 'DRAFT' && (
                            <button
                              title="Mark as Final"
                              disabled={!!isActing}
                              onClick={() => handleFinalize(r.id!)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActing === 'finalize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Lock (Admin only, non-locked) */}
                          {isAdmin && r.status !== 'LOCKED' && (
                            <button
                              title="Lock Report"
                              disabled={!!isActing}
                              onClick={() => handleLock(r.id!)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActing === 'lock' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Print */}
                          <button
                            title="Print Preview"
                            onClick={() => printChampsReport(toChampsData(r))}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Download PDF */}
                          <button
                            title="Download PDF"
                            disabled={isPdfDl}
                            onClick={() => handleDownloadPdf(r)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isPdfDl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          </button>
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

      {/* Modal */}
      {isModalOpen && (
        <SalesChampsReportModal
          report={editingReport}
          employees={employees}
          departments={departments}
          onSave={handleCreate}
          onClose={() => { setIsModalOpen(false); setEditingReport(null); }}
        />
      )}
    </div>
  );
};
