import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Employee, Department, Designation, Cycle, KraTemplate, ReviewPeriod, User } from '../types';
import { api } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../context/AuthContext';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { EmployeeModal } from './EmployeeModal';
import { MastersManagement } from './MastersManagement';
import {
  Search,
  Plus,
  Edit2,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  MapPin,
  Key,
  LayoutGrid,
  List,
  Trash2,
  UserMinus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { CycleBadge } from './ui/CycleBadge';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';

interface EmployeeDirectoryProps {
  currentUser?: User | null;
  departments?: Department[];
  designations?: Designation[];
  cycles?: Cycle[];
  kraTemplates?: KraTemplate[];
  onNavigateToAppraisals?: (options?: any) => void;
  onNavigateToReviews?: (options?: any) => void;
  onNavigateToHierarchy?: () => void;
  employees?: Employee[];
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({
  onNavigateToHierarchy,
  departments: initialDepartments,
  designations: initialDesignations,
  cycles: initialCycles,
  kraTemplates: initialKraTemplates,
  employees: initialEmployees,
}) => {
  const { user } = useAuth();
  const isHRorAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';
  const isAdmin = user?.role === 'SUPER_ADMIN';

  // Data State initialized from props when available
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees || []);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments || []);
  const [designations, setDesignations] = useState<Designation[]>(initialDesignations || []);
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles || []);
  const [kraTemplates, setKraTemplates] = useState<KraTemplate[]>(initialKraTemplates || []);
  const [reviewPeriods, setReviewPeriods] = useState<ReviewPeriod[]>([]);
  const [employeeIdsOnPip, setEmployeeIdsOnPip] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(
    initialEmployees === undefined
  );

  useEffect(() => {
    if (!isHRorAdmin) return;
    api
      .getPips()
      .then((plans) => {
        const active = plans.filter((p) => p.status === 'ACTIVE' || p.status === 'EXTENDED');
        setEmployeeIdsOnPip(new Set(active.map((p) => p.employeeId)));
      })
      .catch(() => {
        // Non-critical — the badge just won't show if this fails.
      });
  }, [isHRorAdmin]);

  // Sync with incoming master data props
  useEffect(() => {
    if (initialEmployees !== undefined) {
      setEmployees(initialEmployees);
      setLoading(false);
    }
    if (initialDepartments) setDepartments(initialDepartments);
    if (initialDesignations) setDesignations(initialDesignations);
    if (initialCycles) setCycles(initialCycles);
    if (initialKraTemplates) setKraTemplates(initialKraTemplates);
  }, [initialEmployees, initialDepartments, initialDesignations, initialCycles, initialKraTemplates]);

  // Delete Employee Modal State
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const isMobile = useIsMobile();
  // A wide data table is unusable on a phone regardless of the desktop-oriented toggle
  // above — force cards on small screens while still respecting the user's choice on desktop.
  const effectiveViewMode = isMobile ? 'cards' : viewMode;

  // Pagination State (20 employees per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedCycle, selectedStatus]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'employees' | 'masters'>('employees');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isRehireInitial, setIsRehireInitial] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, desRes, cycRes, kraRes, periodRes] = await Promise.all([
        api.getEmployees(),
        api.getDepartments(),
        api.getDesignations(),
        api.getCycles(),
        api.getKraTemplates().catch(() => []),
        api.getReviewPeriods().catch(() => []),
      ]);
      setEmployees(empRes);
      setDepartments(deptRes);
      setDesignations(desRes);
      setCycles(cycRes);
      setKraTemplates(kraRes || []);
      setReviewPeriods(periodRes || []);
    } catch (err) {
      console.error('Failed to load employee master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only trigger remote fetch if props were not provided
    if (initialEmployees === undefined) {
      loadData();
    } else {
      // Review periods are never passed in as a prop, so they must always be
      // fetched here even when employees/departments/etc. already arrived
      // from the parent — otherwise the "Starting Review Period" selector
      // stays empty until an unrelated re-fetch (e.g. a page refresh) happens.
      setLoading(false);
      api.getReviewPeriods().then(setReviewPeriods).catch(() => setReviewPeriods([]));
    }
  }, [initialEmployees]);

  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    if (!isAdmin) {
      toast.error('Access denied: Only System Administrators can delete and archive employee data.', 'Permission Denied');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await api.deleteEmployee(employeeToDelete.id);
      toast.success(res.message || `Employee "${employeeToDelete.name}" archived as Past Employee and performance data deleted.`, 'Employee Archived');
      setEmployeeToDelete(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete employee data', 'Action Failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered employees calculation
  const filteredEmployees = employees.filter((emp) => {
    if (selectedDept && emp.departmentId !== selectedDept) return false;
    if (selectedCycle && emp.cycleId !== selectedCycle && emp.cycleCode !== selectedCycle) return false;
    if (selectedStatus) {
      if (selectedStatus === 'INACTIVE') {
        if (emp.status !== 'INACTIVE' && !emp.isPastEmployee) return false;
      } else if (emp.status !== selectedStatus) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        emp.name.toLowerCase().includes(q) ||
        emp.employeeCode.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.departmentName && emp.departmentName.toLowerCase().includes(q)) ||
        (emp.designationName && emp.designationName.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Pagination Calculations (20 per page)
  const totalFilteredCount = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Helper for generating page numbers with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  // KPI Metrics
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter((e) => e.status === 'ACTIVE').length;
  const uniqueDeptCount = new Set(employees.map((e) => e.departmentId).filter(Boolean)).size || departments.length;
  const hasActiveFilters = Boolean(searchQuery || selectedDept || selectedCycle || selectedStatus);
  const activeCycles = cycles.filter((c) => c.active !== false);

  const getStatusBadge = (status: string, isPastEmployee?: boolean) => {
    if (status === 'INACTIVE' || isPastEmployee) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
          <UserMinus className="w-3 h-3 text-slate-400 dark:text-slate-500" /> Past employee
        </span>
      );
    }
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Active
          </span>
        );
      case 'PROBATION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Probation
          </span>
        );
      case 'NOTICE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-medium">
            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Notice
          </span>
        );
      default:
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return <PageSkeletonLoader variant="table" rowCount={7} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Everyone in the organization, with their department, appraisal cycle and reviewers."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Show"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'employees', label: `Employees (${employees.length})` },
                ...(isHRorAdmin ? [{ value: 'masters' as const, label: 'Departments and roles' }] : []),
              ]}
            />
            {isHRorAdmin && activeTab === 'employees' && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {
                  setEditingEmployee(null);
                  setIsModalOpen(true);
                }}
              >
                Add employee
              </Button>
            )}
          </>
        }
      />

      {/* VIEW 1: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Summary: one line of figures above the filters */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-sm text-slate-600 dark:text-slate-400">
            <span className="tabular-nums">
              <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{activeEmployeesCount}</strong> active of{' '}
              <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{totalEmployeesCount}</strong>{' '}
              ({totalEmployeesCount > 0 ? Math.round((activeEmployeesCount / totalEmployeesCount) * 100) : 0}%)
            </span>
            {hasActiveFilters && (
              <span className="text-indigo-700 dark:text-indigo-300 font-medium tabular-nums">
                {filteredEmployees.length} match the filters
              </span>
            )}
            <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
            <span className="tabular-nums">
              <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{departments.length || uniqueDeptCount}</strong> departments,{' '}
              <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{designations.length}</strong> roles
            </span>
            <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
            <span>
              {activeCycles.length > 0 ? activeCycles.map((c) => c.name).join(' and ') : 'No active appraisal cycles'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToHierarchy) {
                  onNavigateToHierarchy();
                } else {
                  window.location.hash = '#hierarchy';
                }
              }}
              className="sm:ml-auto text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              View hierarchy
            </button>
          </div>

          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-2.5 rounded-xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, employee code, email..."
                className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns and Actions Cluster */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Select */}
              <div className="relative">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-9 pl-2.5 pr-7 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Cycle Select */}
              <div className="relative">
                <select
                  value={selectedCycle}
                  onChange={(e) => setSelectedCycle(e.target.value)}
                  className="h-9 pl-2.5 pr-7 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">All cycles</option>
                  {cycles.filter((c) => c.active !== false).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Status Select */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-9 pl-2.5 pr-7 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PROBATION">Probation</option>
                  <option value="NOTICE">Notice</option>
                  <option value="INACTIVE">Past employees</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Clear filters button if active */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDept('');
                    setSelectedCycle('');
                    setSelectedStatus('');
                  }}
                  className="h-9 px-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/50 font-medium transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  Reset
                </button>
              )}

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-0.5" />

              {/* Refresh button */}
              <button
                onClick={loadData}
                title="Refresh Directory"
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {/* Cards / Table View Toggle — hidden on mobile since cards are forced there */}
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Cards</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Employees Display: Cards or Table */}
          {effectiveViewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {loading ? (
                <div className="col-span-full p-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  Loading employee records...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  No employees found matching the filters.
                </div>
              ) : (
                paginatedEmployees.map((emp) => {
                  const cycleInfo = cycles.find((c) => c.id === emp.cycleId || c.code === emp.cycleCode);
                  return (
                    <div
                      key={emp.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-xs shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{emp.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">{emp.employeeCode} • {emp.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(emp.status, emp.isPastEmployee)}
                            {employeeIdsOnPip.has(emp.id) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                On PIP
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                            {emp.designationName || 'Designation'}
                          </div>
                          {(emp.systemRole || emp.hasLoginAccount) && (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                              >
                                <Key className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" />
                                {emp.systemRole || 'Portal Active'}
                              </span>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{emp.departmentName || 'Department'}</span>
                          </div>
                          {cycleInfo && (
                            <div className="flex items-center gap-1.5">
                              <CycleBadge code={emp.cycleCode || cycleInfo.code} />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">({cycleInfo.name})</span>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span>Manager: <strong className="text-slate-700 dark:text-slate-300">{emp.managerName || 'None'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        {(emp.status === 'INACTIVE' || emp.isPastEmployee) ? (
                          <div>
                            <span className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold block leading-tight">
                              Relieved on
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {(emp.relievingDate || emp.pastEmployeeDate)
                                ? new Date(emp.relievingDate || emp.pastEmployeeDate!).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                                : 'Date not recorded'}
                            </span>
                          </div>
                        ) : isHRorAdmin ? (
                          <div>
                            <span className="text-[11px] text-slate-400 block leading-tight">Starting CTC</span>
                            <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                              {emp.currency || '₹'}{(emp.currentCtc || 1600000).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            Joined {new Date(emp.joiningDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          </div>
                        )}

                        {isHRorAdmin && (
                          <div className="flex items-center gap-1.5">
                            {(emp.status === 'INACTIVE' || emp.isPastEmployee) && (
                              <button
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setIsRehireInitial(true);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 px-2.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Rehire past employee and reactivate profile"
                              >
                                <UserCheck className="w-3 h-3" /> Rehire
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingEmployee(emp);
                                setIsRehireInitial(false);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 px-2.5 rounded-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            {isAdmin && emp.status !== 'INACTIVE' && !emp.isPastEmployee && (
                              <button
                                onClick={() => setEmployeeToDelete(emp)}
                                className="p-1.5 px-2 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                                title="Delete employee data & archive as past employee (Admin Only)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <div className="overflow-x-auto overscroll-x-contain max-h-[70vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/95 dark:bg-[#18181d]/95 border-b border-slate-200/80 dark:border-white/[0.06]">
                    <tr className="text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-3 py-3">Department & role</th>
                      <th className="px-3 py-3">Appraisal cycle</th>
                      <th className="px-3 py-3">Reporting hierarchy</th>
                      {isHRorAdmin && <th className="px-3 py-3">Starting CTC</th>}
                      <th className="px-3 py-3">Status &amp; dates</th>
                      {isHRorAdmin && <th className="px-3 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
                    {loading ? (
                      <tr>
                        <td colSpan={isHRorAdmin ? 7 : 5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                          Loading employee records...
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={isHRorAdmin ? 7 : 5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                          No employees found matching the filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map((emp) => {
                        const cycleInfo = cycles.find((c) => c.id === emp.cycleId || c.code === emp.cycleCode);
                        return (
                          <tr
                            key={emp.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Employee Info */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-xs">
                                  {emp.name.charAt(0)}
                                </div>
                                <div className="min-w-0 max-w-[240px]">
                                  <div className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {emp.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate" title={`${emp.employeeCode} • ${emp.email}`}>
                                    {emp.employeeCode} • {emp.email}
                                  </div>
                                  {(emp.location || emp.phone) && (
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5 min-w-0 whitespace-nowrap overflow-hidden" title={[emp.location, emp.phone].filter(Boolean).join(' • ')}>
                                      {emp.location && (
                                        <span className="flex items-center gap-0.5 min-w-0 truncate">
                                          <MapPin className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                                          {emp.location}
                                        </span>
                                      )}
                                      {emp.phone && <span>• {emp.phone}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Designation, Role & Dept */}
                            <td className="px-3 py-3">
                              <div className="text-slate-900 dark:text-slate-200 font-semibold text-xs leading-snug">
                                {emp.designationName || 'Designation'}
                              </div>
                              {(emp.systemRole || emp.hasLoginAccount) && (
                                <div className="mt-1">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                    title={`Portal Sign-In Active (${emp.systemRole || 'User'})`}
                                  >
                                    <Key className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" />
                                    {emp.systemRole || 'Portal Active'}
                                  </span>
                                </div>
                              )}
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                                <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span>{emp.departmentName || 'Department'}</span>
                              </div>
                            </td>

                            {/* Cycle */}
                            <td className="px-3 py-3">
                              <CycleBadge code={emp.cycleCode || cycleInfo?.code} cycleName={emp.cycleName || cycleInfo?.name} />
                            </td>

                            {/* Hierarchy */}
                            <td className="px-3 py-3">
                              <div className="text-[11px] text-slate-700 dark:text-slate-300">
                                <span className="text-slate-400 dark:text-slate-500">Manager:</span>{' '}
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {emp.managerName || 'Direct'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="text-slate-400 dark:text-slate-500">HOD:</span> {emp.hodName || 'Dept Head'}
                              </div>
                            </td>

                            {/* Compensation */}
                            {isHRorAdmin && (
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white tabular-nums text-[11px]">
                                  {emp.currency || '₹'}{(emp.currentCtc || 1600000).toLocaleString()}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                  Annual CTC
                                </div>
                              </td>
                            )}

                            {/* Status */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getStatusBadge(emp.status, emp.isPastEmployee)}
                                {employeeIdsOnPip.has(emp.id) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    On PIP
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                              <div>
                                <span className="text-slate-400 dark:text-slate-500">Joined: </span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  {emp.joiningDate
                                    ? new Date(emp.joiningDate).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                    : '—'}
                                </span>
                              </div>
                              {(emp.status === 'INACTIVE' || emp.isPastEmployee) && (
                                <div className="mt-1 flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                  <span className="text-rose-500/80">Relieved: </span>
                                  <span>
                                    {(emp.relievingDate || emp.pastEmployeeDate)
                                      ? new Date(emp.relievingDate || emp.pastEmployeeDate!).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                      : 'Not set'}
                                  </span>
                                </div>
                              )}
                              </div>
                            </td>


                            {/* Actions */}
                            {isHRorAdmin && (
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {(emp.status === 'INACTIVE' || emp.isPastEmployee) && (
                                    <button
                                      onClick={() => {
                                        setEditingEmployee(emp);
                                        setIsRehireInitial(true);
                                        setIsModalOpen(true);
                                      }}
                                      className="px-2 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Rehire past employee and reactivate profile"
                                    >
                                      <UserCheck className="w-3 h-3" /> Rehire
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingEmployee(emp);
                                      setIsRehireInitial(false);
                                      setIsModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Edit employee & cycle assignment"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {isAdmin && emp.status !== 'INACTIVE' && !emp.isPastEmployee && (
                                    <button
                                      onClick={() => setEmployeeToDelete(emp)}
                                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title="Delete employee data & archive as past employee (Admin Only)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Footer Controls (20 per page) */}
          {totalFilteredCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 font-medium">
                <span>
                  Showing <strong className="text-slate-800 dark:text-slate-200">{startIndex + 1}</strong> to{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{endIndex}</strong> of{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{totalFilteredCount}</strong> employees
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 font-normal border border-slate-200/50 dark:border-white/[0.06]">
                  20 per page
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={safeCurrentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181d] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageItem, idx) => {
                      if (pageItem === '...') {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 dark:text-slate-600 select-none">
                            •••
                          </span>
                        );
                      }
                      const pageNum = pageItem as number;
                      const isActive = pageNum === safeCurrentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181d] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={safeCurrentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181d] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 cursor-pointer"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MASTERS (DEPARTMENTS & DESIGNATIONS) */}
      {activeTab === 'masters' && isHRorAdmin && (
        <MastersManagement
          departments={departments}
          designations={designations}
          employees={employees}
          cycles={cycles}
          onRefresh={loadData}
          currentUser={user}
        />
      )}

      {/* Edit / Add Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsRehireInitial(false);
        }}
        onSaved={loadData}
        employeeToEdit={editingEmployee}
        initialRehire={isRehireInitial}
        departments={departments}
        designations={designations}
        cycles={cycles}
        reviewPeriods={reviewPeriods}
        allEmployees={employees}
        kraTemplates={kraTemplates}
      />

      {/* Delete Employee Confirmation Modal */}
      <EmployeeDeleteModal
        employee={employeeToDelete}
        employees={employees}
        departments={departments}
        loading={deleteLoading}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={handleConfirmDeleteEmployee}
        getStatusBadge={getStatusBadge}
      />
    </div>
  );
};

interface EmployeeDeleteModalProps {
  employee: Employee | null;
  employees: Employee[];
  departments: Department[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  getStatusBadge: (status: string, isPastEmployee?: boolean) => React.ReactNode;
}

const EmployeeDeleteModal: React.FC<EmployeeDeleteModalProps> = ({
  employee,
  employees,
  departments,
  loading,
  onClose,
  onConfirm,
  getStatusBadge,
}) => {
  const cachedEmployeeRef = React.useRef(employee);
  if (employee) {
    cachedEmployeeRef.current = employee;
  }
  const emp = employee || cachedEmployeeRef.current;

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen: !!employee,
    onClose,
  });

  if (!isMounted || !emp) return null;
  if (typeof document === 'undefined') return null;

  const managedReports = employees.filter((e) => e.managerId === emp.id && e.status !== 'INACTIVE');
  const ledDepartments = departments.filter((d) => d.hodId === emp.id);

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full my-auto overflow-hidden ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 shrink-0">
              <UserMinus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete employee & archive as past employee
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Purge performance data while keeping directory record
              </p>
            </div>
          </div>
          <button
            onClick={() => !loading && handleClose()}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Employee Summary Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center justify-center shrink-0">
                {emp.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {emp.name}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {emp.designationName || 'Designation'} • {emp.departmentName || 'Department'}
                </p>
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 block truncate">
                  {emp.employeeCode} • {emp.email}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              {getStatusBadge(emp.status, emp.isPastEmployee)}
            </div>
          </div>

          {/* Leadership Impact Notice (If HOD or Manager) */}
          {(managedReports.length > 0 || ledDepartments.length > 0) && (
            <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Leadership assignment impact:</span>
              </div>
              {managedReports.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                  Reporting manager for <strong>{managedReports.length} active employee(s)</strong> ({managedReports.slice(0, 3).map((e) => e.name).join(', ')}{managedReports.length > 3 ? ` +${managedReports.length - 3} more` : ''}). Their manager will automatically be set to <strong>&quot;Unassigned&quot;</strong>.
                </p>
              )}
              {ledDepartments.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                  Designated HOD for <strong>{ledDepartments.map((d) => d.name).join(', ')}</strong>. The department HOD will be reset to <strong>&quot;Unassigned&quot;</strong>.
                </p>
              )}
            </div>
          )}

          {/* Data Purge Breakdown Notice */}
          <div className="space-y-2.5">
            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>The following data will be PERMANENTLY deleted:</span>
              </div>
              <ul className="text-[11px] space-y-1 text-rose-700 dark:text-rose-300/90 pl-4 list-disc">
                <li>All 4-quarter reviews, ratings, and self-evaluation submissions</li>
                <li>All annual appraisal decision records and compensation letters</li>
                <li>All 360-degree peer feedback requests and responses</li>
                <li>User portal login account & credentials (portal sign-in revoked)</li>
                <li>Unassigned as manager or HOD for any direct reports</li>
              </ul>
            </div>

            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>What will be preserved:</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Identity details (name, employee code, department, designation, and joining date) will remain preserved in the directory with status <strong>Past employee</strong> for corporate compliance and historical service reference.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'Purging & Archiving...' : 'Confirm Deletion & Archive'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
