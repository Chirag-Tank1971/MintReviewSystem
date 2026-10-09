import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
  Users,
  Building2,
  Shield,
  Sliders,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { Department, Cycle, ReviewPeriod } from '../types';
import { api } from '../services/api';
import { ReportVisualSection } from './reports/ReportVisualSection';
import { ReturnAnalyticsReport } from './reports/ReturnAnalyticsReport';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

export interface ReportsViewConfig {
  reportType?: ReportType;
  departmentId?: string;
  cycleId?: string;
}

interface ReportsCenterViewProps {
  departments: Department[];
  cycles: Cycle[];
  initialConfig?: ReportsViewConfig | null;
}

type ReportType =
  | 'quarterly-status'
  | 'pending-overdue'
  | 'employee-history'
  | 'department-performance'
  | 'manager-completion'
  | 'appraisal-due'
  | 'rating-trend'
  | 'kra-performance'
  | 'return-analytics'
  | 'audit-trail';

type CategoryGroupId = 'ALL' | 'REVIEWS' | 'PERFORMANCE' | 'APPRAISALS' | 'ANALYTICS';

const reportNavItems: Array<{
  id: ReportType;
  label: string;
  categoryGroup: 'REVIEWS' | 'PERFORMANCE' | 'APPRAISALS' | 'ANALYTICS';
  category: string;
  icon: any;
}> = [
  { id: 'quarterly-status', label: 'Review Status', categoryGroup: 'REVIEWS', category: 'Reviews', icon: CheckCircle2 },
  { id: 'pending-overdue', label: 'Pending & Overdue', categoryGroup: 'REVIEWS', category: 'Reviews', icon: Clock },
  { id: 'manager-completion', label: 'Manager Completion', categoryGroup: 'REVIEWS', category: 'Operations', icon: UserCheck },
  { id: 'employee-history', label: 'Employee History', categoryGroup: 'PERFORMANCE', category: 'Performance', icon: Users },
  { id: 'department-performance', label: 'Department Performance', categoryGroup: 'PERFORMANCE', category: 'Performance', icon: Building2 },
  { id: 'appraisal-due', label: 'Appraisal Due', categoryGroup: 'APPRAISALS', category: 'Appraisals', icon: Award },
  { id: 'rating-trend', label: 'Rating Trends', categoryGroup: 'ANALYTICS', category: 'Analytics', icon: TrendingUp },
  { id: 'kra-performance', label: 'KRA Competencies', categoryGroup: 'ANALYTICS', category: 'Analytics', icon: Sliders },
  { id: 'return-analytics', label: 'Review Returns', categoryGroup: 'REVIEWS', category: 'Reviews', icon: RotateCcw },
  { id: 'audit-trail', label: 'Audit Trail', categoryGroup: 'ANALYTICS', category: 'Compliance', icon: Shield },
];

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({ departments, cycles, initialConfig }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('quarterly-status');
  const [, setSelectedCategory] =useState<CategoryGroupId>('ALL');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedAuditModule, setSelectedAuditModule] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);

  useEffect(() => {
    if (activeReport !== 'return-analytics' || periods.length > 0) return;
    api.getReviewPeriods().then(setPeriods).catch(() => undefined);
  }, [activeReport, periods.length]);

  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.reportType) {
        setActiveReport(initialConfig.reportType);
        const item = reportNavItems.find((r) => r.id === initialConfig.reportType);
        if (item) setSelectedCategory(item.categoryGroup);
      }
      if (initialConfig.departmentId) setSelectedDept(initialConfig.departmentId);
      if (initialConfig.cycleId) setSelectedCycle(initialConfig.cycleId);
    }
  }, [initialConfig]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeReport === 'quarterly-status') {
        const res = await api.getQuarterlyStatusReport({
          departmentId: selectedDept,
          cycleId: selectedCycle,
          status: selectedStatus,
        });
        setData(res);
      } else if (activeReport === 'pending-overdue') {
        const res = await api.getPendingOverdueReport({
          departmentId: selectedDept,
          cycleId: selectedCycle,
        });
        setData(res);
      } else if (activeReport === 'employee-history') {
        const res = await api.getEmployeeHistoryReport({
          departmentId: selectedDept,
          cycleId: selectedCycle,
          search: searchQuery,
        });
        setData(res);
      } else if (activeReport === 'department-performance') {
        const res = await api.getDepartmentPerformanceReport();
        setData(res);
      } else if (activeReport === 'manager-completion') {
        const res = await api.getManagerCompletionReport();
        setData(res);
      } else if (activeReport === 'appraisal-due') {
        const res = await api.getAppraisalDueReport({
          cycleId: selectedCycle,
          year: selectedYear,
        });
        setData(res);
      } else if (activeReport === 'rating-trend') {
        const res = await api.getRatingTrendReport();
        setData(res);
      } else if (activeReport === 'kra-performance') {
        const res = await api.getKraPerformanceReport();
        setData(res);
      } else if (activeReport === 'return-analytics') {
        const res = await api.getReturnAnalyticsReport({ periodId: selectedPeriod });
        setData(res);
      } else if (activeReport === 'audit-trail') {
        const res = await api.getAuditTrailReport({
          module: selectedAuditModule,
          limit: 150,
        });
        setData(res);
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeReport, selectedDept, selectedCycle, selectedStatus, selectedYear, selectedAuditModule, selectedPeriod]);

  // Export to CSV generator
  const exportToCsv = () => {
    if (!data) return;
    let headers: string[] = [];
    let rows: any[] = [];
    const filename = `${activeReport}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeReport === 'quarterly-status' && data.reportData) {
      headers = ['Employee Code', 'Employee Name', 'Department', 'Designation', 'Manager', 'Cycle', 'Period', 'Status', 'Final Score', 'Overdue'];
      rows = data.reportData.map((r: any) => [
        r.employeeCode,
        r.employeeName,
        r.departmentName,
        r.designationName,
        r.managerName,
        r.cycleCode,
        r.periodName,
        r.status,
        r.finalScore,
        r.isOverdue ? 'YES' : 'NO',
      ]);
    } else if (activeReport === 'pending-overdue' && data.reportData) {
      headers = ['Employee Code', 'Employee Name', 'Department', 'Manager', 'Pending With', 'Days Aging', 'Status', 'Due Date'];
      rows = data.reportData.map((r: any) => [
        r.employeeCode,
        r.employeeName,
        r.departmentName,
        r.managerName,
        r.pendingWith,
        r.daysAging,
        r.status,
        r.dueDate,
      ]);
    } else if (activeReport === 'employee-history' && data.reportData) {
      headers = ['Employee Code', 'Employee Name', 'Department', 'Designation', 'Cycle', 'Q1 Score', 'Q2 Score', 'Q3 Score', 'Q4 Score', 'Avg Score', 'Band', 'Appraisal Status'];
      rows = data.reportData.map((r: any) => [
        r.employeeCode,
        r.employeeName,
        r.departmentName,
        r.designationName,
        r.cycleCode,
        r.q1Score ?? '-',
        r.q2Score ?? '-',
        r.q3Score ?? '-',
        r.q4Score ?? '-',
        r.averageQuarterlyScore,
        r.performanceBand,
        r.latestAppraisalStatus,
      ]);
    } else if (activeReport === 'department-performance' && data.reportData) {
      headers = ['Department Name', 'Headcount', 'Total Reviews', 'Completed', 'Completion %', 'Avg Score', 'Outstanding (4.5+)', 'Exceeds (3.8-4.49)', 'Meets (2.8-3.79)', 'Needs Imp (<2.8)'];
      rows = data.reportData.map((r: any) => [
        r.departmentName,
        r.headcount,
        r.totalReviews,
        r.completedReviews,
        `${r.completionRate}%`,
        r.averageScore,
        r.outstandingCount,
        r.exceedsCount,
        r.meetsCount,
        r.needsImpCount,
      ]);
    } else if (activeReport === 'manager-completion' && data.reportData) {
      headers = ['Manager Name', 'Department', 'Total Assigned', 'Submitted', 'Closed', 'Returned', 'Overdue', 'Completion Rate', 'Avg Score Awarded'];
      rows = data.reportData.map((r: any) => [
        r.managerName,
        r.departmentName,
        r.totalAssigned,
        r.submittedCount,
        r.closedCount,
        r.returnedCount,
        r.overdueCount,
        `${r.completionRate}%`,
        r.avgScoreAwarded,
      ]);
    } else if (activeReport === 'appraisal-due' && data.reportData) {
      headers = ['Employee Code', 'Employee Name', 'Department', 'Designation', 'Cycle', 'Appraisal Month', 'Current CTC', '4-Qtr Avg Score', 'Proposed Increment', 'Approved Increment', 'Revised CTC', 'Status'];
      rows = data.reportData.map((r: any) => [
        r.employeeCode,
        r.employeeName,
        r.departmentName,
        r.designationName,
        r.cycleCode,
        r.appraisalMonthName,
        r.currentCtc,
        r.averageQuarterlyScore,
        `${r.proposedIncrement}%`,
        r.approvedIncrement ? `${r.approvedIncrement}%` : '-',
        r.revisedCtc,
        r.appraisalStatus,
      ]);
    } else if (activeReport === 'kra-performance' && data.reportData) {
      headers = ['KRA Name', 'Occurrences', 'Avg Weight %', 'Avg Score Rating', 'Ratings Count', 'Mastery Level'];
      rows = data.reportData.map((r: any) => [
        r.kraName,
        r.occurrencesCount,
        `${r.averageWeightPercent}%`,
        r.averageRating,
        r.ratingCount,
        r.masteryLevel,
      ]);
    } else if (activeReport === 'return-analytics' && data.reportData) {
      headers = ['Recipient', 'Role', 'Returns Received', 'Reviews Returned', 'Reviews Handled', 'Return Rate %', 'Avg KRAs / Return', 'Avg Resolution (h)', 'Open', 'Overdue'];
      rows = data.reportData.map((r: any) => [
        r.recipientName,
        r.role,
        r.returnsReceived,
        r.reviewsReturned,
        r.reviewsHandled,
        r.returnRatePercent,
        r.avgKrasPerReturn,
        r.avgResolutionHours ?? '-',
        r.open,
        r.overdue,
      ]);
      (data.byKra || []).forEach((k: any, i: number) => {
        if (i === 0) rows.push([], ['KRA', 'Times Returned', 'Return Rate %', 'Reviews With KRA', 'Rating Changed %']);
        rows.push([k.kraName, k.timesReturned, k.returnRatePercent, k.reviewsWithKra, k.ratingChangedPercent]);
      });
      (data.byReason || []).forEach((r: any, i: number) => {
        if (i === 0) rows.push([], ['Reason', 'Count']);
        rows.push([r.label, r.count]);
      });
    } else if (activeReport === 'audit-trail' && data.logs) {
      headers = ['Timestamp', 'Module', 'Action', 'Record ID', 'Old Value', 'New Value', 'Performer User ID'];
      rows = data.logs.map((l: any) => [
        l.createdAt,
        l.module,
        l.action,
        l.recordId,
        typeof l.oldValue === 'object' ? JSON.stringify(l.oldValue) : String(l.oldValue || '-'),
        typeof l.newValue === 'object' ? JSON.stringify(l.newValue) : String(l.newValue || '-'),
        l.userId || 'SYSTEM',
      ]);
    }

    if (headers.length === 0) return;

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const recordCount =
    data?.reportData?.length ??
    data?.logs?.length ??
    data?.trends?.length ??
    0;
  const recordCountText = `${recordCount} ${recordCount === 1 ? 'record' : 'records'}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Review progress, appraisal outcomes and audit history, ready to export."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} iconSpin={loading} onClick={fetchReportData} disabled={loading} title="Refresh" aria-label="Refresh report" />
            <Button variant="primary" icon={Download} onClick={exportToCsv} disabled={loading || !data}>
              Export CSV
            </Button>
          </>
        }
      />

      {/* Report Selection & Dynamic Filters Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Report Dropdown Selector */}
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 shrink-0">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Report:</span>
          </div>
          <select
            value={activeReport}
            onChange={(e) => setActiveReport(e.target.value as ReportType)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs min-w-[220px]"
          >
            <optgroup label="Reviews & Operations">
              <option value="quarterly-status">Quarterly review status</option>
              <option value="pending-overdue">Pending & overdue reviews</option>
              <option value="manager-completion">Manager completion rates</option>
              <option value="return-analytics">Review returns analytics</option>
            </optgroup>
            <optgroup label="Performance">
              <option value="employee-history">Employee historical performance</option>
              <option value="department-performance">Department performance rankings</option>
            </optgroup>
            <optgroup label="Appraisals">
              <option value="appraisal-due">Appraisal due cohort</option>
            </optgroup>
            <optgroup label="Analytics & Governance">
              <option value="rating-trend">Organization rating trends</option>
              <option value="kra-performance">KRA competencies performance</option>
              <option value="audit-trail">Compliance & audit trail</option>
            </optgroup>
          </select>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400 mr-1">
            <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Filters:</span>
          </div>

          {/* Period Filter (Return analytics) */}
          {activeReport === 'return-analytics' && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All periods</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Department Filter (Applicable to most) */}
          {['quarterly-status', 'pending-overdue', 'employee-history'].includes(activeReport) && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Cycle Filter */}
          {['quarterly-status', 'pending-overdue', 'employee-history', 'appraisal-due'].includes(activeReport) && (
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All cycles</option>
              {cycles.filter((c) => c.active !== false).map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          {activeReport === 'quarterly-status' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All review statuses</option>
              <option value="ASSIGNED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">ASSIGNED</option>
              <option value="MANAGER_PENDING" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">MANAGER_PENDING</option>
              <option value="HR_PENDING" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">HR_PENDING</option>
              <option value="RETURNED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">RETURNED</option>
              <option value="CLOSED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">CLOSED</option>
            </select>
          )}

          {/* Audit Module Filter */}
          {activeReport === 'audit-trail' && (
            <select
              value={selectedAuditModule}
              onChange={(e) => setSelectedAuditModule(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All system modules</option>
              <option value="REVIEWS" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">REVIEWS</option>
              <option value="APPRAISALS" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">APPRAISALS</option>
              <option value="KRAS" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">KRAS</option>
              <option value="EMPLOYEES" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">EMPLOYEES</option>
              <option value="CYCLES" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">CYCLES</option>
            </select>
          )}

          {/* Year Filter */}
          {activeReport === 'appraisal-due' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value={2026} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">FY 2026</option>
              <option value={2025} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">FY 2025</option>
            </select>
          )}

          {/* Search for employee history */}
          {activeReport === 'employee-history' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search employee code/name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
              />
            </div>
          )}
        </div>

        {/* Record Count Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            {recordCountText}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <PageSkeletonLoader variant="table" rowCount={6} />
      ) : !data ? (
        <div className="py-20 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          No report records found for selected criteria.
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. QUARTERLY STATUS REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'quarterly-status' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department & role</th>
                          <th className="px-4 py-3">Manager</th>
                          <th className="px-4 py-3">Cycle</th>
                          <th className="px-4 py-3">Review period</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Final score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.id || row.reviewId || row.employeeId || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              <div>{row.employeeName}</div>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{row.employeeCode}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              <div>{row.departmentName}</div>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">{row.designationName}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{row.managerName}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums font-bold rounded">
                                {row.cycleName || `Cycle ${row.cycleCode}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.periodName}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  row.status === 'CLOSED'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : row.status === 'RETURNED'
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : row.status === 'HR_PENDING'
                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                              {row.finalScore > 0 ? (
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded font-semibold border border-indigo-200 dark:border-indigo-800">
                                  {Number(row.finalScore).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. PENDING & OVERDUE REVIEWS REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'pending-overdue' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Manager / assignee</th>
                          <th className="px-4 py-3">Bottleneck / pending with</th>
                          <th className="px-4 py-3">Days aging</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Due date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.id || row.reviewId || row.employeeId || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              <div>{row.employeeName}</div>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{row.employeeCode}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.departmentName}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.managerName}</td>
                            <td className="px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-400">{row.pendingWith}</td>
                            <td className="px-4 py-3 tabular-nums font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  row.daysAging > 30
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {row.daysAging} Days
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">{row.dueDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. EMPLOYEE PERFORMANCE HISTORY REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'employee-history' && data.reportData && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department & role</th>
                      <th className="px-4 py-3">Cycle</th>
                      <th className="px-3 py-3 text-center">Q1</th>
                      <th className="px-3 py-3 text-center">Q2</th>
                      <th className="px-3 py-3 text-center">Q3</th>
                      <th className="px-3 py-3 text-center">Q4</th>
                      <th className="px-4 py-3 text-center">4-Qtr Average</th>
                      <th className="px-4 py-3">Performance band</th>
                      <th className="px-4 py-3">Appraisal status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.reportData.map((row: any, idx: number) => (
                      <tr key={row.employeeId || row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <div>{row.employeeName}</div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{row.employeeCode}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <div>{row.departmentName}</div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{row.designationName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums font-bold rounded">
                            {row.cycleName || `Cycle ${row.cycleCode}`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.q1Score ? row.q1Score.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.q2Score ? row.q2Score.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.q3Score ? row.q3Score.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.q4Score ? row.q4Score.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-bold text-slate-900 dark:text-white">
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded font-semibold border border-indigo-200 dark:border-indigo-800">
                            {(row.averageQuarterlyScore ?? 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.performanceBand === 'OUTSTANDING'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : row.performanceBand === 'EXCEEDS'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : row.performanceBand === 'MEETS'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {row.performanceBand}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                          {row.latestAppraisalStatus}
                          {row.approvedIncrement && (
                            <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">
                              (+{row.approvedIncrement}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. DEPARTMENT PERFORMANCE REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'department-performance' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Headcount</th>
                          <th className="px-4 py-3">Reviews</th>
                          <th className="px-4 py-3">Completion %</th>
                          <th className="px-4 py-3">Average score</th>
                          <th className="px-4 py-3">Outstanding (4.5+)</th>
                          <th className="px-4 py-3">Exceeds (3.8-4.49)</th>
                          <th className="px-4 py-3">Meets (2.8-3.79)</th>
                          <th className="px-4 py-3">Needs imp (&lt;2.8)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.departmentId || row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.departmentName}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.headcount} emp</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.totalReviews}</td>
                            <td className="px-4 py-3 tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{row.completionRate}%</td>
                            <td className="px-4 py-3 tabular-nums font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                              {(row.averageScore ?? 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">{row.outstandingCount}</td>
                            <td className="px-4 py-3 tabular-nums text-blue-600 dark:text-blue-400 font-bold">{row.exceedsCount}</td>
                            <td className="px-4 py-3 tabular-nums text-indigo-600 dark:text-indigo-400 font-bold">{row.meetsCount}</td>
                            <td className="px-4 py-3 tabular-nums text-amber-600 dark:text-amber-400 font-bold">{row.needsImpCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. MANAGER-WISE COMPLETION REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'manager-completion' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Manager</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Total assigned</th>
                          <th className="px-4 py-3">Submitted</th>
                          <th className="px-4 py-3">Closed</th>
                          <th className="px-4 py-3">Returned</th>
                          <th className="px-4 py-3">Overdue</th>
                          <th className="px-4 py-3">Completion rate</th>
                          <th className="px-4 py-3 text-right">Avg score awarded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.managerId || row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.managerName}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.departmentName}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.totalAssigned}</td>
                            <td className="px-4 py-3 tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">{row.submittedCount}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.closedCount}</td>
                            <td className="px-4 py-3 tabular-nums text-rose-600 dark:text-rose-400 font-bold">{row.returnedCount}</td>
                            <td className="px-4 py-3 tabular-nums text-amber-600 dark:text-amber-400 font-bold">{row.overdueCount}</td>
                            <td className="px-4 py-3 tabular-nums font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  row.completionRate >= 80
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {row.completionRate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-indigo-700 dark:text-indigo-400">
                              {(row.avgScoreAwarded ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. APPRAISAL DUE REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'appraisal-due' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department & role</th>
                          <th className="px-4 py-3">Cycle schedule</th>
                          <th className="px-4 py-3">Current CTC</th>
                          <th className="px-4 py-3">4-Qtr Average</th>
                          <th className="px-4 py-3">Proposed increment</th>
                          <th className="px-4 py-3">Approved / revised CTC</th>
                          <th className="px-4 py-3">Appraisal status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.employeeId || row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              <div>{row.employeeName}</div>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{row.employeeCode}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              <div>{row.departmentName}</div>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">{row.designationName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 dark:text-white">{row.cycleName || `Cycle ${row.cycleCode}`}</div>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Month: {row.appraisalMonthName}</span>
                            </td>
                            <td className="px-4 py-3 tabular-nums font-bold text-slate-700 dark:text-slate-300">
                              ₹{(((row.currentCtc ?? 0) / 100000)).toFixed(2)}L
                            </td>
                            <td className="px-4 py-3 tabular-nums font-bold text-indigo-700 dark:text-indigo-400">
                              {(row.averageQuarterlyScore ?? 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 tabular-nums font-bold text-amber-700 dark:text-amber-400">+{row.proposedIncrement ?? 0}%</td>
                            <td className="px-4 py-3 tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                              ₹{(((row.revisedCtc ?? 0) / 100000)).toFixed(2)}L
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  row.isLocked
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {row.appraisalStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. QUARTERLY RATING TRENDS REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'rating-trend' && data.trends && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {data.trends.map((t: any, idx: number) => (
                    <div key={t.quarter || idx} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.quarter}</h4>
                        <span className="text-xs tabular-nums font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                          {(t.averageScore ?? 0).toFixed(2)} / 5.0
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{t.totalReviews} Total Reviews Conducted</div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Outstanding (4.5+)</span>
                          <strong className="tabular-nums text-slate-900 dark:text-white">{t.distribution.outstanding}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-700 dark:text-blue-400 font-semibold">Exceeds (3.8-4.49)</span>
                          <strong className="tabular-nums text-slate-900 dark:text-white">{t.distribution.exceeds}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-700 dark:text-indigo-400 font-semibold">Meets (2.8-3.79)</span>
                          <strong className="tabular-nums text-slate-900 dark:text-white">{t.distribution.meets}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">Needs improvement (&lt;2.8)</span>
                          <strong className="tabular-nums text-slate-900 dark:text-white">{t.distribution.needsImp}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. KRA-WISE PERFORMANCE REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'kra-performance' && data.reportData && (
            <div className="space-y-4">
              <ReportVisualSection activeReport={activeReport} data={data} departments={departments} cycles={cycles} />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                        <tr>
                          <th className="px-4 py-3">KRA competency title</th>
                          <th className="px-4 py-3">Occurrences in reviews</th>
                          <th className="px-4 py-3">Avg weight %</th>
                          <th className="px-4 py-3">Avg rating awarded</th>
                          <th className="px-4 py-3">Mastery classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.reportData.map((row: any, idx: number) => (
                          <tr key={row.kraName || row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.kraName}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.occurrencesCount} times</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300 font-medium">{row.averageWeightPercent}%</td>
                            <td className="px-4 py-3 tabular-nums font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                              {(row.averageRating ?? 0).toFixed(2)} / 5.0
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  row.masteryLevel === 'HIGH_PROFICIENCY'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : row.masteryLevel === 'COMPETENT'
                                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {row.masteryLevel.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8b. REVIEW RETURN ANALYTICS */}
          {/* ========================================================================= */}
          {activeReport === 'return-analytics' && data.summary && <ReturnAnalyticsReport data={data} />}

          {/* ========================================================================= */}
          {/* 9. SYSTEM COMPLIANCE AUDIT LOG EXPLORER */}
          {/* ========================================================================= */}
          {activeReport === 'audit-trail' && data.logs && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Record ID</th>
                      <th className="px-4 py-3">Value transition / remarks</th>
                      <th className="px-4 py-3">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums text-[11px]">
                    {data.logs.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-bold">
                            {log.module}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-400">{log.action}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.recordId}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-sans max-w-sm truncate">
                          {log.oldValue || log.newValue ? (
                            <span>
                              {String(log.oldValue || '-')} <span className="text-slate-400 tabular-nums">→</span>{' '}
                              <strong className="text-slate-900 dark:text-white">{String(log.newValue || '-')}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">{log.action} executed successfully</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.userId || 'SYSTEM'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
