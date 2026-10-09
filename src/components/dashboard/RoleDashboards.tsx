import React from 'react';
import { AlertTriangle, ArrowRight, Award, Calendar, ClipboardList, Clock, FileText, Target } from 'lucide-react';
import type {
  DashboardAdminOverview,
  DashboardHodOverview,
  DashboardHrOverview,
  DashboardMyReview,
  DashboardSummary,
  DashboardTeam,
  PerformanceImprovementPlan,
} from '../../types';
import { cn } from '../../utils/cn';
import {
  Card,
  DatesCard,
  Navigate,
  PeopleCard,
  PersonRow,
  PipelineCard,
  PipelineStage,
  ProgressListCard,
  RATING_ROWS,
  RatingCard,
  StatRow,
  TodoCard,
  countTodo,
} from './DashboardKit';
import { RATING_BAND_LABELS, daysUntil, formatMonthYear, formatShortDate } from './format';
import { CalibrationCard, CoverageCard, DataHealthCard, EmailDeliveryCard, ReviewersBehindCard } from './InsightCards';

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const score = (n?: number | null) => (n && n > 0 ? n.toFixed(2) : '–');

/** Same four stage colours everywhere so "with HOD" always looks the same. */
const stageColors = {
  self: 'bg-slate-300 dark:bg-slate-600',
  manager: 'bg-amber-400',
  hod: 'bg-violet-500',
  hr: 'bg-sky-500',
  done: 'bg-emerald-500',
};

function hrDates(hr: DashboardHrOverview | null | undefined) {
  return (hr?.upcomingEvents || []).map((e) => ({
    id: e.id,
    title: e.title,
    detail: e.category,
    month: e.dateMonth,
    day: e.dateDay,
    when: e.daysText,
  }));
}

/* =========================================================================
   Employee — "My review"
   ========================================================================= */

const STEPS = ['Self-assessment', 'Manager', 'HOD', 'HR', 'Done'];

const MyReviewCard: React.FC<{ me: DashboardMyReview; data: DashboardSummary; onNavigate: Navigate; className?: string }> = ({
  me,
  data,
  onNavigate,
  className,
}) => {
  const r = me.currentReview;
  const step = !r
    ? -1
    : r.stage === 'CLOSED'
    ? 4
    : r.stage === 'HR'
    ? 3
    : r.stage === 'HOD'
    ? 2
    : r.isSelfSubmitted
    ? 1
    : 0;
  const selfTask = data.tasks.find((t) => t.type === 'SELF_ASSESSMENT');
  const statusLine = !r
    ? 'No review has been opened for you this quarter yet.'
    : step === 0
    ? 'Your self-assessment is waiting for you.'
    : step === 4
    ? `Completed${r.finalScore ? ` · final score ${r.finalScore.toFixed(2)} / 5` : ''}`
    : `With your ${STEPS[step].toLowerCase()} — nothing needed from you right now.`;

  return (
    <Card title={r ? `My ${r.periodName} review` : 'My review'} className={className}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{statusLine}</p>

      {r && (
        <ol className="mt-5 grid grid-cols-5 gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label} className="min-w-0">
              <div
                className={cn(
                  'h-1.5 rounded-full',
                  i < step || step === 4 ? 'bg-emerald-500' : i === step ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-800'
                )}
              />
              <p
                className={cn(
                  'mt-1.5 text-[11px] truncate',
                  i === step ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'
                )}
              >
                {label}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto pt-5 flex flex-wrap gap-2">
        {step === 0 && selfTask ? (
          <button
            type="button"
            onClick={() => onNavigate(selfTask.link.view, selfTask.link.params)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          >
            Start self-assessment <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('reviews')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            View my reviews <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </Card>
  );
};

/** Tiny inline sparkline for the score history. */
const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return null;
  const w = 160;
  const h = 40;
  const min = Math.min(...values, 1);
  const max = Math.max(...values, 5);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * h] as const);
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className="w-full h-10 overflow-visible" aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-indigo-500" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" className="fill-indigo-500" />
    </svg>
  );
};

const MyScoreCard: React.FC<{ me: DashboardMyReview; className?: string }> = ({ me, className }) => {
  const history = me.scoreHistory.slice(-6);
  const last = history[history.length - 1]?.score;
  const prev = history[history.length - 2]?.score;
  const delta = last !== undefined && prev !== undefined ? last - prev : null;
  return (
    <Card title="My performance" subtitle={me.evaluatedQuarters ? `Average of last ${me.evaluatedQuarters} evaluated quarter${me.evaluatedQuarters === 1 ? '' : 's'}` : undefined} className={className}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">{score(me.rollingScore)}</span>
        {me.rollingScore > 0 && <span className="text-sm text-slate-400">/ 5</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        {me.ratingBand && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {RATING_BAND_LABELS[me.ratingBand] || me.ratingBand}
          </span>
        )}
        {delta !== null && delta !== 0 && (
          <span className={cn('text-xs font-medium', delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)} vs last quarter
          </span>
        )}
        {!me.rollingScore && <span className="text-xs text-slate-500 dark:text-slate-400">Shown after your first evaluated quarter.</span>}
      </div>
      {history.length >= 2 && (
        <div className="mt-auto pt-4">
          <Sparkline values={history.map((h) => h.score)} />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{history[0].periodName}</span>
            <span>{history[history.length - 1].periodName}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

const APPRAISAL_STATUS: Record<string, string> = {
  HR_APPROVED: 'Approved by HR',
  HOD_CALIBRATED: 'Calibrated by HOD',
  MANAGER_RECOMMENDED: 'Recommended by manager',
};

const MyAppraisalCard: React.FC<{ me: DashboardMyReview; onOpenLetter: () => void; className?: string }> = ({ me, onOpenLetter, className }) => {
  const a = me.activeAppraisal;
  return (
    <Card title="Annual appraisal" className={className}>
      {me.activePip ? (
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Annual appraisal</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">
              Paused while your improvement plan is active.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Annual appraisal processing resumes once your improvement plan concludes.
            </p>
          </div>
        </div>
      ) : a ? (
        <>
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">FY {a.appraisalYear}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {a.isLocked ? 'Released' : APPRAISAL_STATUS[a.status] || 'In progress'}
              </p>
            </div>
          </div>
          {a.isLocked && a.hrApprovedIncrement !== undefined && (
            <p className="mt-4 text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{a.hrApprovedIncrement}%</p>
          )}
          {a.isLocked && (
            <button
              type="button"
              onClick={onOpenLetter}
              className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline self-start cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> {a.acknowledged ? 'View letter' : 'View & acknowledge letter'}
            </button>
          )}
        </>
      ) : me.nextAppraisal ? (
        <>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">{formatMonthYear(me.nextAppraisal.month, me.nextAppraisal.year)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Your next appraisal{me.nextAppraisal.cycleName ? ` · ${me.nextAppraisal.cycleName}` : ''}</p>
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No appraisal cycle assigned yet.</p>
      )}
    </Card>
  );
};

const MyKrasCard: React.FC<{ me: DashboardMyReview; onNavigate: Navigate; className?: string }> = ({ me, onNavigate, className }) => (
  <Card
    title="My KRAs"
    subtitle={me.kras.length ? `${me.kras.length} goals · weights add up to ${me.kras.reduce((s, k) => s + (k.weight || 0), 0)}%` : undefined}
    action={{ label: 'Details', onClick: () => onNavigate('reviews') }}
    className={className}
  >
    {me.kras.length === 0 ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">No KRAs assigned yet.</p>
    ) : (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {me.kras.map((k) => (
          <li key={k.title} className="flex items-center gap-3 min-w-0">
            <Target className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 truncate" title={k.title}>
              {k.title}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">{k.weight}%</span>
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
              {k.lastRating ? `${k.lastRating}` : '–'}
            </span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

function getLatestGoalRating(plan: PerformanceImprovementPlan, goalId: string): { label: string; tone: string } {
  if (plan.checkIns && plan.checkIns.length > 0) {
    for (let i = plan.checkIns.length - 1; i >= 0; i--) {
      const ratingEntry = plan.checkIns[i].goalRatings?.find((r) => r.goalId === goalId);
      if (ratingEntry) {
        switch (ratingEntry.rating) {
          case 5:
            return { label: 'Met', tone: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
          case 4:
            return { label: 'Ahead', tone: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
          case 3:
            return { label: 'On track', tone: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
          case 2:
            return { label: 'Behind', tone: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
          case 1:
            return { label: 'Not started', tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
        }
      }
    }
  }
  const goal = plan.goals.find((g) => g.id === goalId);
  if (goal?.status === 'MET') {
    return { label: 'Met', tone: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
  }
  return { label: 'Pending', tone: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
}

const ImprovementPlanCard: React.FC<{ plan: PerformanceImprovementPlan; onNavigate: Navigate; className?: string }> = ({
  plan,
  onNavigate,
  className,
}) => {
  const isAcknowledged = Boolean(plan.employeeAcknowledgement?.acknowledged);
  const remainingDays = daysUntil(plan.endDate);
  const daysLeftText =
    remainingDays > 1 ? `${remainingDays} days left` : remainingDays === 1 ? '1 day left' : remainingDays === 0 ? 'Due today' : `Overdue ${-remainingDays}d`;

  const startMs = new Date(plan.startDate).getTime();
  const endMs = new Date(plan.endDate).getTime();
  const elapsed = Date.now() - startMs;
  const totalDuration = endMs - startMs;
  const progressPct = totalDuration > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100))) : 0;

  const lastCheckIn = plan.checkIns && plan.checkIns.length > 0 ? plan.checkIns[plan.checkIns.length - 1] : null;
  const baseDateStr = lastCheckIn?.date || plan.startDate;
  const nextCheckInDate = new Date(baseDateStr);
  nextCheckInDate.setDate(nextCheckInDate.getDate() + 7);
  const nextCheckInLabel = formatShortDate(nextCheckInDate.toISOString());

  return (
    <section
      className={cn(
        'rounded-xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 p-5 flex flex-col min-w-0 shadow-xs',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Improvement plan</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {plan.status === 'EXTENDED' ? 'Extended' : 'Active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Performance milestones and structured check-ins
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('pip', { pipId: plan.id })}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-auto',
            isAcknowledged
              ? 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-slate-700 border border-amber-300 dark:border-amber-700 shadow-xs'
              : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
          )}
        >
          {isAcknowledged ? 'View plan' : 'Acknowledge'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress & Timeline Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-3.5 border border-amber-200/50 dark:border-amber-800/40">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-2">
          <span className="font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            {formatShortDate(plan.startDate)} – {formatShortDate(plan.endDate)}
          </span>
          <span className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
            {daysLeftText}
          </span>
        </div>
        <div
          className="h-2 w-full bg-amber-100 dark:bg-amber-950/60 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Plan timeline progress"
        >
          <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2.5">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Next check-in: <strong className="font-semibold text-slate-800 dark:text-slate-200">{nextCheckInLabel}</strong>
          </span>
          {plan.checkIns.length > 0 && (
            <span className="tabular-nums">
              {plan.checkIns.length} check-in{plan.checkIns.length !== 1 ? 's' : ''} logged
            </span>
          )}
        </div>
      </div>

      {/* Goals list with targets and latest check-in rating */}
      {plan.goals && plan.goals.length > 0 && (
        <div className="mt-3.5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Goals & latest check-in ratings ({plan.goals.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {plan.goals.map((goal) => {
              const rating = getLatestGoalRating(plan, goal.id);
              return (
                <div
                  key={goal.id}
                  className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/40 flex flex-col justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2" title={goal.description}>
                        {goal.description}
                      </p>
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 border tabular-nums', rating.tone)}>
                        {rating.label}
                      </span>
                    </div>
                    {goal.targetMetric && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Target:</span> {goal.targetMetric}
                      </p>
                    )}
                  </div>
                  {goal.dueDate && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      Due {formatShortDate(goal.dueDate)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export const EmployeeDashboard: React.FC<{ data: DashboardSummary; me: DashboardMyReview; onNavigate: Navigate; onOpenLetter: () => void }> = ({
  data,
  me,
  onNavigate,
  onOpenLetter,
}) => (
  <div className="space-y-4">
    {me.activePip && (me.activePip.status === 'ACTIVE' || me.activePip.status === 'EXTENDED') && (
      <ImprovementPlanCard plan={me.activePip} onNavigate={onNavigate} />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <MyReviewCard me={me} data={data} onNavigate={onNavigate} className="lg:col-span-2" />
      <MyScoreCard me={me} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <TodoCard tasks={data.tasks} onNavigate={onNavigate} className="lg:col-span-2" />
      <MyAppraisalCard me={me} onOpenLetter={onOpenLetter} />
    </div>
    <MyKrasCard me={me} onNavigate={onNavigate} />
  </div>
);

/* =========================================================================
   Team / Department PIP Highlight Card
   ========================================================================= */

export const TeamPipHighlightCard: React.FC<{
  pips: PerformanceImprovementPlan[];
  roleTitle: 'Team' | 'Department';
  onNavigate: Navigate;
  className?: string;
}> = ({ pips, roleTitle, onNavigate, className }) => {
  if (!pips || pips.length === 0) return null;

  const linkClass = 'text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer';

  return (
    <section
      aria-label={`${roleTitle} Performance Improvement Plans`}
      className={cn('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl', className)}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">On improvement plan</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{pips.length}</span>
        <button type="button" onClick={() => onNavigate('pip')} className={cn(linkClass, 'ml-auto inline-flex items-center gap-1')}>
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {pips.map((plan) => {
          const remainingDays = daysUntil(plan.endDate);
          const daysText =
            remainingDays > 1
              ? `${remainingDays} days left`
              : remainingDays === 1
              ? '1 day left'
              : remainingDays === 0
              ? 'Ends today'
              : `Overdue by ${-remainingDays}d`;
          const startMs = new Date(plan.startDate).getTime();
          const endMs = new Date(plan.endDate).getTime();
          const elapsed = Date.now() - startMs;
          const totalDuration = endMs - startMs;
          const progressPct = totalDuration > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100))) : 0;
          const checkInCount = plan.checkIns?.length || 0;
          const goalCount = plan.goals?.length || 0;
          const subtitle = [plan.designationName, roleTitle === 'Department' && plan.managerName ? `Mgr: ${plan.managerName}` : undefined]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
              <div className="min-w-0 flex-1 basis-40">
                <span className="font-medium text-slate-900 dark:text-white">{plan.employeeName}</span>
                {subtitle && <span className="text-slate-500 dark:text-slate-400"> · {subtitle}</span>}
                {plan.status !== 'ACTIVE' && (
                  <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {plan.status}
                  </span>
                )}
              </div>
              <div
                className="hidden sm:block w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                title={`${formatShortDate(plan.startDate)} – ${formatShortDate(plan.endDate)}`}
              >
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <span className={cn('tabular-nums', remainingDays < 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-amber-700 dark:text-amber-300')}>
                {daysText}
              </span>
              <span className="hidden md:inline text-slate-500 dark:text-slate-400 tabular-nums">
                {goalCount} goal{goalCount === 1 ? '' : 's'} · {checkInCount} check-in{checkInCount === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-3">
                <button type="button" onClick={() => onNavigate('pip', { pipId: plan.id })} className={linkClass}>
                  View plan
                </button>
                <button type="button" onClick={() => onNavigate('reviews', { employeeId: plan.employeeId })} className={linkClass}>
                  Reviews
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/* =========================================================================
   Manager — "My team"
   ========================================================================= */

function teamPeople(team: DashboardTeam, onNavigate: Navigate): PersonRow[] {
  const order = { MANAGER: 0, NONE: 1, HOD: 2, HR: 3, CLOSED: 4, SELF: 5 } as Record<string, number>;
  return team.members
    .map<PersonRow>((m) => ({
      id: m.employeeId,
      name: m.name,
      subtitle: [m.designationName, m.reviewId && !m.isSelfSubmitted && m.stage === 'MANAGER' ? 'self-assessment pending' : undefined]
        .filter(Boolean)
        .join(' · '),
      stage: (m.reviewId ? m.stage || 'MANAGER' : 'NONE') as PersonRow['stage'],
      score: m.lastScore,
      flag: m.onPip ? 'PIP' : undefined,
      pipId: m.pipId,
      onPipClick: m.pipId ? () => onNavigate('pip', { pipId: m.pipId! }) : () => onNavigate('pip'),
      onClick: m.reviewId ? () => onNavigate('reviews', { reviewId: m.reviewId! }) : undefined,
    }))
    .sort((a, b) => {
      // Put team members on PIP first
      if (a.flag === 'PIP' && b.flag !== 'PIP') return -1;
      if (b.flag === 'PIP' && a.flag !== 'PIP') return 1;
      return (order[a.stage] ?? 9) - (order[b.stage] ?? 9);
    });
}

export const ManagerDashboard: React.FC<{ data: DashboardSummary; team: DashboardTeam; onNavigate: Navigate }> = ({ data, team, onNavigate }) => {
  const withMe = team.members.filter((m) => m.reviewId && (m.stage || 'MANAGER') === 'MANAGER').length;
  const overdue = data.tasks.filter((t) => t.urgency === 'OVERDUE').length;
  const spread = team.ratingSpread;
  const pipsInTeam = team.activePips || team.members.filter((m) => m.onPip);
  const pipCount = pipsInTeam.length;

  return (
    <div className="space-y-4">
      {team.activePips && team.activePips.length > 0 && (
        <TeamPipHighlightCard pips={team.activePips} roleTitle="Team" onNavigate={onNavigate} />
      )}
      <StatRow
        stats={[
          {
            label: 'Reviews waiting on you',
            value: String(withMe),
            hint: withMe ? 'Score and submit them' : 'All submitted',
            tone: withMe ? 'warn' : 'good',
            onClick: () => onNavigate('reviews'),
          },
          {
            label: 'Reviews submitted',
            value: String(team.scoredByManager),
            suffix: `/ ${team.reviewsInPeriod}`,
            progress: pct(team.scoredByManager, team.reviewsInPeriod),
          },
          {
            label: 'Self-assessments in',
            value: String(team.selfSubmitted),
            suffix: `/ ${team.reviewsInPeriod}`,
            progress: pct(team.selfSubmitted, team.reviewsInPeriod),
          },
          {
            label: 'Team average',
            value: score(team.averageScore),
            suffix: team.averageScore > 0 ? '/ 5' : undefined,
            hint: pipCount > 0
              ? `${pipCount} on PIP · ${team.size} direct report${team.size === 1 ? '' : 's'}`
              : overdue
              ? `${overdue} overdue task${overdue === 1 ? '' : 's'}`
              : `${team.size} direct report${team.size === 1 ? '' : 's'}`,
            tone: pipCount > 0 ? 'warn' : overdue ? 'bad' : 'default',
          },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <TodoCard tasks={data.tasks} alerts={team.alerts} onNavigate={onNavigate} className="lg:col-span-2" />
        <RatingCard
          title="Team ratings"
          subtitle={team.periodName}
          rows={RATING_ROWS.map((r) => ({ label: r.label, color: r.color, count: spread[r.key] }))}
          footnote={spread.unrated ? `${spread.unrated} not rated yet` : undefined}
        />
      </div>
      <PeopleCard
        title="My team"
        subtitle={team.periodName ? `${team.periodName} review status · Team members on PIP listed first` : undefined}
        people={teamPeople(team, onNavigate)}
        action={{ label: 'All reviews', onClick: () => onNavigate('reviews') }}
      />
    </div>
  );
};

/* =========================================================================
   HOD — "My department"
   ========================================================================= */

export const HodDashboard: React.FC<{ data: DashboardSummary; hod: DashboardHodOverview; onNavigate: Navigate }> = ({ data, hod, onNavigate }) => {
  const count = (stage: string) => hod.departmentMembers.filter((m) => m.stage === stage).length;
  const notStarted = hod.departmentMembers.filter((m) => !m.stage).length;
  const stages: PipelineStage[] = [
    { label: 'Not started', count: notStarted, color: stageColors.self },
    { label: 'With managers', count: count('MANAGER'), color: stageColors.manager },
    { label: 'With you', count: count('HOD'), color: stageColors.hod },
    { label: 'With HR', count: count('HR'), color: stageColors.hr },
    { label: 'Completed', count: count('CLOSED'), color: stageColors.done },
  ];
  const people: PersonRow[] = hod.departmentMembers
    .map<PersonRow>((m) => ({
      id: m.employeeId,
      name: m.name,
      subtitle: [m.designationName, m.managerName ? `Manager: ${m.managerName}` : undefined].filter(Boolean).join(' · '),
      stage: (m.stage || 'NONE') as PersonRow['stage'],
      score: m.lastScore,
      flag: m.onPip ? 'PIP' : undefined,
      pipId: m.pipId,
      onPipClick: m.pipId ? () => onNavigate('pip', { pipId: m.pipId! }) : () => onNavigate('pip'),
      onClick: () => onNavigate('reviews', { employeeId: m.employeeId }),
    }))
    .sort((a, b) => {
      // Put department members on PIP first
      if (a.flag === 'PIP' && b.flag !== 'PIP') return -1;
      if (b.flag === 'PIP' && a.flag !== 'PIP') return 1;
      return (a.stage === 'HOD' ? -1 : 0) - (b.stage === 'HOD' ? -1 : 0);
    });
  const spread = hod.ratingSpread;
  const pipCount = hod.activePips ? hod.activePips.length : hod.departmentMembers.filter((m) => m.onPip).length;

  return (
    <div className="space-y-4">
      {hod.activePips && hod.activePips.length > 0 && (
        <TeamPipHighlightCard pips={hod.activePips} roleTitle="Department" onNavigate={onNavigate} />
      )}
      <StatRow
        stats={[
          {
            label: 'Waiting for your scoring',
            value: String(hod.reviewsPendingHod),
            hint: hod.reviewsPendingHod ? 'Open HOD reviews' : 'Nothing pending',
            tone: hod.reviewsPendingHod ? 'warn' : 'good',
            onClick: () => onNavigate('reviews'),
          },
          {
            label: 'Department completion',
            value: `${Math.round(hod.completionRate)}%`,
            progress: hod.completionRate,
            hint: `${hod.reviewsCompleted} of ${hod.reviewsTotal} reviews done`,
          },
          {
            label: 'Department average',
            value: score(hod.averageScore),
            suffix: hod.averageScore ? '/ 5' : undefined,
            hint: pipCount > 0 ? `${hod.totalEmployees} employees · ${pipCount} on PIP` : `${hod.totalEmployees} employees`,
            tone: pipCount > 0 ? 'warn' : 'default',
          },
          { label: 'High performers', value: String(hod.highPerformersCount), hint: 'Rated 4 and above' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <TodoCard tasks={data.tasks} alerts={hod.alerts} onNavigate={onNavigate} className="lg:col-span-2" />
        <PipelineCard subtitle={hod.departmentName} stages={stages} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <PeopleCard title="Department members" subtitle="Members on PIP and reviews waiting for you are listed first" people={people} className="lg:col-span-2" />
        <RatingCard
          title="Department ratings"
          rows={RATING_ROWS.map((r) => ({ label: r.label, color: r.color, count: spread[r.key] }))}
          footnote={spread.unrated ? `${spread.unrated} not rated yet` : undefined}
        />
      </div>
    </div>
  );
};

/* =========================================================================
   HR — "Organisation"
   ========================================================================= */

function hrStages(hr: DashboardHrOverview): PipelineStage[] {
  return [
    { label: 'With managers', count: hr.reviewsPendingManager, color: stageColors.manager },
    { label: 'With HODs', count: hr.reviewsPendingHod, color: stageColors.hod },
    { label: 'Waiting for HR sign-off', count: hr.reviewsPendingHr, color: stageColors.hr },
    { label: 'Completed', count: hr.reviewsCompleted, color: stageColors.done },
  ];
}

export const HrDashboard: React.FC<{ data: DashboardSummary; hr: DashboardHrOverview; onNavigate: Navigate; onRefresh: () => void }> = ({
  data,
  hr,
  onNavigate,
  onRefresh,
}) => {
  // Alerts that repeat an existing task (appraisals to calibrate, KRAs to assign) are dropped.
  const hasTask = (type: string) => data.tasks.some((t) => t.type === type);
  const alerts = hr.alerts.filter(
    (a) => !(hasTask('CALIBRATE_APPRAISAL') && a.id === 'alert_pending_appraisals') && !(hasTask('ASSIGN_KRAS') && a.id === 'alert_missing_kras')
  );
  return (
  <div className="space-y-4">
    <StatRow
      stats={[
        {
          label: 'Waiting for your sign-off',
          value: String(hr.reviewsPendingHr),
          hint: hr.reviewsPendingHr ? 'Approve or return' : 'Nothing pending',
          tone: hr.reviewsPendingHr ? 'warn' : 'good',
          onClick: () => onNavigate('reviews'),
        },
        {
          label: 'Cycle completion',
          value: `${Math.round(hr.completionRate)}%`,
          progress: hr.completionRate,
          hint: `${hr.reviewsCompleted} of ${hr.reviewsTotal} reviews`,
        },
        {
          label: 'Appraisals in progress',
          value: String(hr.pendingAppraisals),
          hint: 'Annual increments not yet final',
          onClick: () => onNavigate('appraisals'),
        },
        {
          label: 'KRA coverage',
          value: `${Math.round(hr.kraCoverageRate)}%`,
          progress: hr.kraCoverageRate,
          hint: hr.employeesWithoutKras ? `${hr.employeesWithoutKras} without KRAs` : 'Everyone has KRAs',
          tone: hr.employeesWithoutKras ? 'warn' : 'good',
          onClick: () => onNavigate('kras'),
        },
      ]}
    />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <TodoCard tasks={data.tasks} alerts={alerts} onNavigate={onNavigate} className="lg:col-span-2" />
      <PipelineCard subtitle={`${hr.reviewsTotal} reviews this cycle`} stages={hrStages(hr)} action={{ label: 'Open', onClick: () => onNavigate('reviews') }} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <CoverageCard coverage={hr.coverage} onNavigate={onNavigate} />
      <ReviewersBehindCard backlog={hr.reviewerBacklog} onReminded={onRefresh} />
      <CalibrationCard calibration={hr.calibration} onNavigate={onNavigate} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      <ProgressListCard
        title="Departments"
        subtitle="Completed reviews out of employees, furthest behind first"
        className="lg:col-span-2"
        // Measured against headcount (completed ÷ employees) so every row is comparable and
        // matches the coverage and Admin figures — not against only the reviews that exist.
        rows={hr.departmentProgress
          .filter((d) => d.totalEmployees > 0)
          .map((d) => ({
            key: d.departmentId,
            label: d.departmentName,
            detail: `${d.reviewsCompleted}/${d.totalEmployees} done${d.reviewsInitiated < d.totalEmployees ? ` · ${d.totalEmployees - d.reviewsInitiated} without review` : ''}`,
            percent: (d.reviewsCompleted / d.totalEmployees) * 100,
          }))}
        action={{ label: 'Reports', onClick: () => onNavigate('reports') }}
      />
      <DatesCard events={hrDates(hr)} />
    </div>
  </div>
  );
};

/* =========================================================================
   Admin — "System"
   ========================================================================= */

export const AdminDashboard: React.FC<{ data: DashboardSummary; admin: DashboardAdminOverview; onNavigate: Navigate }> = ({
  data,
  admin,
  onNavigate,
}) => {
  const hr = data.hr;
  const reviewed = admin.reviewCycleProgress.reduce((s, d) => s + d.reviewed, 0);
  const inScope = admin.reviewCycleProgress.reduce((s, d) => s + d.totalEmployees, 0);
  const completion = hr ? hr.completionRate : pct(reviewed, inScope);
  // Attention items that repeat an existing task (appraisals to calibrate, KRAs to assign) are dropped.
  const hasTask = (type: string) => data.tasks.some((t) => t.type === type);
  const attention = admin.attentionItems
    .filter((a) => !(hasTask('CALIBRATE_APPRAISAL') && a.id === 'attn_pending_appraisals') && !(hasTask('ASSIGN_KRAS') && a.id === 'attn_no_kra'))
    .map((a) => ({
    id: a.id,
    type: (a.color === 'red' ? 'crit' : a.color === 'amber' ? 'warn' : 'info') as 'crit' | 'warn' | 'info',
    title: a.title,
    detail: a.detail,
    link: a.link,
  }));
  // admin.alerts only repeats what attentionItems already say (missing managers, deadline),
  // so the attention items are the single source here.
  const todoCount = countTodo(data.tasks, attention);
  const joinerText = [
    admin.newJoinersThisMonth ? `+${admin.newJoinersThisMonth} joined` : '',
    admin.exitsThisMonth ? `−${admin.exitsThisMonth} left` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4">
      <StatRow
        stats={[
          {
            label: 'Active employees',
            value: String(admin.totalEmployees),
            hint: joinerText ? `${joinerText} this month` : `${admin.totalDepartments} departments`,
            onClick: () => onNavigate('employees'),
          },
          {
            label: 'Users',
            value: String(admin.activeUsers),
            suffix: `/ ${admin.totalUsers}`,
            hint: 'active accounts',
          },
          {
            label: 'Review cycle completion',
            value: `${Math.round(completion)}%`,
            progress: completion,
            hint: admin.activePeriodName,
            onClick: () => onNavigate('reviews'),
          },
          {
            label: 'Needs attention',
            value: String(todoCount),
            hint: todoCount ? 'Tasks and setup issues' : 'All clear',
            tone: todoCount ? 'warn' : 'good',
          },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <TodoCard title="Needs attention" tasks={data.tasks} alerts={attention} onNavigate={onNavigate} className="lg:col-span-2" />
        {hr ? (
          <PipelineCard subtitle={`${hr.reviewsTotal} reviews this cycle`} stages={hrStages(hr)} action={{ label: 'Open', onClick: () => onNavigate('reviews') }} />
        ) : (
          <DatesCard events={[]} />
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <CoverageCard coverage={hr?.coverage ?? null} onNavigate={onNavigate} />
        <DataHealthCard items={admin.dataHealth} onNavigate={onNavigate} />
        <EmailDeliveryCard email={admin.emailDelivery} onNavigate={onNavigate} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <ProgressListCard
          title="Departments"
          subtitle="Completed reviews out of employees, furthest behind first"
          className="lg:col-span-2"
          rows={admin.reviewCycleProgress.filter((d) => d.totalEmployees > 0).map((d) => ({
            key: d.departmentId,
            label: d.departmentName,
            detail: `${d.reviewed}/${d.totalEmployees} done`,
            percent: d.completionRate,
          }))}
          action={{ label: 'Hierarchy', onClick: () => onNavigate('hierarchy') }}
        />
        <DatesCard events={hrDates(hr)} />
      </div>
    </div>
  );
};
