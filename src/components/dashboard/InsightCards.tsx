import React, { useState } from 'react';
import { BellRing, CheckCircle2, ChevronRight, Loader2, MailWarning } from 'lucide-react';
import type {
  DashboardCalibration,
  DashboardCoverage,
  DashboardDataHealthItem,
  DashboardEmailDelivery,
  DashboardReviewerBacklog,
} from '../../types';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';
import { cn } from '../../utils/cn';
import { Card, Navigate } from './DashboardKit';

const timeAgo = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ------------------------------------------------------------------ Review coverage */

export const CoverageCard: React.FC<{ coverage: DashboardCoverage | null; onNavigate: Navigate; className?: string }> = ({
  coverage,
  onNavigate,
  className,
}) => {
  if (!coverage) {
    return (
      <Card title="Review coverage" className={className}>
        <p className="text-xs text-slate-500 dark:text-slate-400">There is no active review period.</p>
      </Card>
    );
  }
  const pct = coverage.inScope ? Math.round((coverage.withReview / coverage.inScope) * 100) : 0;
  return (
    <Card title="Review coverage" subtitle={coverage.periodName} className={className}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{coverage.withReview}</span>
        <span className="text-sm text-slate-400">/ {coverage.inScope} employees have a review</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>

      {coverage.missing === 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> Everyone in scope has a review this quarter.
        </p>
      ) : (
        <>
          <p className="mt-4 mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Why {plural(coverage.missing, 'employee')} have no review</p>
          <ul className="-mx-2">
            {coverage.reasons.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(r.link.view, r.link.params)}
                  title={r.people.join(', ') + (r.count > r.people.length ? ` +${r.count - r.people.length} more` : '')}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                >
                  <span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{r.count}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{r.label}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.hint}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ Reviewers falling behind */

export const ReviewersBehindCard: React.FC<{
  backlog: DashboardReviewerBacklog[];
  onReminded: () => void;
  className?: string;
}> = ({ backlog, onReminded, className }) => {
  const [sending, setSending] = useState<string | null>(null);
  const top = backlog.slice(0, 5);

  const remind = async (r: DashboardReviewerBacklog) => {
    const key = `${r.role}:${r.reviewerId}`;
    setSending(key);
    try {
      const res = await api.sendReviewerReminder(r.reviewerId, r.role);
      const emailNote =
        res.emailStatus === 'SENT' ? 'and emailed' : res.emailStatus === 'FAILED' ? '(email failed — see Email delivery)' : '(in-app only)';
      toast.success(`Reminder sent to ${r.reviewerName} ${emailNote}.`, 'Reminder sent');
      onReminded();
    } catch (err: any) {
      toast.error(err.message || 'Could not send reminder.', 'Reminder');
    } finally {
      setSending(null);
    }
  };

  return (
    <Card title="Reviewers falling behind" subtitle="Reviews waiting on a Manager or HOD this quarter" className={className}>
      {top.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">No reviews are waiting on anyone</p>
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
          {top.map((r) => {
            const key = `${r.role}:${r.reviewerId}`;
            const coolingDown = r.lastRemindedAt && Date.now() - new Date(r.lastRemindedAt).getTime() < 12 * 3_600_000;
            return (
              <li key={key} className="flex items-center gap-3 px-2 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">
                    {r.reviewerName}
                    <span className="ml-1.5 text-[11px] font-semibold text-slate-400">{r.role === 'HOD' ? 'HOD' : 'Manager'}</span>
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate" title={r.employees.join(', ')}>
                    {plural(r.pending, 'review')} · waiting {r.oldestWaitingDays}d
                    {r.overdueDays > 0 && <span className="text-rose-600 dark:text-rose-400"> · {r.overdueDays}d overdue</span>}
                    {r.lastRemindedAt && <span> · reminded {timeAgo(r.lastRemindedAt)}</span>}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={Boolean(sending) || Boolean(coolingDown)}
                  onClick={() => remind(r)}
                  title={coolingDown ? 'A reminder was sent in the last 12 hours' : 'Send an in-app and email reminder'}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />}
                  {coolingDown ? 'Reminded' : 'Remind'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {backlog.length > top.length && <p className="mt-2 text-[11px] text-slate-400">+{backlog.length - top.length} more reviewers with pending reviews</p>}
    </Card>
  );
};

/* ------------------------------------------------------------------ Calibration health */

const BAND_COLOR: Record<string, string> = {
  OUTSTANDING: 'bg-emerald-500',
  EXCEEDS_EXPECTATIONS: 'bg-indigo-500',
  MEETS_EXPECTATIONS: 'bg-sky-500',
  NEEDS_IMPROVEMENT: 'bg-amber-500',
};

export const CalibrationCard: React.FC<{ calibration: DashboardCalibration; onNavigate: Navigate; className?: string }> = ({
  calibration: c,
  onNavigate,
  className,
}) => {
  const disagreePct = c.krasCompared ? Math.round((c.krasDisagreeing / c.krasCompared) * 100) : 0;
  return (
    <Card
      title="Calibration health"
      subtitle={c.scored ? `${plural(c.scored, 'scored review')} this quarter` : 'No scored reviews this quarter yet'}
      action={{ label: 'Bell curve', onClick: () => onNavigate('calibration') }}
      className={className}
    >
      {c.scored > 0 && (
        <ul className="space-y-2.5">
          {c.bands.map((b) => {
            const off = b.percent - b.targetPercent;
            return (
              <li key={b.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold text-slate-900 dark:text-white">{b.percent}%</span>
                    <span className="text-slate-400"> / target {b.targetPercent}%</span>
                    {Math.abs(off) >= 15 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">{off > 0 ? '▲' : '▼'}</span>
                    )}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={cn('h-full rounded-full', BAND_COLOR[b.key])} style={{ width: `${b.percent}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-slate-500/60" style={{ left: `${b.targetPercent}%` }} title={`Target ${b.targetPercent}%`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {c.scored > 0 && c.scored < 10 && <p className="mt-2 text-[11px] text-slate-400">Small sample — treat the spread as indicative.</p>}

      <dl className="mt-auto pt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
          <dt className="text-slate-500 dark:text-slate-400">Manager and HOD 2+ points apart</dt>
          <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white tabular-nums">
            {c.krasCompared ? `${c.krasDisagreeing} of ${c.krasCompared} KRAs (${disagreePct}%)` : '—'}
          </dd>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('reports', { reportType: 'return-analytics' })}
          className="text-left rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <dt className="text-slate-500 dark:text-slate-400">Returns this quarter</dt>
          <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white tabular-nums">
            {c.returnsThisCycle}
            {c.returnsOpen > 0 && <span className="font-normal text-slate-500"> · {c.returnsOpen} open</span>}
            {c.returnsOverdue > 0 && <span className="font-normal text-rose-600 dark:text-rose-400"> · {c.returnsOverdue} overdue</span>}
          </dd>
        </button>
      </dl>
    </Card>
  );
};

/* ------------------------------------------------------------------ Data health (admin) */

export const DataHealthCard: React.FC<{ items: DashboardDataHealthItem[]; onNavigate: Navigate; className?: string }> = ({
  items,
  onNavigate,
  className,
}) => {
  const issues = items.filter((i) => i.count > 0).length;
  return (
    <Card title="Data health" subtitle={issues ? `${plural(issues, 'check')} need fixing` : 'All checks passed'} className={className}>
      <ul className="-mx-2">
        {items.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              disabled={i.count === 0}
              onClick={() => onNavigate(i.link.view, i.link.params)}
              title={i.people.length ? i.people.join(', ') + (i.count > i.people.length ? ` +${i.count - i.people.length} more` : '') : undefined}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
            >
              {i.count === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  !
                </span>
              )}
              <span className={cn('flex-1 text-sm truncate', i.count ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400')}>
                {i.label}
              </span>
              <span className={cn('text-sm font-semibold tabular-nums', i.count ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>{i.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

/* ------------------------------------------------------------------ Email delivery (admin) */

export const EmailDeliveryCard: React.FC<{ email: DashboardEmailDelivery; onNavigate: Navigate; className?: string }> = ({
  email,
  onNavigate,
  className,
}) => {
  const total = email.sent + email.failed + email.skipped + email.queued;
  const stats = [
    { label: 'Sent', value: email.sent, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Failed', value: email.failed, cls: email.failed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white' },
    { label: 'Skipped', value: email.skipped, cls: 'text-slate-900 dark:text-white' },
  ];
  return (
    <Card
      title="Email delivery"
      subtitle={`Notification emails, last ${email.days} days`}
      action={{ label: 'Audit log', onClick: () => onNavigate('audit') }}
      className={className}
    >
      {!email.providerConfigured && (
        <p className="mb-3 text-xs rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
          No email provider is configured — emails are simulated, not delivered.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
            <p className={cn('text-xl font-semibold tabular-nums', s.cls)}>{s.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
      {total === 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No emails were sent in this period.</p>}
      {email.recentFailures.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Latest failures</p>
          <ul className="space-y-2">
            {email.recentFailures.map((f, idx) => (
              <li key={idx} className="flex gap-2 text-xs">
                <MailWarning className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-slate-800 dark:text-slate-100 truncate">
                    {f.recipientName} · <span className="text-slate-500">{timeAgo(f.at)}</span>
                  </span>
                  {f.error && <span className="block text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">{f.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
