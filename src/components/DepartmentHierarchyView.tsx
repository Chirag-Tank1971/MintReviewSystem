import React, { useState, useMemo } from 'react';
import { Employee, Department } from '../types';
import {
  Building2,
  Users,
  ChevronRight,
  Search,
  Clock,
  AlertCircle,
  Edit2,
  ArrowLeft,
  Plus,
  Upload,
} from 'lucide-react';
import { CycleBadge } from './ui/CycleBadge';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { m, AnimatePresence, accordionVariants } from '../animations';

interface DepartmentHierarchyViewProps {
  employees: Employee[];
  departments: Department[];
  isHRorAdmin?: boolean;
  onEditEmployee?: (employee: Employee) => void;
  onAddEmployee?: () => void;
  onBackToDirectory?: () => void;
}

interface ManagerWithReports {
  manager: Employee;
  directReports: Employee[];
  isCrossDept?: boolean;
}

interface DepartmentHierarchyData {
  department: Department;
  hod: Employee | null;
  totalHeadcount: number;
  activeHeadcount: number;
  managersWithReports: ManagerWithReports[];
  directToHodOrUnassigned: Employee[];
}

export const DepartmentHierarchyView: React.FC<DepartmentHierarchyViewProps> = ({
  employees,
  departments,
  isHRorAdmin = false,
  onEditEmployee,
  onAddEmployee,
  onBackToDirectory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  // Departments start collapsed (one line each); a manager's team shows once its department is open
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [collapsedManagers, setCollapsedManagers] = useState<Record<string, boolean>>({});

  // Memoize department hierarchy calculations
  const hierarchyData: DepartmentHierarchyData[] = useMemo(() => {
    const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

    return departments.map((dept) => {
      // 1. Department members
      const deptMembers = employees.filter((e) => e.departmentId === dept.id);
      const activeMembers = deptMembers.filter((e) => e.status === 'ACTIVE');

      // 2. Identify HOD
      let hod: Employee | null = null;
      if (dept.hodId && empMap.has(dept.hodId)) {
        hod = empMap.get(dept.hodId) || null;
      } else {
        hod =
          deptMembers.find(
            (e) =>
              e.systemRole === 'HOD' ||
              e.designationName?.toLowerCase().includes('vp') ||
              e.designationName?.toLowerCase().includes('head')
          ) || null;
      }

      // 3. Identify Managers in this Department
      const managerIdsSet = new Set<string>();

      deptMembers.forEach((e) => {
        if (e.systemRole === 'MANAGER' || e.systemRole === 'REPORTING_MANAGER') {
          managerIdsSet.add(e.id);
        }
      });

      employees.forEach((e) => {
        if (e.managerId && deptMembers.some((dm) => dm.id === e.managerId)) {
          managerIdsSet.add(e.managerId);
        }
      });

      // Exclude HOD from managers list if HOD is displayed separately
      if (hod && managerIdsSet.has(hod.id)) {
        managerIdsSet.delete(hod.id);
      }

      const managersWithReports: ManagerWithReports[] = [];
      Array.from(managerIdsSet).forEach((mId) => {
        const manager = empMap.get(mId);
        if (manager) {
          const directReports = employees.filter(
            (e) => e.managerId === manager.id && e.id !== manager.id
          );
          managersWithReports.push({
            manager,
            directReports,
            isCrossDept: manager.departmentId !== dept.id,
          });
        }
      });
      managersWithReports.sort((a, b) => b.directReports.length - a.directReports.length);

      // 4. Employees reporting directly to HOD or without intermediate manager
      const managerIds = new Set(managersWithReports.map((m) => m.manager.id));
      const directToHodOrUnassigned = deptMembers.filter((e) => {
        if (hod && e.id === hod.id) return false;
        if (e.managerId && managerIds.has(e.managerId)) return false;
        return true;
      });

      return {
        department: dept,
        hod,
        totalHeadcount: deptMembers.length,
        activeHeadcount: activeMembers.length,
        managersWithReports,
        directToHodOrUnassigned,
      };
    });
  }, [employees, departments]);

  // Overall Organization Stats
  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const deptsWithHod = hierarchyData.filter((d) => d.hod !== null).length;
    
    // Unique managers with at least 1 direct report
    const uniqueManagers = new Set<string>();
    let totalAssignedDirectReports = 0;

    hierarchyData.forEach((d) => {
      d.managersWithReports.forEach((m) => {
        uniqueManagers.add(m.manager.id);
        totalAssignedDirectReports += m.directReports.length;
      });
    });

    const avgSpanOfControl =
      uniqueManagers.size > 0 ? (totalAssignedDirectReports / uniqueManagers.size).toFixed(1) : '0';

    return {
      totalDepts,
      deptsWithHod,
      totalManagers: uniqueManagers.size,
      totalAssignedDirectReports,
      avgSpanOfControl,
    };
  }, [departments, hierarchyData]);

  // Filtered department list based on user search & department selection
  const filteredHierarchy = useMemo(() => {
    let list = hierarchyData;

    if (selectedDeptId && selectedDeptId !== 'ALL') {
      list = list.filter((d) => d.department.id === selectedDeptId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => {
        const matchDept =
          d.department.name.toLowerCase().includes(q) ||
          d.department.code.toLowerCase().includes(q);
        const matchHod =
          d.hod &&
          (d.hod.name.toLowerCase().includes(q) ||
            d.hod.employeeCode.toLowerCase().includes(q) ||
            d.hod.email.toLowerCase().includes(q));
        const matchManager = d.managersWithReports.some(
          (m) =>
            m.manager.name.toLowerCase().includes(q) ||
            m.manager.employeeCode.toLowerCase().includes(q) ||
            m.directReports.some(
              (r) =>
                r.name.toLowerCase().includes(q) ||
                r.employeeCode.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q)
            )
        );
        const matchDirectStaff = d.directToHodOrUnassigned.some(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.employeeCode.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q)
        );

        return matchDept || matchHod || matchManager || matchDirectStaff;
      });
    }

    return list;
  }, [hierarchyData, selectedDeptId, searchQuery]);

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const toggleManagerCollapse = (mgrId: string) => {
    setCollapsedManagers((prev) => ({ ...prev, [mgrId]: !prev[mgrId] }));
  };

  const expandAll = () => {
    setExpandedDepts(Object.fromEntries(departments.map((d) => [d.id, true])));
    setCollapsedManagers({});
  };

  const collapseAll = () => {
    setExpandedDepts({});
  };

  // While searching, every matching path is open and the people found are highlighted
  const query = searchQuery.toLowerCase().trim();
  const isSearching = query.length > 0;
  const matchesSearch = (emp: Employee) =>
    isSearching &&
    (emp.name.toLowerCase().includes(query) ||
      emp.employeeCode.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROBATION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-2.5 h-2.5 text-amber-500" /> Probation
          </span>
        );
      case 'NOTICE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-2.5 h-2.5 text-rose-500" /> Notice
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {status}
          </span>
        );
    }
  };

  const renderPerson = (
    emp: Employee,
    opts: { tag?: string; meta?: string; flag?: string; leading?: React.ReactNode } = {}
  ) => (
    <div
      className={`flex items-center gap-2.5 py-1.5 pr-1 rounded-md ${
        matchesSearch(emp) ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900/60' : ''
      }`}
    >
      {opts.leading}
      <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center shrink-0">
        {emp.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-slate-900 dark:text-white" title={emp.email}>
            {emp.name}
          </span>
          {opts.tag && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {opts.tag}
            </span>
          )}
          {emp.status !== 'ACTIVE' && getStatusBadge(emp.status)}
          {opts.flag && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {opts.flag}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
          {emp.designationName || 'Team member'}, {emp.employeeCode}
        </div>
      </div>
      {opts.meta && <span className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{opts.meta}</span>}
      <CycleBadge code={emp.cycleCode} color={emp.cycleColor} size="sm" showTooltip />
      {isHRorAdmin && onEditEmployee && (
        <button
          type="button"
          onClick={() => onEditEmployee(emp)}
          aria-label={`Edit ${emp.name}`}
          title="Edit employee and reporting line"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // Back to the employee list (the hierarchy is opened from there)
  const backToDirectory = () => {
    if (onBackToDirectory) {
      onBackToDirectory();
    } else {
      window.location.hash = '#employees';
    }
  };

  if (departments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Departments"
          description="Department heads, reporting managers and how many people report to each."
          actions={
            <Button icon={ArrowLeft} onClick={backToDirectory}>
              Back to employees
            </Button>
          }
        />
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description={
            <>
              Departments and reporting lines are created automatically when you import your employee sheet from{' '}
              <strong>Import and export</strong>.
            </>
          }
          action={{
            label: 'Go to import and export',
            icon: Upload,
            onClick: () => {
              window.location.hash = '#bulk';
            },
          }}
          secondaryAction={{ label: 'Back to employees', icon: Users, onClick: backToDirectory }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Department heads, reporting managers and how many people report to each."
        actions={
          <>
            <Button icon={ArrowLeft} onClick={backToDirectory} title="Back to the employee list">
              Back to employees
            </Button>
            {isHRorAdmin && onAddEmployee && (
              <Button variant="primary" icon={Plus} onClick={onAddEmployee}>
                Add employee
              </Button>
            )}
          </>
        }
      />

      {/* 1. Summary line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
        <span>
          <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.totalDepts}</strong> departments
        </span>
        <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
        <span>
          <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.deptsWithHod}</strong> of {stats.totalDepts} have an HOD (
          {stats.totalDepts > 0 ? Math.round((stats.deptsWithHod / stats.totalDepts) * 100) : 0}%)
        </span>
        <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
        <span>
          <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.totalManagers}</strong> people managers
        </span>
        <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
        <span>
          <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.avgSpanOfControl}</strong> reports per manager ({stats.totalAssignedDirectReports} in teams)
        </span>
      </div>

      {/* 2. SEARCH, FILTER & ACCORDION CONTROLS BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-2.5 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search department, HOD, manager, or direct report..."
            className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Select */}
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          {/* Expand / Collapse All */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors cursor-pointer"
            >
              Expand all
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors cursor-pointer"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* 3. Reporting tree: department, then HOD, then managers, then their teams */}
      {filteredHierarchy.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          No departments or people match your search.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredHierarchy.map((deptData) => {
            const { department, hod, totalHeadcount, activeHeadcount, managersWithReports, directToHodOrUnassigned } = deptData;
            const isOpen = isSearching || Boolean(expandedDepts[department.id]);
            const withoutManager = directToHodOrUnassigned.filter((e) => !e.managerId).length;

            return (
              <div key={department.id}>
                <button
                  type="button"
                  onClick={() => toggleDept(department.id)}
                  aria-expanded={isOpen}
                  className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{department.name}</span>
                    <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {department.code}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pl-6 sm:pl-0">
                    {hod ? (
                      <span>
                        HOD <strong className="font-medium text-slate-900 dark:text-white">{hod.name}</strong>
                      </span>
                    ) : department.hodName ? (
                      <span>
                        HOD <strong className="font-medium text-slate-900 dark:text-white">{department.hodName}</strong>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        No HOD
                      </span>
                    )}
                    <span className="tabular-nums">
                      {managersWithReports.length} {managersWithReports.length === 1 ? 'manager' : 'managers'}
                    </span>
                    <span className="tabular-nums">
                      {totalHeadcount} people ({activeHeadcount} active)
                    </span>
                    {withoutManager > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        {withoutManager} without a manager
                      </span>
                    )}
                    {department.budgetCapPercent ? (
                      <span className="tabular-nums">Budget cap {department.budgetCapPercent}%</span>
                    ) : null}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div key="body" variants={accordionVariants} initial="collapsed" animate="expanded" exit="collapsed">
                      <div className="pl-10 pr-4 pb-4">
                        {hod ? (
                          renderPerson(hod, { tag: 'HOD' })
                        ) : (
                          <div className="flex items-center gap-1.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            No HOD assigned to this department yet.
                          </div>
                        )}

                        <ul className="ml-3 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
                          {managersWithReports.map(({ manager, directReports, isCrossDept }) => {
                            const isTeamOpen = isSearching || !collapsedManagers[manager.id];
                            return (
                              <li key={manager.id}>
                                {renderPerson(manager, {
                                  tag: isCrossDept ? 'Manager, other department' : 'Manager',
                                  meta: `${directReports.length} ${directReports.length === 1 ? 'report' : 'reports'}`,
                                  flag: directReports.length === 0 ? 'No team' : undefined,
                                  leading:
                                    directReports.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleManagerCollapse(manager.id)}
                                        aria-expanded={isTeamOpen}
                                        aria-label={`${isTeamOpen ? 'Hide' : 'Show'} ${manager.name}'s team`}
                                        className="p-0.5 -ml-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                      >
                                        <ChevronRight
                                          className={`w-3.5 h-3.5 transition-transform ${isTeamOpen ? 'rotate-90' : ''}`}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    ) : (
                                      <span className="w-3.5 -ml-1" aria-hidden="true" />
                                    ),
                                })}
                                <AnimatePresence initial={false}>
                                  {isTeamOpen && directReports.length > 0 && (
                                    <m.ul
                                      key="team"
                                      variants={accordionVariants}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="collapsed"
                                      className="ml-3 pl-4 border-l border-slate-200 dark:border-slate-700"
                                    >
                                      {directReports.map((emp) => (
                                        <li key={emp.id}>{renderPerson(emp)}</li>
                                      ))}
                                    </m.ul>
                                  )}
                                </AnimatePresence>
                              </li>
                            );
                          })}

                          {directToHodOrUnassigned.length > 0 && (
                            <li>
                              <div className="pt-2 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {hod ? `Reports directly to ${hod.name}` : 'No reporting manager in this department'}
                              </div>
                              <ul className="ml-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                                {directToHodOrUnassigned.map((emp) => (
                                  <li key={emp.id}>
                                    {renderPerson(emp, { flag: !emp.managerId ? 'No manager' : undefined })}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          )}

                          {managersWithReports.length === 0 && directToHodOrUnassigned.length === 0 && (
                            <li className="py-1.5 text-xs text-slate-500 dark:text-slate-400">No one else in this department yet.</li>
                          )}
                        </ul>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
