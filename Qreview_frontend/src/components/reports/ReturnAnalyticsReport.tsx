import React, { useEffect, useState } from 'react';
import { RotateCcw, Clock, AlertTriangle, Settings2, Loader2, Save } from 'lucide-react';
import { api } from '../../services/api';
import { ReturnPolicy } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';

interface ReturnAnalyticsReportProps {
  data: any;
}

const formatHours = (h: number | null | undefined) => {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
};

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: 'default' | 'warn' | 'bad' }> = ({ label, value, sub, tone = 'default' }) => (
  <div
    className={`p-3 rounded-xl border bg-white dark:bg-slate-900 ${
      tone === 'bad'
        ? 'border-rose-200 dark:border-rose-900'
        : tone === 'warn'
        ? 'border-amber-200 dark:border-amber-900'
        : 'border-slate-200 dark:border-slate-800'
    }`}
  >
    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
    <div
      className={`text-lg font-bold tabular-nums mt-0.5 ${
        tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
      }`}
    >
      {value}
    </div>
    {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>}
  </div>
);

/** Return-limit / SLA settings — editable by HR and Super Admin. */
const ReturnPolicyCard: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);
  const [draft, setDraft] = useState<ReturnPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getReturnPolicy()
      .then((p) => {
        setPolicy(p);
        setDraft(p);
      })
      .catch(() => undefined);
  }, []);

  if (!policy || !draft) return null;
  const dirty =
    draft.maxReturnsPerReview !== policy.maxReturnsPerReview ||
    draft.returnLimitAction !== policy.returnLimitAction ||
    draft.returnSlaDays !== policy.returnSlaDays;

  const save = async () => {
    setSaving(true);
    try {
      const next = await api.updateReturnPolicy({
        maxReturnsPerReview: draft.maxReturnsPerReview,
        returnLimitAction: draft.returnLimitAction,
        returnSlaDays: draft.returnSlaDays,
      });
      setPolicy(next);
      setDraft(next);
      toast.success('Return policy updated.', 'Saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update return policy.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs tabular-nums disabled:opacity-70';

  return (
    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
        <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Return policy
      </span>
      <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        Max returns per review
        <input
          type="number"
          min={1}
          max={20}
          disabled={!canEdit}
          value={draft.maxReturnsPerReview}
          onChange={(e) => setDraft({ ...draft, maxReturnsPerReview: Number(e.target.value) })}
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        When exceeded
        <select
          disabled={!canEdit}
          value={draft.returnLimitAction}
          onChange={(e) => setDraft({ ...draft, returnLimitAction: e.target.value as ReturnPolicy['returnLimitAction'] })}
          className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs disabled:opacity-70"
        >
          <option value="ESCALATE">Allow &amp; alert HR</option>
          <option value="BLOCK">Block HOD (HR can still return)</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        Response SLA (days)
        <input
          type="number"
          min={1}
          max={60}
          disabled={!canEdit}
          value={draft.returnSlaDays}
          onChange={(e) => setDraft({ ...draft, returnSlaDays: Number(e.target.value) })}
          className={inputCls}
        />
      </label>
      {canEdit && dirty && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </button>
      )}
    </div>
  );
};

export const ReturnAnalyticsReport: React.FC<ReturnAnalyticsReportProps> = ({ data }) => {
  const summary = data?.summary || {};
  const byRecipient: any[] = data?.reportData || [];
  const byKra: any[] = data?.byKra || [];
  const byReason: any[] = data?.byReason || [];
  const maxReason = Math.max(1, ...byReason.map((r) => r.count));

  return (
    <div className="space-y-4">
      <ReturnPolicyCard />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Tile label="Returns" value={summary.totalReturns ?? 0} sub={`HOD ${summary.byInitiator?.HOD ?? 0} · HR ${summary.byInitiator?.HR ?? 0}`} />
        <Tile label="Reviews returned" value={`${summary.returnRatePercent ?? 0}%`} sub={`${summary.reviewsReturned ?? 0} of ${summary.totalReviews ?? 0}`} />
        <Tile label="Partial vs full" value={`${summary.partialReturns ?? 0} / ${summary.fullReturns ?? 0}`} sub={`${summary.avgKrasPerReturn ?? 0} KRAs per return`} />
        <Tile label="Avg resolution" value={formatHours(summary.avgResolutionHours)} />
        <Tile label="Open" value={summary.open ?? 0} tone={summary.open ? 'warn' : 'default'} />
        <Tile label="Overdue" value={summary.overdue ?? 0} tone={summary.overdue ? 'bad' : 'default'} />
      </div>

      {/* Recipients */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Who receives returns most often
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Returns</th>
                <th className="px-4 py-3">Reviews returned</th>
                <th className="px-4 py-3">Avg KRAs / return</th>
                <th className="px-4 py-3">Avg resolution</th>
                <th className="px-4 py-3">Open / overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {byRecipient.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">No KRA-level returns recorded yet.</td>
                </tr>
              )}
              {byRecipient.map((r) => (
                <tr key={`${r.role}_${r.recipientId}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{r.recipientName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.role === 'HOD' ? 'HOD' : 'Manager'}</td>
                  <td className="px-4 py-3 tabular-nums font-bold text-slate-900 dark:text-white">{r.returnsReceived}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {r.reviewsReturned} / {r.reviewsHandled}{' '}
                    <span className={r.returnRatePercent >= 30 ? 'text-rose-600 font-bold' : 'text-slate-400'}>({r.returnRatePercent}%)</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{r.avgKrasPerReturn}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{formatHours(r.avgResolutionHours)}</td>
                  <td className="px-4 py-3">
                    <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.open}</span>
                    {r.overdue > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600">
                        <Clock className="w-3 h-3" /> {r.overdue} overdue
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KRAs */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Most-returned KRAs
            <span className="font-normal text-slate-400">— high rates often point to an unclear KRA definition or target</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">KRA</th>
                  <th className="px-4 py-3">Times returned</th>
                  <th className="px-4 py-3">Return rate</th>
                  <th className="px-4 py-3">Rating changed after return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {byKra.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No KRAs returned yet.</td>
                  </tr>
                )}
                {byKra.map((k) => (
                  <tr key={k.kraName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{k.kraName}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{k.timesReturned}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {k.returnRatePercent}% <span className="text-slate-400">of {k.reviewsWithKra} reviews</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{k.ratingChangedPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reasons */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Return reasons</div>
          {byReason.length === 0 && <div className="text-xs text-slate-400">No reasons recorded yet.</div>}
          {byReason.map((r) => (
            <div key={r.code} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">{r.label}</span>
                <span className="tabular-nums font-bold text-slate-900 dark:text-white">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${(r.count / maxReason) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
