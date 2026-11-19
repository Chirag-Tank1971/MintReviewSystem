import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Plus, Pencil, Lock, CheckCircle2, Trash2, Download, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Employee, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/StatusBadge';
import { EmptyState } from './ui/EmptyState';
import { SELECT_CLASS } from './ui/formStyles';
import { AchievementReportModal } from './AchievementReportModal';
import {
  AchievementReport, sheetTotals, sheetTitle, percentAchievement, formatAmount, formatPercent, downloadAchievementXlsx,
} from '../utils/achievementSheet';
import { cn } from '../utils/cn';

interface Props {
  employees: Employee[];
  departments?: Department[];
}

const STATUS_TONE = {
  DRAFT: { label: 'Draft', tone: 'warning' },
  FINAL: { label: 'Final', tone: 'info' },
  LOCKED: { label: 'Locked', tone: 'success' },
} as const;

type PendingConfirm = { kind: 'lock' | 'delete'; report: AchievementReport } | null;

const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide leading-snug text-slate-500 dark:text-slate-400';
const TD_NUM = 'px-4 py-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200';

/** Percentage as a number with a small bar, so the row reads at a glance. The bar is capped at 100%. */
const PercentCell: React.FC<{ fraction: number | null }> = ({ fraction }) => {
  if (fraction === null) return <span className="text-slate-400 dark:text-slate-500" aria-label="Not set">—</span>;
  const width = Math.max(0, Math.min(100, fraction * 100));
  const tone = fraction >= 1 ? 'bg-emerald-500' : fraction >= 0.75 ? 'bg-indigo-500' : 'bg-amber-500';
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="hidden xl:block w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${width}%` }} />
      </div>
      <span className="w-16 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{formatPercent(fraction)}</span>
    </div>
  );
};

/** The achievement sheet: same columns as the Excel template, laid out as a clean card. */
const AchievementSheet: React.FC<{ report: AchievementReport; showTotals: boolean }> = ({ report, showTotals }) => {
  const totals = sheetTotals(report.rows);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">{sheetTitle(report.financialYear)}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {report.rows.length} {report.rows.length === 1 ? 'BDM' : 'BDMs'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{sheetTitle(report.financialYear)}</caption>
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className={`${TH} text-left`}>BDM</th>
              <th scope="col" className={`${TH} text-right`}>Target Achieved</th>
              <th scope="col" className={`${TH} text-right`}>Actual Target</th>
              <th scope="col" className={`${TH} text-right`}>Turnover</th>
              <th scope="col" className={`${TH} text-right`}>Percentage Achievement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {report.rows.map((r) => (
              <tr key={r.employeeId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <th scope="row" className="px-4 py-3.5 text-left font-medium text-slate-900 dark:text-white">{r.employeeName}</th>
                <td className={TD_NUM}>{formatAmount(r.targetAchieved)}</td>
                <td className={TD_NUM}>{formatAmount(r.actualTarget)}</td>
                <td className={TD_NUM}>{formatAmount(r.turnover)}</td>
                <td className="px-4 py-3.5"><PercentCell fraction={percentAchievement(r)} /></td>
              </tr>
            ))}
          </tbody>
          {showTotals && (
            <tfoot>
              <tr className="bg-amber-50 dark:bg-amber-950/20 border-t-2 border-amber-200 dark:border-amber-900/50 font-semibold">
                <th scope="row" className="px-4 py-3.5 text-left text-slate-900 dark:text-white">Total Amount</th>
                <td className={`${TD_NUM} text-slate-900 dark:text-white`}>{formatAmount(totals.targetAchieved)}</td>
                <td className={`${TD_NUM} text-slate-900 dark:text-white`}>{formatAmount(totals.actualTarget)}</td>
                <td className={`${TD_NUM} text-slate-900 dark:text-white`}>{formatAmount(totals.turnover)}</td>
                <td className="px-4 py-3.5"><PercentCell fraction={totals.percent} /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export const AchievementView: React.FC<Props> = ({ employees, departments }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const manages = isAdmin || user?.role === 'HR';

  const [reports, setReports] = useState<AchievementReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const load = useCallback(async (keepId?: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data: AchievementReport[] = (manages ? await api.getAchievementReports() : await api.getMyAchievementReports()) || [];
      setReports(data);
      setSelectedId((cur) => {
        const want = keepId || cur;
        return data.some((r) => r.id === want) ? want : data[0]?.id || '';
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load achievement reports.');
    } finally {
      setIsLoading(false);
    }
  }, [manages]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => reports.find((r) => r.id === selectedId), [reports, selectedId]);
  const status = selected ? STATUS_TONE[selected.status || 'DRAFT'] : null;
  const isLocked = selected?.status === 'LOCKED';

  const handleSave = async (data: { financialYear: string; rows: AchievementReport['rows'] }) => {
    try {
      if (editing?.id) {
        const wasFinal = editing.status === 'FINAL';
        await api.updateAchievementReport(editing.id, data);
        toast.success(wasFinal ? 'Report updated and moved back to Draft for review.' : 'Report updated.');
        await load(editing.id);
      } else {
        const created = await api.createAchievementReport(data);
        toast.success('Report created as a draft.');
        await load(created.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save report.');
      throw err;
    }
  };

  const run = async (kind: string, fn: () => Promise<unknown>, success: string, keepId?: string) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(success);
      await load(keepId);
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${kind} report.`);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmed = async () => {
    if (!pendingConfirm?.report.id) return;
    const { kind, report } = pendingConfirm;
    const id = report.id!;
    setPendingConfirm(null);
    if (kind === 'lock') {
      await run('lock', () => api.lockAchievementReport(id), 'Report locked. The BDMs on it have been notified.', id);
    } else {
      await run('delete', () => api.deleteAchievementReport(id), 'Report deleted.');
    }
  };

  const openCreate = () => { setEditing(null); setIsModalOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title={manages ? 'Sales Achievement' : 'My Sales Achievement'}
        description={
          manages
            ? 'Yearly target vs. achievement sheet for the BDMs. Draft → Final (HR) → Locked (Super Admin), then each BDM can see their own row.'
            : 'Your figures from the finalized yearly achievement sheet.'
        }
        actions={
          <>
            {reports.length > 0 && (
              <select aria-label="Financial year" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={SELECT_CLASS}>
                {reports.map((r) => <option key={r.id} value={r.id}>{r.financialYear}</option>)}
              </select>
            )}
            <Button icon={RefreshCw} iconSpin={isLoading} onClick={() => load()} aria-label="Refresh" />
            {manages && <Button variant="primary" icon={Plus} onClick={openCreate}>New report</Button>}
          </>
        }
      />

      {loadError && (
        <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300">
          {loadError}
        </div>
      )}

      {isLoading && !selected ? (
        <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !selected ? (
        <EmptyState
          icon={TrendingUp}
          title={manages ? 'No achievement reports yet' : 'No achievement report yet'}
          description={
            manages
              ? 'Create the report for a financial year, add the BDMs with their target, achievement and turnover, then finalize and lock it.'
              : 'Your figures will appear here once the yearly report has been finalized and locked.'
          }
          action={manages ? { label: 'New report', onClick: openCreate, icon: Plus } : undefined}
        />
      ) : (
        <section aria-label={sheetTitle(selected.financialYear)} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {status && <StatusBadge status={status.label} tone={status.tone} size="sm" />}
              {manages && selected.updatedAt && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Updated {new Date(selected.updatedAt).toLocaleDateString('en-IN')}{selected.createdByName ? ` · created by ${selected.createdByName}` : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={busy === 'download' ? Loader2 : Download} iconSpin={busy === 'download'} disabled={!!busy}
                onClick={() => run('download', () => downloadAchievementXlsx(selected, manages), 'Excel file downloaded.', selected.id)}>
                Download Excel
              </Button>
              {manages && !isLocked && (
                <Button icon={Pencil} disabled={!!busy} title={selected.status === 'FINAL' ? 'Edit (moves the report back to Draft)' : 'Edit'}
                  onClick={() => { setEditing(selected); setIsModalOpen(true); }}>
                  Edit
                </Button>
              )}
              {manages && selected.status === 'DRAFT' && (
                <Button icon={busy === 'finalize' ? Loader2 : CheckCircle2} iconSpin={busy === 'finalize'} disabled={!!busy}
                  onClick={() => run('finalize', () => api.finalizeAchievementReport(selected.id!), 'Report marked as Final.', selected.id)}>
                  Finalize
                </Button>
              )}
              {isAdmin && selected.status === 'FINAL' && (
                <Button variant="primary" icon={Lock} disabled={!!busy} onClick={() => setPendingConfirm({ kind: 'lock', report: selected })}>
                  Lock
                </Button>
              )}
              {isAdmin && !isLocked && (
                <Button icon={Trash2} aria-label="Delete report" disabled={!!busy} onClick={() => setPendingConfirm({ kind: 'delete', report: selected })} />
              )}
            </div>
          </div>

          <AchievementSheet report={selected} showTotals={manages} />
        </section>
      )}

      {isModalOpen && (
        <AchievementReportModal
          report={editing}
          employees={employees}
          departments={departments}
          takenYears={reports.map((r) => r.financialYear)}
          onSave={handleSave}
          onClose={() => { setIsModalOpen(false); setEditing(null); }}
        />
      )}

      {pendingConfirm && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-900/60 p-4 modal-backdrop-enter">
          <div role="alertdialog" aria-modal="true" aria-labelledby="ach-confirm-title"
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 modal-card-enter">
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn('w-5 h-5 shrink-0 mt-0.5', pendingConfirm.kind === 'delete' ? 'text-rose-600' : 'text-amber-600')} aria-hidden="true" />
              <div>
                <h3 id="ach-confirm-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                  {pendingConfirm.kind === 'lock' ? `Lock the ${pendingConfirm.report.financialYear} report?` : `Delete the ${pendingConfirm.report.financialYear} report?`}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {pendingConfirm.kind === 'lock'
                    ? 'Each BDM on it will be notified and can see their own row. A locked report can never be edited or deleted.'
                    : 'This removes the report permanently. It cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setPendingConfirm(null)} autoFocus>Cancel</Button>
              <Button variant="primary" icon={pendingConfirm.kind === 'lock' ? Lock : Trash2}
                className={pendingConfirm.kind === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : undefined}
                onClick={handleConfirmed}>
                {pendingConfirm.kind === 'lock' ? 'Lock report' : 'Delete report'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
