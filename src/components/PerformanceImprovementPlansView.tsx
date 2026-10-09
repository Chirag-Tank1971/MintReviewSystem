import React, { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Building2,
  User as UserIcon,
  TrendingUp,
  Timer,
  Target,
} from 'lucide-react';
import { Employee, Department, PerformanceImprovementPlan, User } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { StatusBadge } from './ui/StatusBadge';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { EmptyState } from './ui/EmptyState';
import { CreatePipModal } from './CreatePipModal';
import { PipDetailModal } from './PipDetailModal';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

interface PerformanceImprovementPlansViewProps {
  currentUser?: User | null;
  employees: Employee[];
  departments: Department[];
  /** Deep-link support — e.g. opening a specific plan straight from a notification's "Take Action". */
  initialConfig?: { pipId?: string } | null;
}

const STATUS_TONE: Record<PerformanceImprovementPlan['status'], 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  DRAFT: 'default',
  ACTIVE: 'primary',
  EXTENDED: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'default',
};

const STATUS_ICON: Record<PerformanceImprovementPlan['status'], React.ReactNode> = {
  DRAFT: <Clock className="w-3 h-3" />,
  ACTIVE: <ClipboardList className="w-3 h-3" />,
  EXTENDED: <Clock className="w-3 h-3" />,
  SUCCEEDED: <CheckCircle2 className="w-3 h-3" />,
  FAILED: <XCircle className="w-3 h-3" />,
  CANCELLED: <XCircle className="w-3 h-3" />,
};

export const PerformanceImprovementPlansView: React.FC<PerformanceImprovementPlansViewProps> = ({
  currentUser,
  employees,
  departments,
  initialConfig,
}) => {
  const [plans, setPlans] = useState<PerformanceImprovementPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PerformanceImprovementPlan['status']>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PerformanceImprovementPlan | null>(null);
  const [analytics, setAnalytics] = useState<{
    total: number;
    activeCount: number;
    successRate: number | null;
    avgDurationDays: number | null;
  } | null>(null);

  const isHrOrAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR';

  useEffect(() => {
    if (!isHrOrAdmin) return;
    api
      .getPipAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHrOrAdmin]);

  const loadPlans = async () => {
    try {
      const data = await api.getPips();
      setPlans(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load performance improvement plans.', 'Load Failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link from a notification's "Take Action" — once the list has loaded, auto-open the
  // referenced plan. Falls back to a direct fetch if it's somehow not in the (unfiltered) list,
  // e.g. a resolved plan outside whatever the backend might scope down in the future.
  useEffect(() => {
    if (!initialConfig?.pipId || isLoading) return;
    const match = plans.find((p) => p.id === initialConfig.pipId);
    if (match) {
      setSelectedPlan(match);
    } else {
      api.getPip(initialConfig.pipId).then(setSelectedPlan).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig?.pipId, isLoading]);

  const filtered = useMemo(() => {
    let result = plans;
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.employeeName.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q)
      );
    }
    return result;
  }, [plans, statusFilter, searchQuery]);

  const activeCount = plans.filter((p) => p.status === 'ACTIVE' || p.status === 'EXTENDED').length;

  if (isLoading) {
    return <PageSkeletonLoader variant="generic" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Improvement plans"
        meta={activeCount > 0 && <StatusBadge status={`${activeCount} active`} tone="warning" showDot={false} />}
        description="Time-boxed plans for employees who are underperforming. While a plan is active, the employee isn't eligible for the annual appraisal."
        actions={
          isHrOrAdmin && (
            <Button variant="primary" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
              Start improvement plan
            </Button>
          )
        }
      />

      {isHrOrAdmin && analytics && analytics.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Currently active
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{analytics.activeCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Success rate
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {analytics.successRate !== null ? `${analytics.successRate}%` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" /> Avg. Duration
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {analytics.avgDurationDays !== null ? `${analytics.avgDurationDays}d` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Total plans
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{analytics.total}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name or code..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'DRAFT', 'ACTIVE', 'EXTENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setIsLoading(true);
            loadPlans();
          }}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-auto"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={plans.length === 0 ? 'No Performance Improvement Plans' : 'No plans match your filters'}
          description={
            plans.length === 0
              ? isHrOrAdmin
                ? 'Start a plan for an underperforming employee to track corrective goals and check-ins.'
                : currentUser?.role === 'EMPLOYEE'
                ? 'You have no performance improvement plans on record.'
                : 'No plans have been assigned to your reportees yet.'
              : 'Try a different search term or status filter.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan) => {
            const dept = departments.find((d) => d.id === plan.departmentId);
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {plan.employeeName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{plan.employeeName}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{plan.employeeCode}</p>
                      </div>
                    </div>
                    <StatusBadge status={plan.status} tone={STATUS_TONE[plan.status]} icon={STATUS_ICON[plan.status]} />
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{plan.reason}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {dept?.name || plan.departmentName || 'General'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(plan.startDate).toLocaleDateString()} — {new Date(plan.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {plan.goals.length} goal{plan.goals.length !== 1 ? 's' : ''} • {plan.checkIns.length} check-in{plan.checkIns.length !== 1 ? 's' : ''}
                  </span>
                  {plan.status === 'DRAFT' && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Not yet published</span>
                  )}
                  {(plan.status === 'ACTIVE' || plan.status === 'EXTENDED') && !plan.employeeAcknowledgement?.acknowledged && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Awaiting acknowledgement</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreateModalOpen && (
        <CreatePipModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          employees={employees}
          existingPlans={plans}
          onCreated={() => {
            setIsCreateModalOpen(false);
            loadPlans();
          }}
        />
      )}

      {selectedPlan && (
        <PipDetailModal
          plan={selectedPlan}
          currentUser={currentUser}
          onClose={() => setSelectedPlan(null)}
          onChanged={(updated) => {
            setSelectedPlan(updated);
            setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}
    </div>
  );
};
