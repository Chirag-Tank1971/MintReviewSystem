import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Minus,
  Download,
  Search,
  RefreshCw,
  Eye,
  Award,
  DollarSign,
  ShieldCheck,
  X,
  UserCheck,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ManagementDashboardData,
  ManagementDepartmentPerformanceItem,
  ManagementPerformanceTrendsData,
  ManagementPerformerItem,
  ManagementAttentionItem,
  ManagementAppraisalSummaryData,
  ManagementEmployeeDossier,
  ManagementWorkforceRiskData,
  Department,
  ReviewPeriod,
} from '../types';
import { api } from '../services/api';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { PieChart, PieChartItem } from './ui/PieChart';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { SELECT_CLASS } from './ui/formStyles';

interface ManagementDashboardViewProps {
  departments?: Department[];
}

type TabType = 'departments' | 'trends' | 'talent' | 'appraisals' | 'workforceRisk';

const safeNum = (val: any, decimals: number = 2, fallback: string = '0.00'): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback;
  return Number(val).toFixed(decimals);
};

export const ManagementDashboardView: React.FC<ManagementDashboardViewProps> = ({
  departments = [],
}) => {
  // State: Tab navigation
  const [activeTab, setActiveTab] = useState<TabType>('departments');

  // State: Filters
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [allPeriods, setAllPeriods] = useState<ReviewPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchDeptQuery, setSearchDeptQuery] = useState<string>('');
  const [deptSortBy, setDeptSortBy] = useState<string>('averageScore');
  const [deptSortOrder, setDeptSortOrder] = useState<'asc' | 'desc'>('desc');

  // State: Talent pool sub-tab
  const [talentSubTab, setTalentSubTab] = useState<'high_performers' | 'attention'>('high_performers');
  const [performerThreshold, setPerformerThreshold] = useState<number>(4.0);
  const [attentionThreshold, setAttentionThreshold] = useState<number>(3.0);

  // State: Data caches
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [dashboardData, setDashboardData] = useState<ManagementDashboardData | null>(null);

  const [loadingDepts, setLoadingDepts] = useState<boolean>(false);
  const [deptPerformance, setDeptPerformance] = useState<ManagementDepartmentPerformanceItem[]>([]);

  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const [trendsData, setTrendsData] = useState<ManagementPerformanceTrendsData | null>(null);

  const [loadingTalent, setLoadingTalent] = useState<boolean>(false);
  const [highPerformers, setHighPerformers] = useState<ManagementPerformerItem[]>([]);
  const [attentionItems, setAttentionItems] = useState<ManagementAttentionItem[]>([]);

  const [loadingAppraisals, setLoadingAppraisals] = useState<boolean>(false);
  const [appraisalsData, setAppraisalsData] = useState<ManagementAppraisalSummaryData | null>(null);

  const [loadingWorkforceRisk, setLoadingWorkforceRisk] = useState<boolean>(false);
  const [workforceRiskData, setWorkforceRiskData] = useState<ManagementWorkforceRiskData | null>(null);

  // State: Modals
  const [selectedEmployeeDossierId, setSelectedEmployeeDossierId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);
  const [dossierData, setDossierData] = useState<ManagementEmployeeDossier | null>(null);

  const [inspectDepartment, setInspectDepartment] = useState<ManagementDepartmentPerformanceItem | null>(null);
  const [inspectDeptReviews, setInspectDeptReviews] = useState<any[]>([]);
  const [loadingDeptReviews, setLoadingDeptReviews] = useState<boolean>(false);

  // Load Review Periods on Mount
  useEffect(() => {
    async function loadPeriods() {
      try {
        const periods = await api.getReviewPeriods();
        setAllPeriods(periods || []);
        const active = periods.find((p: ReviewPeriod) => p.status === 'ACTIVE');
        if (active) {
          setSelectedPeriodId(active.id);
        } else if (periods.length > 0) {
          setSelectedPeriodId(periods[0].id);
        }
      } catch (err) {
        console.error('Failed to load review periods:', err);
      }
    }
    loadPeriods();
  }, []);

  // Fetch Dashboard Summary
  const fetchDashboardSummary = async () => {
    setLoadingDashboard(true);
    try {
      const data = await api.getManagementDashboard({
        periodId: selectedPeriodId || undefined,
      });
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to fetch management dashboard summary:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Fetch Department Performance Table
  const fetchDepartmentPerformance = async () => {
    setLoadingDepts(true);
    try {
      const res = await api.getManagementDepartmentPerformance({
        periodId: selectedPeriodId || undefined,
        search: searchDeptQuery,
        sortBy: deptSortBy,
        sortOrder: deptSortOrder,
      });
      setDeptPerformance(res.departments || []);
    } catch (err) {
      console.error('Failed to fetch department performance:', err);
    } finally {
      setLoadingDepts(false);
    }
  };

  // Fetch Performance Trends
  const fetchPerformanceTrends = async () => {
    setLoadingTrends(true);
    try {
      const data = await api.getManagementPerformanceTrends({ year: selectedYear });
      setTrendsData(data);
    } catch (err) {
      console.error('Failed to fetch performance trends:', err);
    } finally {
      setLoadingTrends(false);
    }
  };

  // Fetch Talent Pool Data
  const fetchTalentPool = async () => {
    setLoadingTalent(true);
    try {
      if (talentSubTab === 'high_performers') {
        const res = await api.getManagementHighPerformers({
          periodId: selectedPeriodId || undefined,
          threshold: performerThreshold,
          limit: 50,
        });
        setHighPerformers(res.performers || []);
      } else {
        const res = await api.getManagementAttentionRequired({
          periodId: selectedPeriodId || undefined,
          threshold: attentionThreshold,
          limit: 50,
        });
        setAttentionItems(res.attentionItems || []);
      }
    } catch (err) {
      console.error('Failed to fetch talent pool data:', err);
    } finally {
      setLoadingTalent(false);
    }
  };

  // Fetch Workforce Risk (Active PIPs, stale check-ins, outcomes, live overdue alert)
  const fetchWorkforceRisk = async () => {
    setLoadingWorkforceRisk(true);
    try {
      const data = await api.getManagementWorkforceRisk({ year: selectedYear });
      setWorkforceRiskData(data);
    } catch (err) {
      console.error('Failed to fetch workforce risk snapshot:', err);
    } finally {
      setLoadingWorkforceRisk(false);
    }
  };

  // Fetch Appraisal Summary
  const fetchAppraisalSummary = async () => {
    setLoadingAppraisals(true);
    try {
      const data = await api.getManagementAppraisalsSummary({
        year: selectedYear,
      });
      setAppraisalsData(data);
    } catch (err) {
      console.error('Failed to fetch appraisal summary:', err);
    } finally {
      setLoadingAppraisals(false);
    }
  };

  // Refetch when Period Changes
  useEffect(() => {
    fetchDashboardSummary();
    fetchDepartmentPerformance();
  }, [selectedPeriodId]);

  // Tab-driven lazy data fetches
  useEffect(() => {
    if (activeTab === 'departments') {
      fetchDepartmentPerformance();
    } else if (activeTab === 'trends') {
      fetchPerformanceTrends();
    } else if (activeTab === 'talent') {
      fetchTalentPool();
    } else if (activeTab === 'appraisals') {
      fetchAppraisalSummary();
    } else if (activeTab === 'workforceRisk') {
      fetchWorkforceRisk();
    }
  }, [activeTab, selectedPeriodId, selectedYear, deptSortBy, deptSortOrder, searchDeptQuery, talentSubTab]);

  // Open Employee Dossier Modal
  const handleOpenDossier = async (employeeId: string) => {
    setSelectedEmployeeDossierId(employeeId);
    setDossierLoading(true);
    try {
      const dossier = await api.getManagementEmployeePerformance(employeeId);
      setDossierData(dossier);
    } catch (err) {
      console.error('Failed to fetch employee dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  // Open Department Inspection Modal
  const handleInspectDepartment = async (dept: ManagementDepartmentPerformanceItem) => {
    setInspectDepartment(dept);
    setLoadingDeptReviews(true);
    try {
      const res = await api.getReviews({
        departmentId: dept.departmentId,
        periodId: selectedPeriodId || undefined,
      });
      setInspectDeptReviews(Array.isArray(res) ? res : (res as any)?.reviews || []);
    } catch (err) {
      console.error('Failed to load department reviews:', err);
      setInspectDeptReviews([]);
    } finally {
      setLoadingDeptReviews(false);
    }
  };

  // Export CSV Helper
  const handleExportDepartmentCSV = () => {
    if (!deptPerformance.length) return;
    const headers = [
      'Department',
      'Headcount',
      'Total Reviews',
      'Completed',
      'Completion %',
      'Pending Manager',
      'Pending HR',
      'Returned',
      'Overdue',
      'Average Rating (1-5)',
      'Prev Quarter Score',
      'Trend',
      'Appraisals Due',
    ];
    const rows = deptPerformance.map((d) => [
      `"${d.departmentName}"`,
      d.headcount,
      d.totalReviews,
      d.completedReviews,
      `${d.completionRate}%`,
      d.managerPending,
      d.hrPending,
      d.returnedCount,
      d.overdueCount,
      d.averageScore > 0 ? d.averageScore : 'N/A',
      d.previousQuarterScore > 0 ? d.previousQuarterScore : 'N/A',
      d.trend,
      d.appraisalDueCount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Department_Performance_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTalentCSV = () => {
    if (talentSubTab === 'high_performers') {
      if (!highPerformers.length) return;
      const headers = ['Employee Code', 'Name', 'Department', 'Designation', 'Reporting Manager', 'Final Score', 'Rating Category', 'Review Period'];
      const rows = highPerformers.map((p) => [
        `"${p.employeeCode}"`,
        `"${p.employeeName}"`,
        `"${p.departmentName}"`,
        `"${p.designation}"`,
        `"${p.managerName}"`,
        p.finalScore,
        `"${p.ratingLabel || 'Outstanding'}"`,
        `"${p.reviewPeriodName}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `High_Performers_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (!attentionItems.length) return;
      const headers = ['Employee Code', 'Name', 'Department', 'Designation', 'Reporting Manager', 'Score', 'Status', 'Urgency', 'Flag Reason', 'Review Period'];
      const rows = attentionItems.map((a) => [
        `"${a.employeeCode}"`,
        `"${a.employeeName}"`,
        `"${a.departmentName}"`,
        `"${a.designation}"`,
        `"${a.managerName}"`,
        a.score > 0 ? a.score : 'N/A',
        `"${a.status}"`,
        `"${a.urgency}"`,
        `"${a.reason}"`,
        `"${a.reviewPeriodName}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Attention_Required_List_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const orgSummary = dashboardData?.organizationSummary;
  const orgPerf = dashboardData?.organizationPerformance;
  const appraisalSummary = dashboardData?.appraisalSummary;

  // Pie Chart 1: Review Pipeline Status Distribution
  const reviewStatusData = useMemo<PieChartItem[]>(() => {
    if (!orgSummary) return [];
    const completed = orgSummary.completedReviews || 0;
    const mgrPending = orgSummary.pendingManagerReviews || 0;
    const hodPending = orgSummary.pendingHodReviews || 0;
    const hrPending = orgSummary.pendingHrReviews || 0;
    const overdue = (orgSummary.overdueReviews || 0) + (orgSummary.returnedReviews || 0);

    return [
      { label: 'Completed', value: completed, color: '#10B981', subtext: 'Finalized reviews' },
      { label: 'Manager Pending', value: mgrPending, color: '#F59E0B', subtext: 'Awaiting ratings' },
      { label: 'HOD Pending', value: hodPending, color: '#8B5CF6', subtext: 'Awaiting HOD approval' },
      { label: 'HR Sign-off Pending', value: hrPending, color: '#6366F1', subtext: 'Ready for approval' },
      { label: 'Bottlenecks & Overdue', value: overdue, color: '#F43F5E', subtext: 'Needs escalation' },
    ];
  }, [orgSummary]);

  // Pie Chart 2: Workforce / Headcount Allocation by Department
  const departmentShareData = useMemo<PieChartItem[]>(() => {
    const palette = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#64748B'];
    if (deptPerformance && deptPerformance.length > 0) {
      // Filter strictly to departments with active headcount to prevent phantom zero-count slices
      const activeDepts = deptPerformance.filter((d) => Number(d.headcount) > 0);
      const sorted = [...activeDepts].sort((a, b) => (b.headcount || 0) - (a.headcount || 0));

      if (sorted.length === 0) {
        return [];
      }

      if (sorted.length <= 5) {
        return sorted.map((d, i) => ({
          label: d.departmentName,
          value: d.headcount,
          color: palette[i % palette.length],
        }));
      }

      const top4 = sorted.slice(0, 4).map((d, i) => ({
        label: d.departmentName,
        value: d.headcount,
        color: palette[i % palette.length],
      }));
      const othersCount = sorted.slice(4).reduce((sum, d) => sum + (d.headcount || 0), 0);
      if (othersCount > 0) {
        top4.push({
          label: `Other (${sorted.length - 4} Depts)`,
          value: othersCount,
          color: '#64748B',
        });
      }
      return top4;
    }
    if (departments && departments.length > 0) {
      return (departments as Department[]).slice(0, 5).map((d: Department, i: number) => ({
        label: d.name,
        value: 1,
        color: palette[i % palette.length],
      }));
    }
    return [];
  }, [deptPerformance, departments]);

  // Pie Chart 3: Performance Rating Score Spread
  const performanceSpreadData = useMemo<PieChartItem[]>(() => {
    // 1. If backend provides accurate individual review rating distribution, use it directly
    if (orgPerf?.ratingDistribution) {
      const dist = orgPerf.ratingDistribution;
      return [
        { label: 'Exceptional (≥ 4.0)', value: dist.exceptional || 0, color: '#10B981', subtext: 'Top performers' },
        { label: 'Proficient (3.0 – 3.9)', value: dist.proficient || 0, color: '#3B82F6', subtext: 'Target standard' },
        { label: 'Needs Focus (< 3.0)', value: dist.needsFocus || 0, color: '#F43F5E', subtext: 'Development plan' },
        { label: 'In Evaluation', value: dist.inEvaluation || 0, color: '#94A3B8', subtext: 'Awaiting completion' },
      ];
    }

    // 2. Fallback: Aggregate completed reviews by department
    let exceptional = 0; // >= 4.0
    let proficient = 0;  // 3.0 - 3.99
    let needsFocus = 0;  // < 3.0 & > 0
    let pendingEval = 0;

    if (deptPerformance && deptPerformance.length > 0) {
      deptPerformance.forEach((dept) => {
        const avg = Number(dept.averageScore) || 0;
        const completed = dept.completedReviews || 0;
        const pending = Math.max(0, (dept.totalReviews || 0) - completed);

        if (avg >= 4.0) {
          exceptional += completed;
        } else if (avg >= 3.0) {
          proficient += completed;
        } else if (avg > 0) {
          needsFocus += completed;
        }
        pendingEval += pending;
      });
    }

    if (exceptional === 0 && proficient === 0 && needsFocus === 0 && pendingEval === 0) {
      const totalReviews = orgSummary?.totalQuarterlyReviews || 0;
      const completed = orgSummary?.completedReviews || 0;
      exceptional = completed;
      pendingEval = Math.max(0, totalReviews - completed);
    }

    return [
      { label: 'Exceptional (≥ 4.0)', value: exceptional, color: '#10B981', subtext: 'Top performers' },
      { label: 'Proficient (3.0 – 3.9)', value: proficient, color: '#3B82F6', subtext: 'Target standard' },
      { label: 'Needs Focus (< 3.0)', value: needsFocus, color: '#F43F5E', subtext: 'Development plan' },
      { label: 'In Evaluation', value: pendingEval, color: '#94A3B8', subtext: 'Awaiting completion' },
    ];
  }, [orgPerf, deptPerformance, orgSummary]);

  // Pie Chart 4: Appraisal Cohort Status
  const appraisalStatusData = useMemo<PieChartItem[]>(() => {
    if (!appraisalsData) return [];
    const locked = appraisalsData.summary?.totalLocked || 0;
    const initiated = Math.max(0, (appraisalsData.summary?.totalInitiated || 0) - locked);
    const pending = Math.max(0, (appraisalsData.summary?.totalEligible || 0) - (appraisalsData.summary?.totalInitiated || 0));

    return [
      { label: 'Locked & Finalized', value: locked, color: '#10B981', subtext: 'Approved rollups' },
      { label: 'In Calibration', value: initiated, color: '#F59E0B', subtext: 'Manager & HR review' },
      { label: 'Due for Cohort', value: pending, color: '#3B82F6', subtext: 'Pending initiation' },
    ];
  }, [appraisalsData]);

  if (loadingDashboard && !dashboardData) {
    return <PageSkeletonLoader variant="dashboard" />;
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Organization overview"
        description="Review progress, department rankings, score trends and appraisal results across the organization."
        actions={
          <>
            <select aria-label="Review period"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Latest active quarter</option>
              {allPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  Q{p.quarter} {p.year} {p.status === 'ACTIVE' ? '(Active)' : `(${p.status})`}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              icon={RefreshCw}
              iconSpin={loadingDashboard}
              title="Refresh"
              aria-label="Refresh all figures"
              onClick={() => {
                fetchDashboardSummary();
                if (activeTab === 'departments') fetchDepartmentPerformance();
                if (activeTab === 'trends') fetchPerformanceTrends();
                if (activeTab === 'talent') fetchTalentPool();
                if (activeTab === 'appraisals') fetchAppraisalSummary();
                if (activeTab === 'workforceRisk') fetchWorkforceRisk();
              }}
            />
          </>
        }
      />

      {/* 2. Organization Summary Strip (8 KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Total Workforce */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total workforce</span>
            <Users className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.totalActiveEmployees ?? '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">active</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span>{orgSummary?.totalDepartments ?? 0} Departments</span>
          </div>
        </div>

        {/* Review Completion Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Completion rate</span>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.reviewCompletionRate ?? 0}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({orgSummary?.completedReviews ?? 0}/{orgSummary?.totalQuarterlyReviews ?? 0})
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(orgSummary?.reviewCompletionRate ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Pending Manager Reviews */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Manager pending</span>
            <Clock className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.pendingManagerReviews ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
            <span>Awaiting manager ratings</span>
          </div>
        </div>

        {/* Pending HOD Reviews */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">HOD pending</span>
            <UserCheck className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.pendingHodReviews ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-violet-600 dark:text-violet-400 mt-1 flex items-center gap-1 font-medium">
            <span>Awaiting HOD approval</span>
          </div>
        </div>

        {/* Pending HR / Calibration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">HR review pending</span>
            <UserCheck className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.pendingHrReviews ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span>Ready for sign-off</span>
          </div>
        </div>

        {/* Overdue / Returned Bottlenecks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bottlenecks & overdue</span>
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
              {orgSummary?.overdueReviews ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">overdue</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span>{orgSummary?.returnedReviews ?? 0} returned for revision</span>
          </div>
        </div>

        {/* Appraisals Due in Cycle */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Appraisals due</span>
            <Award className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {orgSummary?.employeesDueForAppraisal ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">cohort</span>
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            <span>{appraisalSummary?.totalLocked ?? 0} locked / finalized</span>
          </div>
        </div>
      </div>

      {/* 2.5 Executive Visual Intelligence (Interactive Pie & Donut Charts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Review Pipeline Distribution */}
        <PieChart
          title="Review Pipeline Distribution"
          subtitle="Real-time quarter review progress"
          data={reviewStatusData}
          centerValue={orgSummary?.totalQuarterlyReviews ?? 0}
          centerLabel="Reviews"
          formatValue={(v) => v.toString()}
        />

        {/* Workforce by Department */}
        <PieChart
          title="Workforce by Department"
          subtitle="Headcount allocation across units"
          data={departmentShareData}
          centerValue={orgSummary?.totalActiveEmployees ?? 0}
          centerLabel="Headcount"
          formatValue={(v) => v.toString()}
        />

        {/* Performance Rating Score Spread */}
        <PieChart
          title="Performance Rating Spread"
          subtitle="Evaluation score distribution"
          data={performanceSpreadData}
          centerValue={safeNum(orgPerf?.currentQuarterAverageScore, 2, '—')}
          centerLabel="Quarter Avg"
          formatValue={(v) => v.toString()}
        />
      </div>

      {/* 3. Organization Performance Scoreboard & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Overall Score Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Organization scoreboard
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {orgSummary?.currentQuarter || 'Current Quarter'}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="w-18 h-18 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {safeNum(orgPerf?.currentQuarterAverageScore, 2, '—')}
                </span>
                <span className="text-[11px] font-semibold text-indigo-400 dark:text-indigo-300">Out of 5.0</span>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Current quarter avg score</div>
                <div className="flex items-center gap-2 mt-1">
                  {orgPerf?.trendDirection === 'UP' ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{safeNum(orgPerf?.scoreDelta, 2, '0.00')} pts
                    </span>
                  ) : orgPerf?.trendDirection === 'DOWN' ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {safeNum(orgPerf?.scoreDelta, 2, '0.00')} pts
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      <Minus className="w-3.5 h-3.5" />
                      Stable
                    </span>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">vs. Prev Quarter ({safeNum(orgPerf?.previousQuarterAverageScore, 2, 'N/A')})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">All-time organization benchmark:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {safeNum(orgPerf?.overallAverageScore, 2, '—')} / 5.0
            </span>
          </div>
        </div>

        {/* Highest Performing Departments Spotlight */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Top performing departments
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Quarter avg</span>
          </div>

          <div className="space-y-2.5">
            {orgPerf?.highestPerformingDepartments && orgPerf.highestPerformingDepartments.length > 0 ? (
              orgPerf.highestPerformingDepartments.map((dept, idx) => (
                <div
                  key={dept.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {dept.name}
                    </span>
                  </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{dept.completionRate}% Done</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {safeNum(dept.averageScore, 2, '0.00')}
                      </span>
                    </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No department scores finalized yet for this period.</div>
            )}
          </div>
        </div>

        {/* Departments Requiring Attention Spotlight */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Departments requiring attention
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Bottlenecks & scores</span>
          </div>

          <div className="space-y-2.5">
            {orgPerf?.departmentsRequiringAttention && orgPerf.departmentsRequiringAttention.length > 0 ? (
              orgPerf.departmentsRequiringAttention.map((dept, idx) => (
                <div
                  key={dept.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {dept.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      {dept.pendingCount} pending
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {Number(dept.averageScore) > 0 ? `${safeNum(dept.averageScore, 2)} avg` : `${dept.completionRate ?? 0}% done`}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">All departments are progressing within healthy thresholds!</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Deep-Dive Section with Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Tab Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('departments')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'departments'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Department performance</span>
            </button>

            <button
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'trends'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Quarterly trends</span>
            </button>

            <button
              onClick={() => setActiveTab('talent')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'talent'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>High performers & attention</span>
            </button>

            <button
              onClick={() => setActiveTab('appraisals')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'appraisals'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Appraisal & budget rollups</span>
            </button>

            <button
              onClick={() => setActiveTab('workforceRisk')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'workforceRisk'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Workforce risk & alerts</span>
            </button>
          </div>

          {/* Export Action */}
          <div className="pb-2">
            {activeTab === 'departments' && (
              <button
                onClick={handleExportDepartmentCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
            {activeTab === 'talent' && (
              <button
                onClick={handleExportTalentCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export talent pool CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Department Performance Matrix */}
        {activeTab === 'departments' && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Search & Sort Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search departments..."
                  value={searchDeptQuery}
                  onChange={(e) => setSearchDeptQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sort by:</span>
                <select
                  value={deptSortBy}
                  onChange={(e) => setDeptSortBy(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="averageScore">Average rating</option>
                  <option value="completionRate">Completion rate</option>
                  <option value="headcount">Headcount</option>
                  <option value="managerPending">Manager pending</option>
                  <option value="overdueCount">Overdue count</option>
                </select>
                <button
                  onClick={() => setDeptSortOrder(deptSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  {deptSortOrder === 'desc' ? 'High → Low' : 'Low → High'}
                </button>
              </div>
            </div>

            {/* Department Comparison Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-3 text-center">Headcount</th>
                    <th className="py-3 px-3 text-center">Progress</th>
                    <th className="py-3 px-3 text-center">Pending mgr</th>
                    <th className="py-3 px-3 text-center">Pending HR</th>
                    <th className="py-3 px-3 text-center">Overdue</th>
                    <th className="py-3 px-3 text-right">Avg rating</th>
                    <th className="py-3 px-3 text-center">Trend</th>
                    <th className="py-3 px-3 text-center">Appraisals due</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {loadingDepts ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading department comparison matrix...
                      </td>
                    </tr>
                  ) : deptPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No department data found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    deptPerformance.map((dept) => {
                      const headcount = dept.headcount ?? (dept as any).employeeCount ?? 0;
                      const completionRate = dept.completionRate ?? (dept as any).reviewCompletionRate ?? 0;
                      const completedReviews = dept.completedReviews ?? (dept as any).completedReviewsCount ?? 0;
                      const totalReviews = dept.totalReviews ?? (dept as any).totalReviewsCount ?? 0;
                      const managerPending = dept.managerPending ?? (dept as any).managerPendingCount ?? 0;
                      const hrPending = dept.hrPending ?? (dept as any).hrPendingCount ?? 0;
                      const overdueCount = dept.overdueCount ?? (dept as any).overdueReviewsCount ?? 0;
                      const scoreDelta = dept.scoreDelta ?? (dept as any).performanceChange ?? 0;
                      const appraisalDueCount = dept.appraisalDueCount ?? (dept as any).dueCount ?? 0;

                      return (
                        <tr key={dept.departmentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {dept.departmentName}
                          </td>
                          <td className="py-3 px-3 text-center font-medium text-slate-800 dark:text-slate-200">{headcount}</td>
                          <td className="py-3 px-3">
                            <div className="w-28 mx-auto">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{completionRate}%</span>
                                <span className="text-slate-400">{completedReviews}/{totalReviews}</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    completionRate >= 90
                                      ? 'bg-emerald-500'
                                      : completionRate >= 70
                                      ? 'bg-amber-500'
                                      : completionRate > 0
                                      ? 'bg-indigo-500'
                                      : 'bg-transparent'
                                  }`}
                                  style={{ width: `${Math.min(Math.max(completionRate, 0), 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {managerPending > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[22px] px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                                {managerPending}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {hrPending > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[22px] px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                                {hrPending}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {overdueCount > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[22px] px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60">
                                {overdueCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-bold ${
                              Number(dept.averageScore) >= 4.0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : Number(dept.averageScore) >= 3.2
                                ? 'text-slate-900 dark:text-white'
                                : Number(dept.averageScore) > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}>
                              {Number(dept.averageScore) > 0 ? safeNum(dept.averageScore, 2) : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {dept.trend === 'UP' ? (
                              <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                +{safeNum(scoreDelta, 2, '0.00')}
                              </span>
                            ) : dept.trend === 'DOWN' ? (
                              <span className="inline-flex items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                                {safeNum(scoreDelta, 2, '0.00')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {appraisalDueCount > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[22px] px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
                                {appraisalDueCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleInspectDepartment(dept)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Quarterly Performance Trends */}
        {activeTab === 'trends' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Organization multi-quarter performance</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Historical weighted rating averages and review completion metrics across quarters for {selectedYear}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                  <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                </select>
              </div>
            </div>

            {loadingTrends ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Aggregating historical quarter trends...
              </div>
            ) : (
              <>
                {/* 4 Quarter Score Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {trendsData?.quarters.map((q) => (
                    <div
                      key={q.quarter}
                      className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center"
                    >
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {q.label}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(q.averageScore) > 0 ? safeNum(q.averageScore, 2) : '—'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {q.completedReviewsCount} completed reviews ({q.completionRate}%)
                      </div>
                      <div className="mt-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          q.periodStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : q.periodStatus === 'CLOSED'
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {q.periodStatus || 'No Period'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Department Multi-Quarter Breakdown Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Department Quarterly Score Progression ({selectedYear})
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Department</th>
                          <th className="py-2.5 px-3 text-center">Q1 score</th>
                          <th className="py-2.5 px-3 text-center">Q2 score</th>
                          <th className="py-2.5 px-3 text-center">Q3 score</th>
                          <th className="py-2.5 px-3 text-center">Q4 score</th>
                          <th className="py-2.5 px-4 text-right">Overall weighted avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {trendsData?.departmentAverages && trendsData.departmentAverages.length > 0 ? (
                          trendsData.departmentAverages.map((dept) => (
                            <tr key={dept.departmentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-4 font-semibold">{dept.departmentName}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{Number(dept.q1) > 0 ? safeNum(dept.q1, 2) : '—'}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{Number(dept.q2) > 0 ? safeNum(dept.q2, 2) : '—'}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{Number(dept.q3) > 0 ? safeNum(dept.q3, 2) : '—'}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{Number(dept.q4) > 0 ? safeNum(dept.q4, 2) : '—'}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                {Number(dept.overallAvg) > 0 ? safeNum(dept.overallAvg, 2) : '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">
                              No trend records available for {selectedYear}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Talent Pools (High Performers & Needs Attention) */}
        {activeTab === 'talent' && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Sub Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTalentSubTab('high_performers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    talentSubTab === 'high_performers'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Top Achievers (Score ≥ {performerThreshold})
                </button>
                <button
                  onClick={() => setTalentSubTab('attention')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    talentSubTab === 'attention'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Attention required (low scores / overdue)
                </button>
              </div>

              {talentSubTab === 'high_performers' ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Threshold:</span>
                  <select
                    value={performerThreshold}
                    onChange={(e) => setPerformerThreshold(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
                  >
                    <option value={4.5}>Score ≥ 4.5</option>
                    <option value={4.0}>Score ≥ 4.0</option>
                    <option value={3.8}>Score ≥ 3.8</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Score flag threshold:</span>
                  <select
                    value={attentionThreshold}
                    onChange={(e) => setAttentionThreshold(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
                  >
                    <option value={3.0}>Score ≤ 3.0</option>
                    <option value={2.5}>Score ≤ 2.5</option>
                    <option value={2.0}>Score ≤ 2.0</option>
                  </select>
                </div>
              )}
            </div>

            {loadingTalent ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading talent records...
              </div>
            ) : talentSubTab === 'high_performers' ? (
              /* High Performers Table */
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Reporting manager</th>
                      <th className="py-2.5 px-3 text-center">Quarter score</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {highPerformers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No finalized reviews found with score ≥ {performerThreshold} for this period.
                        </td>
                      </tr>
                    ) : (
                      highPerformers.map((p) => (
                        <tr key={p.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{p.employeeName}</div>
                            <div className="text-[11px] text-slate-400">{p.employeeCode}</div>
                          </td>
                          <td className="py-2.5 px-3 font-medium">{p.departmentName}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{p.designation}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{p.managerName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              {safeNum(p.finalScore ?? (p as any).latestScore ?? (p as any).score, 2, '0.00')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {p.reviewStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDossier(p.employeeId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View dossier</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Attention Required Table */
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Manager</th>
                      <th className="py-2.5 px-3">Flag reason</th>
                      <th className="py-2.5 px-3 text-center">Urgency</th>
                      <th className="py-2.5 px-3 text-center">Score</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {attentionItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          Zero critical flags detected for this period.
                        </td>
                      </tr>
                    ) : (
                      attentionItems.map((a) => (
                        <tr key={a.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{a.employeeName}</div>
                            <div className="text-[11px] text-slate-400">{a.employeeCode}</div>
                          </td>
                          <td className="py-2.5 px-3 font-medium">{a.departmentName}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{a.managerName}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                              {a.reason}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              a.urgency === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            }`}>
                              {a.urgency}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {Number(a.score) > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">{safeNum(a.score, 2)}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDossier(a.employeeId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View dossier</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Appraisal & Budget Rollups */}
        {activeTab === 'appraisals' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Annual appraisal & compensation rollup</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  High-level calibration progress, increment averages, and estimated payroll impact for {selectedYear}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                </select>
              </div>
            </div>

            {loadingAppraisals ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading appraisal summaries...
              </div>
            ) : (
              <>
                {/* Appraisal Summary Metrics and Pie Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 grid grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Total eligible cohort</span>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                        {appraisalsData?.summary.totalEligible ?? 0}
                      </div>
                      <span className="text-[11px] text-purple-600 dark:text-purple-400">
                        {appraisalsData?.summary.totalInitiated ?? 0} initiated ({appraisalsData?.summary.completionRate ?? 0}%)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Locked / finalized</span>
                      <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                        {appraisalsData?.summary.totalLocked ?? 0}
                      </div>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Letters approved by HR</span>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Avg organization increment</span>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                        {appraisalsData?.summary.averageIncrementPercent ?? 0}%
                      </div>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400">Across approved calibrations</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Est. Annual payroll impact</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        ${(appraisalsData?.summary.totalPayrollImpact ?? 0).toLocaleString()}
                      </div>
                      <span className="text-[11px] text-slate-500">Calculated on locked increments</span>
                    </div>
                  </div>

                  <div>
                    <PieChart
                      title="Cohort Calibration Status"
                      subtitle="Annual increment approval lifecycle"
                      data={appraisalStatusData}
                      centerValue={appraisalsData?.summary.totalEligible ?? 0}
                      centerLabel="Eligible"
                      formatValue={(v) => v.toString()}
                    />
                  </div>
                </div>

                {/* Department Appraisal Rollup Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Department compensation & calibration summary
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Department</th>
                          <th className="py-2.5 px-3 text-center">Headcount</th>
                          <th className="py-2.5 px-3 text-center">Appraisals initiated</th>
                          <th className="py-2.5 px-3 text-center">Locked / approved</th>
                          <th className="py-2.5 px-3 text-center">Avg increment %</th>
                          <th className="py-2.5 px-4 text-right">Est. Payroll impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {appraisalsData?.departmentBreakdowns && appraisalsData.departmentBreakdowns.length > 0 ? (
                          appraisalsData.departmentBreakdowns.map((d) => (
                            <tr key={d.departmentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-4 font-semibold">{d.departmentName}</td>
                              <td className="py-2.5 px-3 text-center">{d.headcount}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{d.appraisalCount}</td>
                              <td className="py-2.5 px-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                                {d.lockedCount}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {Number(d.averageIncrementPercent) > 0 ? `${safeNum(d.averageIncrementPercent, 1)}%` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                                ${d.payrollImpact.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">
                              No appraisal cycles or records found for {selectedYear}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Read-Only Governance Notice */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    <strong>Governance rule:</strong> Management accounts have read-only analytics access to compensation summaries. Direct calibrations, recommendation modifications, and letter issuances are executed exclusively by HR and HOD review panels.
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 5: Workforce Risk & Alerts (Active PIPs, stale check-ins, outcomes, live escalations) */}
        {activeTab === 'workforceRisk' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Workforce risk & live alerts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active performance improvement plans, stale check-ins, plans past their end date, and this year's outcomes.
              </p>
            </div>

            {loadingWorkforceRisk ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading workforce risk snapshot...
              </div>
            ) : (
              <>
                {/* Live Alerts Banner */}
                {workforceRiskData?.alerts.reviewDeadlinePassed && workforceRiskData.alerts.overdueReviewsCount > 0 ? (
                  <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="text-rose-800 dark:text-rose-300">
                      <strong>{workforceRiskData.alerts.overdueReviewsCount} reviews</strong> remain unsubmitted past the {workforceRiskData.alerts.activePeriodName} deadline
                      {workforceRiskData.alerts.activePeriodDueDate ? ` (${new Date(workforceRiskData.alerts.activePeriodDueDate).toLocaleDateString()})` : ''}.
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center gap-3 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-800 dark:text-emerald-300">
                      No overdue reviews past the current deadline for {workforceRiskData?.alerts.activePeriodName || 'the active period'}.
                    </span>
                  </div>
                )}

                {/* PIP Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Active PIPs</span>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                      {workforceRiskData?.summary.activePipCount ?? 0}
                    </div>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      {workforceRiskData?.summary.extendedPipCount ?? 0} extended
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Stale check-ins</span>
                    <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
                      {workforceRiskData?.summary.overdueCheckInCount ?? 0}
                    </div>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400">No update in 7+ days</span>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Past end date</span>
                    <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
                      {workforceRiskData?.summary.pastEndDateNoOutcomeCount ?? 0}
                    </div>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400">No outcome recorded</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Succeeded ({selectedYear})</span>
                    <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                      {workforceRiskData?.summary.succeeded ?? 0}
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {workforceRiskData?.summary.failed ?? 0} failed · {workforceRiskData?.summary.extended ?? 0} extended
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Year</span>
                    <div className="mt-2">
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-200 font-semibold w-full"
                      >
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* At-Risk Employees Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Employees on active performance improvement plans
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Employee</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Manager / HOD</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">End date</th>
                          <th className="py-2.5 px-4 text-center">Check-in status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {!workforceRiskData || workforceRiskData.atRiskEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">
                              No employees are currently on an active performance improvement plan.
                            </td>
                          </tr>
                        ) : (
                          workforceRiskData.atRiskEmployees.map((p) => (
                            <tr key={p.pipId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">{p.employeeName}</div>
                                <div className="text-[11px] text-slate-400">{p.employeeCode}</div>
                              </td>
                              <td className="py-2.5 px-3 font-medium">{p.departmentName || '—'}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {p.managerName || p.hodName || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                  p.status === 'EXTENDED'
                                    ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {p.isPastEndDate ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                                    {new Date(p.endDate).toLocaleDateString()} (overdue)
                                  </span>
                                ) : (
                                  new Date(p.endDate).toLocaleDateString()
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {p.isOverdueCheckIn ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                                    {p.daysSinceLastCheckIn}d since last check-in
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {p.daysSinceLastCheckIn}d ago
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Outcomes */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Recent PIP Outcomes ({selectedYear})
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Employee</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3 text-center">Decision</th>
                          <th className="py-2.5 px-3">Decided by</th>
                          <th className="py-2.5 px-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {!workforceRiskData || workforceRiskData.recentOutcomes.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400">
                              No PIP outcomes recorded for {selectedYear}.
                            </td>
                          </tr>
                        ) : (
                          workforceRiskData.recentOutcomes.map((o) => (
                            <tr key={o.pipId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-4 font-semibold">{o.employeeName}</td>
                              <td className="py-2.5 px-3 font-medium">{o.departmentName || '—'}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                  o.decision === 'SUCCEEDED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : o.decision === 'FAILED'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                    : 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300'
                                }`}>
                                  {o.decision}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{o.decidedByName}</td>
                              <td className="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400">
                                {new Date(o.decidedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 5. Employee Performance Dossier Modal (360 Historical View) */}
      <EmployeeDossierModal
        isOpen={!!selectedEmployeeDossierId}
        onClose={() => {
          setSelectedEmployeeDossierId(null);
          setDossierData(null);
        }}
        dossierLoading={dossierLoading}
        dossierData={dossierData}
      />

      {/* 6. Department Team Inspection Modal */}
      <DepartmentInspectionModal
        inspectDepartment={inspectDepartment}
        onClose={() => setInspectDepartment(null)}
        loadingDeptReviews={loadingDeptReviews}
        inspectDeptReviews={inspectDeptReviews}
        onOpenDossier={(empId) => handleOpenDossier(empId)}
      />
    </div>
  );
};

interface EmployeeDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossierLoading: boolean;
  dossierData: ManagementEmployeeDossier | null;
}

const EmployeeDossierModal: React.FC<EmployeeDossierModalProps> = ({
  isOpen,
  onClose,
  dossierLoading,
  dossierData,
}) => {
  const cachedDossierRef = React.useRef(dossierData);
  if (dossierData) {
    cachedDossierRef.current = dossierData;
  }
  const data = dossierData || cachedDossierRef.current;

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen,
    onClose,
  });

  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-base">
              {data?.employee.name.charAt(0) || 'E'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {data?.employee.name || 'Employee Dossier'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums">
                  {data?.employee.employeeCode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {(data?.employee as any)?.designation || data?.employee?.designationName || 'Role'} • {data?.employee.departmentName}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {dossierLoading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading comprehensive employee performance record...
            </div>
          ) : data ? (
            <>
              {/* Executive Read-Only Notice */}
              <div className="p-3 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex items-center gap-2 text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Executive read-only mode: historical performance, KRA scores, and manager feedback are displayed for decision-support.</span>
              </div>

              {/* Profile Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400">Email:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.employee.email}</div>
                </div>
                <div>
                  <span className="text-slate-400">Reporting manager:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{(data.employee as any).reportingManagerName || data.employee.managerName || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{data.employee.status}</div>
                </div>
                <div>
                  <span className="text-slate-400">Joining date:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{(data.employee as any).dateOfJoining || data.employee.joiningDate || 'N/A'}</div>
                </div>
              </div>

              {/* Historical Quarterly Reviews */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Quarterly review history
                </h3>

                {data.historicalReviews.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    No quarterly reviews recorded yet for this employee.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.historicalReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {rev.periodName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-150 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {rev.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block">Overall score</span>
                              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                {Number(rev.finalScore) > 0 ? safeNum(rev.finalScore, 2) : '—'} / 5.00
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown of KRA Scores */}
                        {rev.kras && rev.kras.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                            {rev.kras.map((ks: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                              >
                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                  {ks.kraTitle || ks.title || 'KRA'}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white shrink-0">
                                  {ks.score || ks.rating || '—'} / 5
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Manager Feedback */}
                        {rev.managerFeedback && (
                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 italic">
                            &quot;{rev.managerFeedback}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Annual Appraisal Decisions */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Annual appraisal history
                </h3>

                {data.appraisalHistory.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    No historical appraisal events recorded.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Year</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-center">Proposed %</th>
                          <th className="py-2 px-3 text-center">Approved %</th>
                          <th className="py-2 px-3 text-center">Final rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.appraisalHistory.map((app) => (
                          <tr key={app.id}>
                            <td className="py-2 px-3 font-semibold">{app.appraisalYear}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800">
                                {app.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">{app.proposedIncrementPercentage || 0}%</td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {app.approvedIncrementPercentage || 0}%
                            </td>
                            <td className="py-2 px-3 text-center font-bold">{app.finalRating || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Close dossier
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface DepartmentInspectionModalProps {
  inspectDepartment: ManagementDepartmentPerformanceItem | null;
  onClose: () => void;
  loadingDeptReviews: boolean;
  inspectDeptReviews: any[];
  onOpenDossier: (empId: string) => void;
}

const DepartmentInspectionModal: React.FC<DepartmentInspectionModalProps> = ({
  inspectDepartment,
  onClose,
  loadingDeptReviews,
  inspectDeptReviews,
  onOpenDossier,
}) => {
  const cachedDeptRef = React.useRef(inspectDepartment);
  if (inspectDepartment) {
    cachedDeptRef.current = inspectDepartment;
  }
  const dept = inspectDepartment || cachedDeptRef.current;

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen: !!inspectDepartment,
    onClose,
  });

  if (!isMounted || !dept) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              {dept.departmentName} — Team Performance Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Headcount: {dept.headcount} • Avg Rating: {Number(dept.averageScore) > 0 ? safeNum(dept.averageScore, 2) : 'N/A'} • Completion: {dept.completionRate}%
            </p>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {loadingDeptReviews ? (
            <div className="py-8 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading department employee reviews...
            </div>
          ) : inspectDeptReviews.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No review records found for this department in the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Manager</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inspectDeptReviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {rev.employeeName || 'Employee'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {rev.managerName || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {rev.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(rev.finalScore) > 0 ? safeNum(rev.finalScore, 2) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            onOpenDossier(rev.employeeId);
                          }}
                          className="px-2 py-1 rounded text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
