import React, { useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { DashboardTask, DashboardTaskLink } from '../../types';
import { api } from '../../services/api';
import { cn } from '../../utils/cn';
import { dueLabel } from './format';

/* Small, shared building blocks for the role dashboards. Kept deliberately plain:
   white cards, one accent colour, numbers first, no decoration that doesn't carry data. */

export type Navigate = (view: DashboardTaskLink['view'], params?: DashboardTaskLink['params']) => void;

/* ------------------------------------------------------------------ Card */

export const Card: React.FC<{
  title?: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, action, className, children }) => (
  <section
    className={cn(
      'bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col min-w-0',
      className
    )}
  >
    {(title || action) && (
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
          >
            {action.label}
          </button>
        )}
      </div>
    )}
    {children}
  </section>
);

/* ------------------------------------------------------------------ Stat tile */

export interface Stat {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  /** 0–100 — renders a thin progress bar under the value. */
  progress?: number;
  onClick?: () => void;
}

const HINT_TONE = {
  default: 'text-slate-500 dark:text-slate-400',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
};

export const StatRow: React.FC<{ stats: Stat[] }> = ({ stats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {stats.map((s) => {
      const Tag = s.onClick ? 'button' : 'div';
      return (
        <Tag
          key={s.label}
          type={s.onClick ? 'button' : undefined}
          onClick={s.onClick}
          className={cn(
            'text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 px-4 py-3.5 min-w-0',
            s.onClick && 'hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer'
          )}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.label}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">{s.value}</span>
            {s.suffix && <span className="text-xs text-slate-400">{s.suffix}</span>}
          </p>
          {s.progress !== undefined && (
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, s.progress))}%` }} />
            </div>
          )}
          {s.hint && <p className={cn('mt-1.5 text-[11px] truncate', HINT_TONE[s.tone || 'default'])}>{s.hint}</p>}
        </Tag>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ Cycle strip */

export const CycleStrip: React.FC<{
  name: string;
  startDate?: string;
  dueDate?: string;
  daysLeft?: number;
  progress?: { label: string; percent: number };
  onOpen?: () => void;
}> = ({ name, dueDate, daysLeft, progress, onOpen }) => {
  const dueText =
    daysLeft === undefined ? '' : daysLeft < 0 ? `${-daysLeft} days overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} days left`;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name}</span>
        {dueDate && <span className="text-xs text-slate-500 dark:text-slate-400">· reviews due {dueDate}</span>}
      </div>
      {progress && (
        <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-md">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
            {Math.round(progress.percent)}% {progress.label}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 ml-auto">
        {dueText && (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              daysLeft !== undefined && daysLeft < 0 ? 'text-rose-600 dark:text-rose-400' : daysLeft !== undefined && daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {dueText}
          </span>
        )}
        {onOpen && (
          <button type="button" onClick={onOpen} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            Open reviews
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ To-do list (tasks + alerts) */

export interface TodoAlert {
  id: string;
  type: 'crit' | 'warn' | 'info';
  title: string;
  detail?: string;
  link?: DashboardTaskLink;
}

/**
 * Something the viewer has to act on. Plain notifications (e.g. "review approved") stay in the
 * bell; notifications that ask for action (acknowledge a letter / PIP, start a self-assessment)
 * are kept.
 */
const isWorkTask = (t: DashboardTask) => !(t.notificationId && (t.type === 'NOTIFICATION' || t.type === 'REVIEW_WORKFLOW'));

type TodoItem = {
  key: string;
  title: string;
  detail?: string;
  level: 'bad' | 'warn' | 'normal' | 'info';
  badge?: string | null;
  onClick?: () => void;
};

const LEVEL_DOT = {
  bad: 'bg-rose-500',
  warn: 'bg-amber-500',
  normal: 'bg-indigo-500',
  info: 'bg-slate-300 dark:bg-slate-600',
};
const LEVEL_BADGE = {
  bad: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
const LEVEL_ORDER = { bad: 0, warn: 1, normal: 2, info: 3 };

export const TodoCard: React.FC<{
  tasks: DashboardTask[];
  alerts?: TodoAlert[];
  onNavigate: Navigate;
  limit?: number;
  className?: string;
  title?: string;
}> = ({ tasks, alerts = [], onNavigate, limit = 6, className, title = 'To do' }) => {
  const [expanded, setExpanded] = useState(false);
  const workTasks = tasks.filter(isWorkTask);
  const unreadNotifications = tasks.length - workTasks.length;

  // Collapse per-person tasks of the same kind (e.g. 12× "Recommend increment · <name>") into one row.
  const byType = new Map<string, DashboardTask[]>();
  workTasks.forEach((t) => byType.set(t.type, [...(byType.get(t.type) || []), t]));
  const grouped: TodoItem[] = [];
  const singles: DashboardTask[] = [];
  byType.forEach((list) => {
    const perPerson = list.filter((t) => t.employeeName && !t.notificationId);
    if (perPerson.length >= 3) {
      const first = perPerson[0];
      const worst = perPerson.some((t) => t.urgency === 'OVERDUE') ? 'bad' : perPerson.some((t) => t.urgency === 'DUE_SOON') ? 'warn' : 'normal';
      grouped.push({
        key: `group_${first.type}`,
        title: `${first.title.split(' · ')[0]} · ${perPerson.length} people`,
        detail: perPerson.map((t) => t.employeeName).join(', '),
        level: worst,
        badge: worst === 'bad' ? 'Overdue' : worst === 'warn' ? 'Due soon' : null,
        onClick: () => onNavigate(first.link.view, first.link.view === 'reviews' ? undefined : first.link.params),
      });
      singles.push(...list.filter((t) => !perPerson.includes(t)));
    } else {
      singles.push(...list);
    }
  });

  const items: TodoItem[] = [
    ...grouped,
    ...singles.map<TodoItem>((t) => ({
      key: t.id,
      title: t.title,
      detail: t.detail,
      // Items raised from a notification have no real due date — "new", never "overdue".
      level: t.notificationId
        ? t.priority === 'High'
          ? 'warn'
          : 'normal'
        : t.urgency === 'OVERDUE'
        ? 'bad'
        : t.urgency === 'DUE_SOON' || t.priority === 'High'
        ? 'warn'
        : 'normal',
      badge: t.notificationId ? 'New' : dueLabel(t.urgency, t.dueDate) || t.dueText || null,
      onClick: () => {
        if (t.notificationId) api.markNotificationRead(t.notificationId).catch(() => {});
        onNavigate(t.link.view, t.link.params);
      },
    })),
    ...alerts.map<TodoItem>((a) => ({
      key: a.id,
      title: a.title,
      detail: a.detail,
      level: a.type === 'crit' ? 'bad' : a.type === 'warn' ? 'warn' : 'info',
      onClick: a.link ? () => onNavigate(a.link!.view, a.link!.params) : undefined,
    })),
  ].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const visible = expanded ? items : items.slice(0, limit);

  return (
    <Card
      title={title}
      subtitle={items.length ? `${items.length} item${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} your attention` : undefined}
      className={className}
    >
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">You're all caught up</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nothing needs your action right now.</p>
        </div>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  disabled={!it.onClick}
                  onClick={it.onClick}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:cursor-default"
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', LEVEL_DOT[it.level])} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{it.title}</span>
                    {it.detail && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{it.detail}</span>}
                  </span>
                  {it.badge && (
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap', LEVEL_BADGE[it.level])}>{it.badge}</span>
                  )}
                  {it.onClick && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
          {items.length > limit && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline self-start cursor-pointer"
            >
              {expanded ? 'Show less' : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
      {unreadNotifications > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('notifications')}
          className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 self-start cursor-pointer"
        >
          + {unreadNotifications} unread notification{unreadNotifications === 1 ? '' : 's'} →
        </button>
      )}
    </Card>
  );
};

/** Count of items TodoCard will list (work tasks + alerts), for summary tiles. */
export const countTodo = (tasks: DashboardTask[], alerts: TodoAlert[] = []) => tasks.filter(isWorkTask).length + alerts.length;

/* ------------------------------------------------------------------ Review pipeline */

export interface PipelineStage {
  label: string;
  count: number;
  color: string; // tailwind bg class
}

/** One segmented bar showing where reviews are sitting right now. */
export const PipelineCard: React.FC<{
  title?: string;
  subtitle?: string;
  stages: PipelineStage[];
  action?: { label: string; onClick: () => void };
  className?: string;
}> = ({ title = 'Where reviews are', subtitle, stages, action, className }) => {
  const total = stages.reduce((s, x) => s + x.count, 0);
  return (
    <Card title={title} subtitle={subtitle} action={action} className={className}>
      {total === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No reviews in this cycle yet.</p>
      ) : (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            {stages.map((s) =>
              s.count > 0 ? <div key={s.label} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} /> : null
            )}
          </div>
          <ul className="mt-4 space-y-2.5">
            {stages.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm">
                <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', s.color)} />
                <span className="flex-1 text-slate-600 dark:text-slate-300">{s.label}</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{s.count}</span>
                <span className="w-10 text-right text-xs text-slate-400 tabular-nums">{Math.round((s.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ Rating distribution */

export const RATING_ROWS = [
  { key: 'outstanding', label: 'Outstanding', color: 'bg-emerald-500' },
  { key: 'exceeds', label: 'Exceeds', color: 'bg-indigo-500' },
  { key: 'meets', label: 'Meets', color: 'bg-sky-500' },
  { key: 'needsImprovement', label: 'Needs improvement', color: 'bg-amber-500' },
] as const;

export const RatingCard: React.FC<{
  title?: string;
  subtitle?: string;
  rows: { label: string; count: number; color: string }[];
  footnote?: string;
  className?: string;
}> = ({ title = 'Ratings', subtitle, rows, footnote, className }) => {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card title={title} subtitle={subtitle} className={className}>
      {total === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No scored reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-300">{r.label}</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={cn('h-full rounded-full', r.color)} style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-auto pt-3 text-[11px] text-slate-400">{footnote}</p>}
    </Card>
  );
};

/* ------------------------------------------------------------------ Progress list (departments etc.) */

export const ProgressListCard: React.FC<{
  title: string;
  subtitle?: string;
  rows: { key: string; label: string; detail?: string; percent: number }[];
  action?: { label: string; onClick: () => void };
  limit?: number;
  className?: string;
}> = ({ title, subtitle, rows, action, limit = 6, className }) => {
  const sorted = [...rows].sort((a, b) => a.percent - b.percent);
  return (
    <Card title={title} subtitle={subtitle} action={action} className={className}>
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Nothing to show yet.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.slice(0, limit).map((r) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{r.label}</span>
                  {r.detail && <span className="text-[11px] text-slate-400 whitespace-nowrap">{r.detail}</span>}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', r.percent >= 100 ? 'bg-emerald-500' : r.percent >= 50 ? 'bg-indigo-500' : 'bg-amber-500')}
                    style={{ width: `${Math.max(2, Math.min(100, r.percent))}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300 w-10 text-right">{Math.round(r.percent)}%</span>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > limit && <p className="mt-3 text-[11px] text-slate-400">Showing the {limit} furthest behind.</p>}
    </Card>
  );
};

/* ------------------------------------------------------------------ People list */

export const STAGE_PILL: Record<string, { label: string; cls: string }> = {
  SELF: { label: 'Self-assessment', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  MANAGER: { label: 'With manager', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  HOD: { label: 'With HOD', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  HR: { label: 'With HR', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  CLOSED: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  NONE: { label: 'Not started', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

export interface PersonRow {
  id: string;
  name: string;
  subtitle?: string;
  stage: keyof typeof STAGE_PILL;
  score?: number;
  flag?: string;
  pipId?: string;
  onPipClick?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const PeopleCard: React.FC<{
  title: string;
  subtitle?: string;
  people: PersonRow[];
  action?: { label: string; onClick: () => void };
  limit?: number;
  className?: string;
}> = ({ title, subtitle, people, action, limit = 8, className }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? people : people.slice(0, limit);
  return (
    <Card title={title} subtitle={subtitle} action={action} className={className}>
      {people.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No one to show.</p>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((p) => {
              const pill = STAGE_PILL[p.stage] || STAGE_PILL.NONE;
              const isPip = p.flag === 'PIP';
              return (
                <li key={p.id}>
                  <div
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors',
                      isPip
                        ? 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <button
                      type="button"
                      disabled={!p.onClick}
                      onClick={p.onClick}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          'w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center shrink-0',
                          isPip
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        )}
                      >
                        {initials(p.name)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100 truncate font-medium">
                          <span className="truncate">{p.name}</span>
                          {isPip && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0">
                              On PIP
                            </span>
                          )}
                          {!isPip && p.flag && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 shrink-0">
                              {p.flag}
                            </span>
                          )}
                        </span>
                        {p.subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{p.subtitle}</span>}
                      </span>
                    </button>
                    {isPip && p.onPipClick && (
                      <button
                        type="button"
                        onClick={p.onPipClick}
                        className="px-2 py-1 text-[11px] font-medium rounded border border-amber-300 dark:border-amber-700 bg-white/90 dark:bg-slate-900/90 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shrink-0 cursor-pointer"
                        title="View Performance Improvement Plan"
                      >
                        Plan
                      </button>
                    )}
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap shrink-0', pill.cls)}>{pill.label}</span>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white shrink-0">
                      {p.score ? p.score.toFixed(1) : <span className="text-slate-300 dark:text-slate-600">–</span>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {people.length > limit && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline self-start cursor-pointer"
            >
              {expanded ? 'Show less' : `Show all ${people.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ Key dates */

export const DatesCard: React.FC<{
  title?: string;
  events: { id: string; title: string; detail?: string; month: string; day: string; when: string }[];
  className?: string;
}> = ({ title = 'Key dates', events, className }) => (
  <Card title={title} className={className}>
    {events.length === 0 ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">No upcoming dates.</p>
    ) : (
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex flex-col items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 leading-none">{e.month}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{e.day}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{e.title}</span>
              {e.detail && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{e.detail}</span>}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.when}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
