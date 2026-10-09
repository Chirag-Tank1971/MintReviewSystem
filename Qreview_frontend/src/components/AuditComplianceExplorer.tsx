import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  FileCheck,
  Search,
  User,
  RefreshCw,
  Scale,
  DollarSign,
  Fingerprint,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Check,
  Minus,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  AuditLogEntry,
  AuditTimelineEvent,
  AuditSummaryMetrics,
  AuditModule,
  AuditSeverity,
  User as UserType,
  Employee,
} from '../types';
import { api } from '../services/api';
import {
  exportAuditLogsToExcel,
  exportAuditLogsToCsv,
} from '../utils/auditExport';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

interface AuditComplianceExplorerProps {
  currentUser?: UserType | null;
  onNavigateToEmployee?: (employeeId: string) => void;
}

export const AuditComplianceExplorer: React.FC<AuditComplianceExplorerProps> = ({
  currentUser,
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isHr = currentUser?.role === 'HR';

  // Tabs: HR only gets 'timeline'; Admin gets 'timeline' and 'logs'
  const [activeTab, setActiveTab] = useState<'timeline' | 'logs'>('timeline');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [metrics, setMetrics] = useState<AuditSummaryMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [timelineData, setTimelineData] = useState<{ employee: any; timeline: AuditTimelineEvent[] } | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Employees matching the lifecycle-trail search. The currently selected employee is always
  // kept in the list so the dropdown never shows a value that isn't among its options.
  const matchingEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name || (e as any).fullName, e.employeeCode, e.departmentName, e.designationName, e.cycleName || e.cycleCode]
        .some((field) => typeof field === 'string' && field.toLowerCase().includes(q))
    );
  }, [employees, employeeSearch]);
  const filteredEmployees = useMemo(() => {
    const selected = employees.find((e) => e.id === selectedEmployeeId);
    return selected && !matchingEmployees.includes(selected) ? [selected, ...matchingEmployees] : matchingEmployees;
  }, [employees, matchingEmployees, selectedEmployeeId]);

  // Filtering states for Master Audit Log (Admin only)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<AuditModule | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | 'ALL'>('ALL');
  const [isFlaggedOnly, setIsFlaggedOnly] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Load core data
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const promises: Promise<any>[] = [
        api.getAuditSummary(),
        api.getEmployees(),
      ];

      // Only load full audit logs if user is Super Admin
      if (isSuperAdmin) {
        promises.push(api.getAuditLogs());
      }

      const results = await Promise.all(promises);
      const summaryRes = results[0];
      const empRes = results[1];
      const logsRes = isSuperAdmin ? results[2] : null;

      if (summaryRes?.success) setMetrics(summaryRes.metrics);
      if (logsRes?.success) setAuditLogs(logsRes.logs);
      if (Array.isArray(empRes) && empRes.length > 0) {
        setEmployees(empRes);
        setSelectedEmployeeId((prev) => (prev && empRes.some((e) => e.id === prev) ? prev : empRes[0].id));
      }
    } catch (err) {
      console.error('Failed to load audit and lifecycle data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.role]);

  // Load employee timeline dynamically whenever selected employee changes
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const fetchTimeline = async () => {
      setIsTimelineLoading(true);
      try {
        const res = await api.getEmployeeAuditTimeline(selectedEmployeeId);
        if (res.success) {
          setTimelineData({ employee: res.employee, timeline: res.timeline });
        }
      } catch (err) {
        console.error('Failed to load employee timeline:', err);
      } finally {
        setIsTimelineLoading(false);
      }
    };
    fetchTimeline();
  }, [selectedEmployeeId]);

  // Handle Log Filters (Super Admin only)
  const handleApplyLogFilters = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs({
        searchTerm,
        module: selectedModule,
        severity: selectedSeverity,
        isFlaggedOnly,
      });
      if (res.success) setAuditLogs(res.logs);
    } catch (err) {
      console.error('Failed to apply filters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Export Audit Data (Excel or CSV)
  const handleExportData = async (format: 'csv' | 'xlsx') => {
    try {
      if (format === 'xlsx') {
        if (auditLogs && auditLogs.length > 0) {
          exportAuditLogsToExcel(auditLogs);
          return;
        }
      } else if (format === 'csv') {
        if (auditLogs && auditLogs.length > 0) {
          exportAuditLogsToCsv(auditLogs);
          return;
        }
      }

      const exportRes = await api.exportAuditReport({ module: selectedModule, format });
      if (exportRes && exportRes.rows) {
        if (format === 'xlsx') {
          exportAuditLogsToExcel(exportRes.rows);
        } else {
          exportAuditLogsToCsv(exportRes.rows);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isLoading && !metrics && auditLogs.length === 0) {
    return <PageSkeletonLoader variant="table" rowCount={6} />;
  }

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title={isHr ? 'Appraisal history' : 'Audit trail'}
        description={
          isHr
            ? "How each employee's reviews, scores, approvals and letter acknowledgements changed over time."
            : 'A permanent record of review and appraisal events, system changes and letter receipts.'
        }
        actions={
          <>
            <Button icon={RefreshCw} iconSpin={isRefreshing} onClick={loadData} disabled={isRefreshing}>
              Refresh
            </Button>
            {isSuperAdmin && (
              <Button icon={FileSpreadsheet} onClick={() => handleExportData('xlsx')}>
                Export to Excel
              </Button>
            )}
          </>
        }
      />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        {/* Clean Operational Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>{isHr ? 'Employees monitored' : 'Audit events'}</span>
              <History className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {isHr ? employees.length : metrics?.totalLogs || auditLogs.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isHr ? 'Active employees' : 'Recorded actions'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>Signed letters</span>
              <FileCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {metrics?.letterAcknowledgementsCount || 0}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Acknowledged by employees
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>Lifecycle stages</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {timelineData?.timeline?.length ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Checkpoints in the cycle
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs (Super Admin gets 2 tabs: Timeline & Master Audit; HR gets Timeline view) */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Appraisal lifecycle timeline</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded text-[11px]">
              Decision trail
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <span>Master audit event stream</span>
            <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px]">
              {auditLogs.length}
            </span>
          </button>
        </div>
      )}

      {/* ==========================================
          TAB 1: APPRAISAL LIFECYCLE TIMELINE (HR & Super Admin)
          ========================================== */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Employee Selector Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <label htmlFor="select-audit-employee" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Select employee for lifecycle trail</span>
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative w-full sm:w-60 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter jumps straight to the first match
                    if (e.key === 'Enter' && matchingEmployees.length > 0) {
                      setSelectedEmployeeId(matchingEmployees[0].id);
                    }
                  }}
                  placeholder="Search name, code, department..."
                  aria-label="Search employees for lifecycle trail"
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <select
                id="select-audit-employee"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="h-8 w-full sm:flex-1 sm:max-w-md min-w-0 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer truncate"
              >
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {emp.name || (emp as any).fullName} ({emp.employeeCode}) - {emp.departmentName} [{emp.cycleName || emp.cycleCode || 'Cycle'}]
                  </option>
                ))}
              </select>
              {employeeSearch.trim() && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {matchingEmployees.length === 0 ? 'No matches' : `${matchingEmployees.length} of ${employees.length} match`}
                </span>
              )}
              </div>
            </div>

            {timelineData?.employee && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0 lg:h-8">
                <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{timelineData.employee.designation}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                  {timelineData.employee.department}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded font-semibold border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                  {timelineData.employee.cycle}
                </span>
              </div>
            )}
          </div>

          {/* Chronological Step Journey */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chronological appraisal evolution & decision trail
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live, dynamic appraisal stages for {timelineData?.employee?.name || 'Selected Employee'} ({timelineData?.employee?.code || selectedEmployeeId}).
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live audit data</span>
              </span>
            </div>

            {isTimelineLoading ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <span>Loading dynamic lifecycle events...</span>
              </div>
            ) : timelineData?.timeline && timelineData.timeline.length > 0 ? (
              <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {timelineData.timeline.map((event) => {
                  const isOverridden = event.status === 'OVERRIDDEN';
                  const isPending = event.status === 'PENDING';
                  const isFlagged = event.status === 'FLAGGED';
                  const isNotApplicable = event.status === 'NOT_APPLICABLE';

                  return (
                    <div key={event.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white dark:bg-slate-900 ${
                          isOverridden
                            ? 'border-amber-500 text-amber-600 dark:text-amber-400 ring-4 ring-amber-50 dark:ring-amber-950/40'
                            : isFlagged
                            ? 'border-rose-500 text-rose-600 dark:text-rose-400 ring-4 ring-rose-50 dark:ring-rose-950/40'
                            : isNotApplicable
                            ? 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/80'
                            : isPending
                            ? 'border-slate-300 dark:border-slate-700 text-slate-400'
                            : 'border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-50 dark:ring-emerald-950/40'
                        }`}
                      >
                        {isOverridden ? (
                          <Scale className="w-3 h-3" />
                        ) : isNotApplicable ? (
                          <Minus className="w-3 h-3 stroke-[2.5]" />
                        ) : isPending ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>

                      {/* Content Card */}
                      <div
                        className={`rounded-xl border p-4 transition-all ${
                          isOverridden
                            ? 'bg-amber-50/40 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/50'
                            : isNotApplicable
                            ? 'bg-slate-50/40 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                            : isPending
                            ? 'bg-slate-50/60 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                            : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{event.stageName}</span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isOverridden
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : isNotApplicable
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  : isPending
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              }`}
                            >
                              {event.status === 'NOT_APPLICABLE' ? 'NOT APPLICABLE' : event.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <strong className="text-slate-700 dark:text-slate-200">{event.actorName}</strong> ({event.actorRole})
                            </span>
                            <span>•</span>
                            <span>
                              {event.timestamp && !isNaN(new Date(event.timestamp).getTime())
                                ? new Date(event.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : event.status === 'NOT_APPLICABLE'
                                ? 'Not Applicable'
                                : 'Scheduled'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">{event.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{event.description}</p>
                        </div>

                        {/* Score Differential Panel if scores exist */}
                        {event.scoreAfter !== undefined && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Evaluated score outcome</span>
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                {event.scoreAfter.toFixed(2)} / 5.00
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Metadata Stamp (CTC, Signature Hash, IP) */}
                        {event.details && (
                          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                            {event.details.documentHash && (
                              <span className="flex items-center gap-1 tabular-nums bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                <Fingerprint className="w-3 h-3 text-slate-400" />
                                <span>Hash: {event.details.documentHash}</span>
                              </span>
                            )}
                            {event.details.ipAddress && (
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <span>IP: {event.details.ipAddress}</span>
                              </span>
                            )}
                            {event.details.newCtc && (
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <DollarSign className="w-3 h-3" />
                                <span>Revised CTC: ₹{(event.details.newCtc / 100000).toFixed(2)}L p.a.</span>
                              </span>
                            )}
                            {event.details.approvedIncrement !== undefined && (
                              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
                                Increment: {event.details.approvedIncrement}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                No lifecycle events recorded yet for this employee.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: MASTER AUDIT EVENT STREAM (Super Admin only)
          ========================================== */}
      {isSuperAdmin && activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyLogFilters()}
                placeholder="Search audit trail by actor, employee, description, or action..."
                className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All modules</option>
                <option value="KRA_MANAGEMENT" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">KRA management</option>
                <option value="QUARTERLY_REVIEW" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Quarterly reviews</option>
                <option value="CALIBRATION" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Calibration</option>
                <option value="BUDGET_INCREMENT" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Budget & increment</option>
                <option value="LETTERS" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Digital letters</option>
                <option value="BULK_IMPORT" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Bulk import</option>
                <option value="CYCLE_ADMIN" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Cycle admin</option>
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All severities</option>
                <option value="CRITICAL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Critical</option>
                <option value="WARNING" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Warning</option>
                <option value="NOTICE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Notice</option>
                <option value="INFO" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Info</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={isFlaggedOnly}
                  onChange={(e) => setIsFlaggedOnly(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-amber-700 dark:text-amber-400">Flagged only</span>
              </label>

              <button
                onClick={handleApplyLogFilters}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors dark:border dark:border-slate-700 cursor-pointer"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Master Event Table */}
          <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3.5">Timestamp (UTC)</th>
                  <th className="py-3 px-3.5">Module & action</th>
                  <th className="py-3 px-3.5">Actor</th>
                  <th className="py-3 px-3.5">Target employee / cohort</th>
                  <th className="py-3 px-3.5">Audit summary & diff</th>
                  <th className="py-3 px-3.5">Severity</th>
                  <th className="py-3 px-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {auditLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${log.isFlaggedCompliance ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''}`}>
                        <td className="py-3 px-3.5 tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }) : '—'}
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">{log.actionType}</div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{log.module}</span>
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{log.actorName}</div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Role: {log.actorRole}</span>
                        </td>

                        <td className="py-3 px-3.5">
                          {log.targetEmployeeName ? (
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{log.targetEmployeeName}</div>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{log.targetDepartment}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">System level</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 max-w-xs">
                          <div
                            className="truncate text-slate-800 dark:text-slate-200 font-medium"
                            title={typeof log.description === 'object' ? JSON.stringify(log.description) : String(log.description || '')}
                          >
                            {typeof log.description === 'object' ? JSON.stringify(log.description) : String(log.description || '')}
                          </div>
                          {log.diffSummary && (
                            <div
                              className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5 truncate"
                              title={typeof log.diffSummary === 'object' ? JSON.stringify(log.diffSummary) : String(log.diffSummary)}
                            >
                              {typeof log.diffSummary === 'object' ? JSON.stringify(log.diffSummary) : String(log.diffSummary)}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              log.severity === 'CRITICAL'
                                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : log.severity === 'WARNING'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : log.severity === 'NOTICE'
                                ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border dark:border-slate-700'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Forensic Metadata Panel */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                          <td colSpan={7} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 space-y-1.5">
                                <div className="text-[11px] font-bold text-slate-400">
                                  Previous state payload
                                </div>
                                <pre className="text-[11px] tabular-nums bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 overflow-x-auto">
                                  {log.previousValue
                                    ? JSON.stringify(log.previousValue, null, 2)
                                    : 'No previous state (Initial creation)'}
                                </pre>
                              </div>

                              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 space-y-1.5">
                                <div className="text-[11px] font-bold text-slate-400">
                                  Committed state payload
                                </div>
                                <pre className="text-[11px] tabular-nums bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 overflow-x-auto">
                                  {log.newValue ? JSON.stringify(log.newValue, null, 2) : 'N/A'}
                                </pre>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 tabular-nums">
                              <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                              <span>•</span>
                              <span>User-Agent: {log.userAgent || 'Chrome/128'}</span>
                              <span>•</span>
                              <span>Log ID: {log.id}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
