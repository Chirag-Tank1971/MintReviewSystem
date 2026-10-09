import React, { useState, useEffect } from 'react';
import {
  Award,
  Search,
  RefreshCw,
  Users,
  Lock,
  FileText,
  Sliders,
  ChevronRight,
  Building2,
  Briefcase,
  Archive,
  Download,
  Loader2,
  LayoutGrid,
  List,
  RotateCcw,
  Plus,
  ChevronDown,
  Filter,
  X,
} from 'lucide-react';
import {
  Appraisal,
  AppraisalSummaryStats,
  Cycle,
  Department,
  Designation,
  User as AuthUser,
  Employee,
} from '../types';
import { api } from '../services/api';
import { InitiateAppraisalModal } from './InitiateAppraisalModal';
import { AppraisalDetailModal } from './AppraisalDetailModal';
import { AppraisalLetterModal } from './AppraisalLetterModal';
import { BatchLetterExportModal } from './BatchLetterExportModal';
import { CycleBadge } from './ui/CycleBadge';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { downloadAppraisalPdf } from '../utils/letterExport';
import { useIsMobile } from '../hooks/useIsMobile';
import { EmployeeStatusBadge } from './ui/StatusBadge';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { m, AnimatePresence, accordionVariants } from '../animations';

export interface AppraisalViewConfig {
  /** Legacy deep-link field; Bell Curve & Budget is now its own 'calibration' view. */
  activeSection?: 'appraisals';
  cycleId?: string;
  year?: number;
  departmentId?: string;
  status?: string;
  appraisalId?: string;
  openLetter?: boolean;
  openDetail?: boolean;
}

interface AppraisalManagementViewProps {
  currentUser: AuthUser | null;
  departments: Department[];
  cycles: Cycle[];
  designations: Designation[];
  employees?: Employee[];
  initialConfig?: AppraisalViewConfig | null;
  onClearInitialConfig?: () => void;
}

type AppraisalQuickView = 'ALL' | 'MINE' | 'PENDING' | 'WITH_HOD' | 'WITH_HR' | 'APPROVED' | 'LOCKED';

const APPRAISAL_QUICK_VIEWS: { key: AppraisalQuickView; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MINE', label: 'Needs my action' },
  { key: 'PENDING', label: 'Pending manager' },
  { key: 'WITH_HOD', label: 'With HOD' },
  { key: 'WITH_HR', label: 'With HR' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'LOCKED', label: 'Locked' },
];

const APPRAISAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending manager',
  MANAGER_RECOMMENDED: 'Manager recommended',
  HOD_CALIBRATED: 'HOD calibrated',
  HR_APPROVED: 'HR approved',
  LOCKED: 'Locked & released',
};

export const AppraisalManagementView: React.FC<AppraisalManagementViewProps> = ({
  currentUser,
  departments,
  cycles,
  designations,
  employees,
  initialConfig,
  onClearInitialConfig,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const isMobile = useIsMobile();
  // A wide data table is unusable on a phone regardless of the desktop-oriented toggle
  // above — force cards on small screens while still respecting the user's choice on desktop.
  const effectiveViewMode = isMobile ? 'cards' : viewMode;
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [stats, setStats] = useState<AppraisalSummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, setError] =useState<string | null>(null);

  // Filters
  const [selectedCycleId, setSelectedCycleId] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMine] =useState<boolean>(false);
  const [hideInactive, setHideInactive] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem('appr_show_guide') === 'true';
    } catch {
      return false;
    }
  });
  // Reviewers land on their own queue; HR, admin and management see everything
  const [quickView, setQuickView] = useState<AppraisalQuickView>(
    ['MANAGER', 'REPORTING_MANAGER', 'HOD'].includes(currentUser?.role || '') ? 'MINE' : 'ALL'
  );

  // Modals
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState<boolean>(false);
  const [isBatchExportModalOpen, setIsBatchExportModalOpen] = useState<boolean>(false);
  const [selectedAppraisalForDetail, setSelectedAppraisalForDetail] = useState<Appraisal | null>(null);
  const [selectedAppraisalForLetter, setSelectedAppraisalForLetter] = useState<Appraisal | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Sync initialConfig if provided
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.cycleId) setSelectedCycleId(initialConfig.cycleId);
      if (initialConfig.year) setSelectedYear(initialConfig.year);
      if (initialConfig.appraisalId) {
        setSelectedStatus('ALL');
        setSelectedDepartmentId('ALL');
      } else {
        if (initialConfig.departmentId) setSelectedDepartmentId(initialConfig.departmentId);
        if (initialConfig.status) {
          let normStatus = initialConfig.status;
          if (normStatus === 'CALIBRATED') normStatus = 'HOD_CALIBRATED';
          if (normStatus === 'RECOMMENDED') normStatus = 'MANAGER_RECOMMENDED';
          setSelectedStatus(normStatus);
        }
      }
      if (initialConfig.appraisalId) {
        // Direct fetch guarantees opening the modal regardless of current active table filters
        api.getAppraisal(initialConfig.appraisalId)
          .then((appr) => {
            if (appr) {
              if (initialConfig.openLetter) {
                setSelectedAppraisalForLetter(appr);
              } else {
                setSelectedAppraisalForDetail(appr);
              }
            }
          })
          .catch(() => {
            api.getAppraisals().then((res) => {
              const match = res?.find((a) => a.id === initialConfig.appraisalId);
              if (match) {
                if (initialConfig.openLetter) {
                  setSelectedAppraisalForLetter(match);
                } else {
                  setSelectedAppraisalForDetail(match);
                }
              }
            }).catch((err) => console.warn('Could not auto-open appraisal record', err));
          });
      }
      onClearInitialConfig?.();
    }
  }, [initialConfig, onClearInitialConfig]);

  const userRole = currentUser?.role || 'EMPLOYEE';
  const canInitiate = userRole === 'SUPER_ADMIN' || userRole === 'HR';
  const canBatchExport = userRole === 'SUPER_ADMIN' || userRole === 'HR' || userRole === 'MANAGEMENT';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [appraisalsRes, statsRes] = await Promise.all([
        api.getAppraisals({
          cycleId: selectedCycleId,
          year: selectedYear,
          departmentId: selectedDepartmentId,
          status: selectedStatus,
          search: searchQuery,
          onlyMine,
        }),
        api.getAppraisalStats({
          cycleId: selectedCycleId,
          year: selectedYear,
          departmentId: selectedDepartmentId,
        }),
      ]);
      setAppraisals(appraisalsRes);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load appraisals data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCycleId, selectedYear, selectedDepartmentId, selectedStatus, searchQuery, onlyMine]);

  const currencySymbol = '₹';


  const toggleGuide = () => {
    setShowGuide((prev) => {
      try {
        localStorage.setItem('appr_show_guide', String(!prev));
      } catch {
        // storage unavailable: the toggle still works for this visit
      }
      return !prev;
    });
  };

  // Same rule the cards use to highlight "pending my action"
  const pendingMyAction = (appr: Appraisal) =>
    (appr.status === 'PENDING' && (appr.managerId === currentUser?.employeeId || appr.managerId === currentUser?.id)) ||
    (appr.status === 'MANAGER_RECOMMENDED' && appr.hodId === currentUser?.employeeId) ||
    (currentUser?.role === 'HR' && appr.status === 'HOD_CALIBRATED') ||
    (currentUser?.role === 'SUPER_ADMIN' && appr.status === 'HR_APPROVED');

  const matchesQuickView = (appr: Appraisal, view: AppraisalQuickView): boolean => {
    switch (view) {
      case 'MINE':
        return pendingMyAction(appr);
      case 'PENDING':
        return appr.status === 'PENDING';
      case 'WITH_HOD':
        return appr.status === 'MANAGER_RECOMMENDED';
      case 'WITH_HR':
        return appr.status === 'HOD_CALIBRATED';
      case 'APPROVED':
        return appr.status === 'HR_APPROVED';
      case 'LOCKED':
        return appr.status === 'LOCKED' || appr.status === 'COMPLETED' || appr.isLocked;
      default:
        return true;
    }
  };

  // Filtered appraisals according to hideInactive
  const baseAppraisals = appraisals.filter((a) => {
    if (hideInactive && a.employeeStatus === 'INACTIVE') return false;
    return true;
  });
  const quickViewCounts = Object.fromEntries(
    APPRAISAL_QUICK_VIEWS.map(({ key }) => [key, baseAppraisals.filter((a) => matchesQuickView(a, key)).length])
  ) as Record<AppraisalQuickView, number>;
  const displayedAppraisals = baseAppraisals.filter((a) => matchesQuickView(a, quickView));

  const hasDetailFilters =
    selectedCycleId !== 'ALL' || selectedYear !== 2026 || selectedDepartmentId !== 'ALL' || selectedStatus !== 'ALL';

  const clearAllFilters = () => {
    setSelectedCycleId('ALL');
    setSelectedYear(2026);
    setSelectedDepartmentId('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
    setHideInactive(false);
  };

  const activeFilterChips = [
    searchQuery.trim() && { key: 'search', label: `"${searchQuery.trim()}"`, clear: () => setSearchQuery('') },
    selectedCycleId !== 'ALL' && {
      key: 'cycle',
      label: cycles.find((c) => c.id === selectedCycleId)?.name || 'Cycle',
      clear: () => setSelectedCycleId('ALL'),
    },
    selectedYear !== 2026 && { key: 'year', label: `FY ${selectedYear}`, clear: () => setSelectedYear(2026) },
    selectedDepartmentId !== 'ALL' && {
      key: 'dept',
      label: departments.find((d) => d.id === selectedDepartmentId)?.name || 'Department',
      clear: () => setSelectedDepartmentId('ALL'),
    },
    selectedStatus !== 'ALL' && {
      key: 'status',
      label: APPRAISAL_STATUS_LABELS[selectedStatus] || selectedStatus,
      clear: () => setSelectedStatus('ALL'),
    },
    hideInactive && { key: 'inactive', label: 'Hide inactive', clear: () => setHideInactive(false) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  // Quick single PDF download helper
  const handleQuickDownloadPdf = async (appraisal: Appraisal, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingPdfId(appraisal.id);
    try {
      await downloadAppraisalPdf(appraisal);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setSelectedAppraisalForLetter(appraisal);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const getAppraisalStatusBadge = (status: string, hodId?: string, hodReturn?: Appraisal['hodReturn']) => {
    switch (status) {
      case 'PENDING':
        if (hodReturn) {
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 cursor-help"
              title={`Returned by ${hodReturn.returnedByName}: ${hodReturn.reason}`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>HOD returned</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Pending mgr</span>
          </span>
        );
      case 'MANAGER_RECOMMENDED':
        if (!hodId) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>No HOD assigned</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Mgr recommended</span>
          </span>
        );
      case 'HOD_CALIBRATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>HOD calibrated</span>
          </span>
        );
      case 'HR_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>HR approved</span>
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-900 dark:border-slate-100">
            <Lock className="w-3 h-3" />
            <span>Locked & released</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appraisals and increments"
        description="Yearly rollups of quarterly scores, increment proposals for each cohort, and appraisal letters."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} iconSpin={isLoading} onClick={loadData} title="Refresh" aria-label="Refresh appraisals" />
            {canBatchExport && (
              <Button icon={Archive} onClick={() => setIsBatchExportModalOpen(true)} title="Export letters as PDFs or a ZIP, plus the payroll sheet">
                Export letters
              </Button>
            )}
            {canInitiate && (
              <Button variant="primary" icon={Plus} onClick={() => setIsInitiateModalOpen(true)}>
                Start appraisal cohort
              </Button>
            )}
          </>
        }
      />

      {/* Summary line; the increment guide opens from its toggle */}
      {stats && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
          <span>
            <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.total}</strong> in cohort ({stats.locked} locked)
          </span>
          <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
          <span>
            Avg score <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{(stats.averageScore ?? 0).toFixed(2)}</strong> / 5
          </span>
          <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
          <span>
            Avg increment <strong className="text-base font-semibold text-emerald-700 dark:text-emerald-400">+{stats.averageIncrement}%</strong>
          </span>
          <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
          <span>
            CTC revision{' '}
            <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">
              +{currencySymbol}{((stats.totalIncrementBudgetImpact ?? 0) / 100000).toFixed(2)}L
            </strong>
          </span>
          <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
          <span>
            <strong className="text-base font-semibold text-indigo-800 dark:text-indigo-300">{stats.promotionsCount}</strong> promotions
          </span>
          <button
            type="button"
            onClick={toggleGuide}
            aria-expanded={showGuide}
            aria-controls="appr-increment-guide"
            className="sm:ml-auto inline-flex items-center gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {showGuide ? 'Hide increment guide' : 'Show increment guide'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showGuide && (
          <m.div
            id="appr-increment-guide"
            key="guide"
            variants={accordionVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-3 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Increment guide by rating band:</span>
              <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-md text-[11px] font-medium">
                <strong className="font-semibold">Outstanding (4.50+):</strong> 15% - 20%
              </span>
              <span className="px-2.5 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 rounded-md text-[11px] font-medium">
                <strong className="font-semibold">Exceeds (3.80 - 4.49):</strong> 10% - 14%
              </span>
              <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-md text-[11px] font-medium">
                <strong className="font-semibold">Meets (2.80 - 3.79):</strong> 5% - 9%
              </span>
              <span className="px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-md text-[11px] font-medium">
                <strong className="font-semibold">Improvement (&lt;2.80):</strong> 0% - 4%
              </span>
            </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Filters: search, quick views, and the detailed filters behind "Filters" */}
      <div className="bg-white dark:bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, code or title"
                aria-label="Search employees"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`h-8 px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showFilters || hasDetailFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Cycle Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Cycle
              </label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All cycles</option>
                {cycles.filter((c) => c.active !== false).map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {c.name} (Month {c.appraisalMonth})
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Fiscal year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value={2026} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">2026 (Current)</option>
                <option value={2025} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">2025</option>
                <option value={2027} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">2027</option>
              </select>
            </div>

            {/* Department Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Department
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Workflow status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All statuses</option>
                <option value="PENDING" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Pending manager</option>
                <option value="MANAGER_RECOMMENDED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Manager recommended</option>
                <option value="HOD_CALIBRATED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">HOD calibrated</option>
                <option value="HR_APPROVED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">HR approved</option>
                <option value="LOCKED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Locked & released</option>
              </select>
            </div>
          </div>
        )}

        {/* Quick views: one click per stage, with live counts */}
        <div role="group" aria-label="Quick views" className="flex flex-wrap items-center gap-1.5">
          {APPRAISAL_QUICK_VIEWS.map(({ key, label }) => {
            const isActive = quickView === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setQuickView(key)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {label}
                <span className={`tabular-nums text-[11px] ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  {quickViewCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active filters, each removable */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Filtered by:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {chip.label}
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 font-medium text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Appraisals Data List */}
      <div className="bg-white dark:bg-[#121215] rounded-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Header with Title, Count, and View Mode Switcher */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#18181d]/50">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Appraisal candidates & compensation records
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {displayedAppraisals.length} {displayedAppraisals.length === 1 ? 'Record' : 'Records'}
              {hideInactive && ` (${appraisals.length - displayedAppraisals.length} inactive hidden)`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Hide Inactive Toggle */}
            <button
              type="button"
              onClick={() => setHideInactive(!hideInactive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                hideInactive
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold'
                  : 'bg-white dark:bg-[#18181d] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Hide inactive</span>
            </button>
            {/* View Mode Switcher (Cards vs Table) — hidden on mobile since cards are forced there */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-[#18181d] text-indigo-700 dark:text-indigo-400 font-bold border border-slate-200/50 dark:border-white/[0.08]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#18181d] text-indigo-700 dark:text-indigo-400 font-bold border border-slate-200/50 dark:border-white/[0.08]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {isLoading && appraisals.length === 0 ? (
          <div className="p-4">
            <PageSkeletonLoader variant="table" rowCount={6} />
          </div>
        ) : displayedAppraisals.length === 0 ? (
          <div className="py-16 text-center space-y-4 max-w-sm mx-auto">
            <Award className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">No appraisals found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No active appraisal records match your filters. Click "initiate appraisal cohort" to batch generate appraisals for employees in their designated appraisal month.
              </p>
            </div>
            {canInitiate && (
              <button
                onClick={() => setIsInitiateModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Initiate appraisal cycle
              </button>
            )}
          </div>
        ) : effectiveViewMode === 'cards' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-[#0c0c0e]/60">
            {displayedAppraisals.map((appr) => {
              const incPct = appr.approvedIncrementPercentage ?? appr.proposedIncrementPercentage ?? appr.incrementPercentage ?? 0;
              const currentCtc = appr.currentCtc || 0;
              const revisedCtc = appr.revisedCtc || (currentCtc + Math.round((currentCtc * incPct) / 100));
              const isEligibleForLetter = appr.status === 'HR_APPROVED' || appr.status === 'LOCKED' || appr.isLocked;
              // Checked against the actual manager/HOD relationship on the appraisal, not the
              // caller's stored account-level role label, so a person holding both capacities
              // for this employee is flagged for both pending stages.
              const isPendingMyAction = pendingMyAction(appr);

              return (
                <div
                  key={appr.id}
                  onClick={() => setSelectedAppraisalForDetail(appr)}
                  className={`bg-white dark:bg-[#18181d] rounded-xl border p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-4 group ${
                    isPendingMyAction ? 'border-indigo-400 dark:border-indigo-500/50 ring-2 ring-indigo-500/10 dark:ring-indigo-500/20' : 'border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]'
                  }`}
                >
                  {/* Top: Identity & Status */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: appr.cycleColor || '#4f46e5' }}
                        >
                          {appr.employeeName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {appr.employeeName}
                            </h4>
                            <EmployeeStatusBadge status={appr.employeeStatus} />
                            {(appr.promotionRecommended || appr.promotedDesignationName) && (
                              <span className="text-[11px] px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded font-bold flex items-center gap-0.5">
                                <Briefcase className="w-2.5 h-2.5" /> Promoted
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {appr.employeeCode} • {appr.designationName}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0">{getAppraisalStatusBadge(appr.status, appr.hodId, appr.hodReturn)}</span>
                    </div>

                    {/* Department & Cycle Info */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1 truncate max-w-[140px]">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">{appr.departmentName}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <CycleBadge code={appr.cycleCode || appr.cycleName?.replace('Cycle ', '')} />
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">M{appr.appraisalMonth}</span>
                      </div>
                    </div>

                    {/* Performance & Score Box */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold block">
                            4-Qtr Rolling Score
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                              {appr.averageQuarterlyScore.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">/ 5.00</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold block">
                            Rating band
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border inline-block mt-0.5 ${
                              appr.averageQuarterlyScore <= 0 || (!appr.finalRating && (!appr.recommendedRating || appr.recommendedRating === 'PENDING'))
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                : appr.averageQuarterlyScore >= 4.5
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : appr.averageQuarterlyScore >= 3.8
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : appr.averageQuarterlyScore >= 2.8
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            {(appr.finalRating || appr.recommendedRating || 'PENDING').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            appr.averageQuarterlyScore >= 4.5
                              ? 'bg-emerald-500'
                              : appr.averageQuarterlyScore >= 3.8
                              ? 'bg-blue-500'
                              : appr.averageQuarterlyScore >= 2.8
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (appr.averageQuarterlyScore / 5) * 100)}%` }}
                        />
                      </div>

                      {/* Compensation revision row */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Revised CTC</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums line-through">
                              {currencySymbol}{(currentCtc / 100000).toFixed(2)}L
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                              → {currencySymbol}{(revisedCtc / 100000).toFixed(2)}L
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block">Increment</span>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {incPct > 0 ? (
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 tabular-nums">
                                +{incPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quarters Pills (if available) */}
                      {appr.quarterlyHistory && appr.quarterlyHistory.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">4-Qtr Breakdown:</span>
                          <div className="flex items-center gap-1 tabular-nums">
                            {appr.quarterlyHistory.map((q, idx) => {
                              const qTitle = q.quarter ? `Q${q.quarter}` : (q.periodName || q.reviewPeriodName || `Q${idx + 1}`);
                              const qShort = q.quarter ? `Q${q.quarter}` : (q.periodName?.slice(-2) || `Q${idx + 1}`);
                              return (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-semibold text-[11px]"
                                  title={`${qTitle}: ${q.score ? q.score.toFixed(2) : '--'}`}
                                >
                                  {qShort}:{q.score ? q.score.toFixed(1) : '--'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-1 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {isEligibleForLetter && (
                        <>
                          <button
                            type="button"
                            disabled={downloadingPdfId === appr.id}
                            onClick={(e) => handleQuickDownloadPdf(appr, e)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                            title="Download Official PDF Letter"
                          >
                            {downloadingPdfId === appr.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedAppraisalForLetter(appr)}
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 rounded-xl transition-colors cursor-pointer"
                            title="View Appraisal Letterhead Document"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedAppraisalForDetail(appr)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        isPendingMyAction
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>
                        {appr.status === 'PENDING' && (appr.managerId === currentUser?.employeeId || appr.managerId === currentUser?.id)
                          ? 'Recommend Increment'
                          : appr.status === 'MANAGER_RECOMMENDED' && appr.hodId === currentUser?.employeeId
                          ? 'Calibrate Increment'
                          : currentUser?.role === 'HR' && appr.status === 'HOD_CALIBRATED'
                          ? 'Review & Approve'
                          : currentUser?.role === 'SUPER_ADMIN' && appr.status === 'HR_APPROVED'
                          ? 'Final Lock'
                          : 'View Appraisal'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain max-h-[70vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/95 dark:bg-[#18181d]/95 border-b border-slate-200/80 dark:border-white/[0.06]">
                <tr className="text-slate-600 dark:text-slate-300 font-semibold">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-3">Cycle</th>
                  <th className="py-3.5 px-3 text-center">4-Qtr Rolling Score</th>
                  <th className="py-3.5 px-3">Rating band</th>
                  <th className="py-3.5 px-3 text-right">Current CTC</th>
                  <th className="py-3.5 px-3 text-right">Increment %</th>
                  <th className="py-3.5 px-3 text-right">Revised CTC</th>
                  <th className="py-3.5 px-3 text-center">Workflow stage</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
                {displayedAppraisals.map((appr) => {
                  const incPct = appr.approvedIncrementPercentage ?? appr.proposedIncrementPercentage ?? 0;
                  const currentCtc = appr.currentCtc || 0;
                  const revisedCtc = appr.revisedCtc || (currentCtc + Math.round((currentCtc * incPct) / 100));
                  const isEligibleForLetter = appr.status === 'HR_APPROVED' || appr.status === 'LOCKED' || appr.isLocked;

                  return (
                    <tr
                      key={appr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => setSelectedAppraisalForDetail(appr)}
                    >
                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {appr.employeeName}
                            </span>
                            <EmployeeStatusBadge status={appr.employeeStatus} />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                            <span>{appr.employeeCode}</span>
                            <span>•</span>
                            <span>{appr.designationName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">{appr.departmentName}</div>
                        </div>
                      </td>

                      {/* Cycle */}
                      <td className="py-3.5 px-3">
                        <CycleBadge code={appr.cycleCode || appr.cycleName?.replace('Cycle ', '')} />
                      </td>

                      {/* 4-Quarter Rolling Score */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="tabular-nums font-bold text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {appr.averageQuarterlyScore.toFixed(2)}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {appr.quarterlyHistory?.length || 4} Quarters
                          </span>
                        </div>
                      </td>

                      {/* Rating Band */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border inline-block ${
                              appr.averageQuarterlyScore <= 0 || (!appr.finalRating && (!appr.recommendedRating || appr.recommendedRating === 'PENDING'))
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                : appr.averageQuarterlyScore >= 4.5
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : appr.averageQuarterlyScore >= 3.8
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : appr.averageQuarterlyScore >= 2.8
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            {(appr.finalRating || appr.recommendedRating || 'PENDING').replace(/_/g, ' ')}
                          </span>
                          {appr.promotionRecommended && (
                            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-500" />
                              <span>Promoted</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Current CTC */}
                      <td className="py-3.5 px-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {appr.currency || '₹'}{currentCtc.toLocaleString()}
                      </td>

                      {/* Increment % */}
                      <td className="py-3.5 px-3 text-right">
                        {incPct > 0 ? (
                          <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800">
                            +{incPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="tabular-nums text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            --
                          </span>
                        )}
                      </td>

                      {/* Revised CTC */}
                      <td className="py-3.5 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        {appr.currency || '₹'}{revisedCtc.toLocaleString()}
                      </td>

                      {/* Workflow Stage */}
                      <td className="py-3.5 px-3 text-center">
                        {getAppraisalStatusBadge(appr.status, appr.hodId, appr.hodReturn)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isEligibleForLetter && (
                            <>
                              {/* Direct PDF Download Button */}
                              <button
                                type="button"
                                disabled={downloadingPdfId === appr.id}
                                onClick={(e) => handleQuickDownloadPdf(appr, e)}
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Download Official PDF Letter (.pdf)"
                              >
                                {downloadingPdfId === appr.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>

                              {/* View Full Letter Modal */}
                              <button
                                type="button"
                                onClick={() => setSelectedAppraisalForLetter(appr)}
                                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                title="View Appraisal Letterhead Document"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedAppraisalForDetail(appr)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            <span>
                              {appr.status === 'PENDING' && (appr.managerId === currentUser?.employeeId || appr.managerId === currentUser?.id)
                                ? 'Recommend Increment'
                                : appr.status === 'MANAGER_RECOMMENDED' && appr.hodId === currentUser?.employeeId
                                ? 'Calibrate'
                                : currentUser?.role === 'HOD'
                                ? 'View'
                                : currentUser?.role === 'SUPER_ADMIN' && appr.status === 'HR_APPROVED'
                                ? 'Final Lock'
                                : 'Review / Calibrate'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Initiate Appraisal Cycle Modal */}
      {isInitiateModalOpen && (
        <InitiateAppraisalModal
          cycles={cycles}
          employees={employees}
          onClose={() => setIsInitiateModalOpen(false)}
          onSuccess={() => {
            setIsInitiateModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Batch Letter Export Modal */}
      {isBatchExportModalOpen && (
        <BatchLetterExportModal
          appraisals={appraisals}
          departments={departments}
          cycles={cycles}
          onClose={() => setIsBatchExportModalOpen(false)}
        />
      )}

      {/* Detail / Multi-stage Calibration Modal */}
      {selectedAppraisalForDetail && (
        <AppraisalDetailModal
          appraisal={selectedAppraisalForDetail}
          currentUser={currentUser}
          designations={designations}
          onClose={() => setSelectedAppraisalForDetail(null)}
          onRefresh={() => {
            setSelectedAppraisalForDetail(null);
            loadData();
          }}
        />
      )}

      {/* Printable Appraisal Letter Modal */}
      {selectedAppraisalForLetter && (
        <AppraisalLetterModal
          appraisal={selectedAppraisalForLetter}
          onClose={() => setSelectedAppraisalForLetter(null)}
        />
      )}
    </div>
  );
};
