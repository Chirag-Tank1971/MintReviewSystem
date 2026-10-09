import { useState, useEffect, Suspense, lazy } from 'react';
import { LazyMotion, MotionConfig, domMax } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { LoginModal } from './components/LoginModal';
import { ForcePasswordChangeScreen } from './components/ForcePasswordChangeScreen';
import { MobileNavDrawer } from './components/MobileNavDrawer';
import { ViewSkeletonFallback } from './components/ui/ViewSkeletonFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useMasterData } from './hooks/useMasterData';
import { useUrlHashView, AppView, isViewPermitted } from './hooks/useUrlHashView';
import { getHomeView } from './config/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Sidebar } from './components/ui/Sidebar';
import { KraTemplate, Employee } from './types';
import type { CustomKraRow } from './components/CustomKraScorecardModal';
import { ReviewViewConfig } from './components/QuarterlyReviewView';
import { AppraisalViewConfig } from './components/AppraisalManagementView';
import { ReportsViewConfig } from './components/ReportsCenterView';
import { PageLoadingProgress } from './components/ui/PageLoadingProgress';
import { PageTransition } from './components/ui/PageTransition';

// Route-level code splitting: Lazy load heavy domain views
const DashboardView = lazy(() =>
  import('./components/dashboard/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const QuarterlyReviewView = lazy(() =>
  import('./components/QuarterlyReviewView').then((m) => ({ default: m.QuarterlyReviewView }))
);
const AppraisalManagementView = lazy(() =>
  import('./components/AppraisalManagementView').then((m) => ({ default: m.AppraisalManagementView }))
);
const BellCurveBudgetAnalytics = lazy(() =>
  import('./components/BellCurveBudgetAnalytics').then((m) => ({ default: m.BellCurveBudgetAnalytics }))
);
const ReportsCenterView = lazy(() =>
  import('./components/ReportsCenterView').then((m) => ({ default: m.ReportsCenterView }))
);
const EmployeeDirectory = lazy(() =>
  import('./components/EmployeeDirectory').then((m) => ({ default: m.EmployeeDirectory }))
);
const KraManagementView = lazy(() =>
  import('./components/KraManagementView').then((m) => ({ default: m.KraManagementView }))
);
const AiPerformanceHub = lazy(() =>
  import('./components/AiPerformanceHub').then((m) => ({ default: m.AiPerformanceHub }))
);
const BulkImportExportManager = lazy(() =>
  import('./components/BulkImportExportManager').then((m) => ({ default: m.BulkImportExportManager }))
);
const AuditComplianceExplorer = lazy(() =>
  import('./components/AuditComplianceExplorer').then((m) => ({ default: m.AuditComplianceExplorer }))
);
const NotificationsCenterView = lazy(() =>
  import('./components/NotificationsCenterView').then((m) => ({ default: m.NotificationsCenterView }))
);
const ManagementDashboardView = lazy(() =>
  import('./components/ManagementDashboardView').then((m) => ({ default: m.ManagementDashboardView }))
);
const DepartmentHierarchyView = lazy(() =>
  import('./components/DepartmentHierarchyView').then((m) => ({ default: m.DepartmentHierarchyView }))
);
const PerformanceImprovementPlansView = lazy(() =>
  import('./components/PerformanceImprovementPlansView').then((m) => ({ default: m.PerformanceImprovementPlansView }))
);

// Modals lazy loaded on demand
const EmployeeModal = lazy(() =>
  import('./components/EmployeeModal').then((m) => ({ default: m.EmployeeModal }))
);
const KraTemplateBuilderModal = lazy(() =>
  import('./components/KraTemplateBuilderModal').then((m) => ({ default: m.KraTemplateBuilderModal }))
);
const KraLibraryModal = lazy(() =>
  import('./components/KraLibraryModal').then((m) => ({ default: m.KraLibraryModal }))
);
const AssignKraModal = lazy(() =>
  import('./components/AssignKraModal').then((m) => ({ default: m.AssignKraModal }))
);

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Synchronized URL Hash Navigation
  const { currentView, setView, isPending: isViewPending } = useUrlHashView();

  // View-specific configurations for direct workflow navigation
  const [dashboardConfig, setDashboardConfig] = useState<{ openLetter?: boolean } | null>(null);
  const [appraisalConfig, setAppraisalConfig] = useState<AppraisalViewConfig | null>(null);
  const [reviewConfig, setReviewConfig] = useState<ReviewViewConfig | null>(null);
  const [reportsConfig, setReportsConfig] = useState<ReportsViewConfig | null>(null);
  const [pipConfig, setPipConfig] = useState<{ pipId?: string } | null>(null);

  const homeView = getHomeView(user?.role);

  // With no hash in the URL, land on the role's home view.
  useEffect(() => {
    if (user?.role && (!window.location.hash || window.location.hash === '#')) {
      setView(homeView, true);
    }
  }, [user?.role, homeView, setView]);

  // Centralized Master Data via Custom Hook
  const {
    templates,
    kras,
    departments,
    designations,
    employees,
    cycles,
    refreshMasterData,
    saveTemplate,
    saveKra,
  } = useMasterData(isAuthenticated);

  // Hierarchy Employee Modal State
  const [isHierarchyEmpModalOpen, setIsHierarchyEmpModalOpen] = useState(false);
  const [hierarchyEditingEmployee, setHierarchyEditingEmployee] = useState<any>(null);

  // KRA Modals State
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [isKraLibraryOpen, setIsKraLibraryOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<KraTemplate | null>(null);

  // Assign/Edit Employee-Owned KRA Scorecard Modal State
  const [isAssignKraModalOpen, setIsAssignKraModalOpen] = useState(false);
  const [assignKraTargetEmployee, setAssignKraTargetEmployee] = useState<Employee | null>(null);
  const [assignKraInitialRows, setAssignKraInitialRows] = useState<CustomKraRow[]>([]);

  const canManageKras = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  const handleNavigate = (tab: string, options?: any) => {
    if (tab === 'portal') {
      if (options?.subTab === 'reviews' || options?.openSelfAssess) {
        setReviewConfig({ openSelfAssess: true, reviewId: options?.reviewId });
        setView('reviews');
        return;
      }
      if (options?.subTab === 'appraisal' || options?.openLetter) {
        setDashboardConfig({ openLetter: true });
        setView('dashboard');
        return;
      }
      setView('dashboard');
      return;
    }
    setDashboardConfig(tab === 'dashboard' ? options || null : null);
    setAppraisalConfig(tab === 'appraisals' ? options || null : null);
    setReviewConfig(tab === 'reviews' ? options || null : null);
    setReportsConfig(tab === 'reports' ? options || null : null);
    setPipConfig(tab === 'pip' ? options || null : null);
    setView(tab as AppView);
  };

  // Proactive Role-Based Access Control (RBAC) Guard for Views
  useEffect(() => {
    setDashboardConfig(null);
    setReviewConfig(null);
    setAppraisalConfig(null);
    setReportsConfig(null);
    setPipConfig(null);

    // If current view is not permitted for the user's role, automatically redirect to their home view
    if (user?.role && !isViewPermitted(currentView, user.role)) {
      setView(homeView, true);
    }
  }, [user?.id, user?.role, currentView, homeView, setView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
            Signing you in…
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // If logged in but must change password — show gate screen, block the whole app
  if (user?.mustChangePassword) {
    return <ForcePasswordChangeScreen />;
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Universal GPU-Accelerated Page Loading Bar */}
      <PageLoadingProgress active={isViewPending} />

      {/* Unified Enterprise Header */}
      <Header
        currentView={currentView}
        onSelectView={(v) => {
          setReviewConfig(null);
          setAppraisalConfig(null);
          setReportsConfig(null);
          setView(v as AppView);
        }}
        onNavigate={handleNavigate}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenMobileMenu={() => setIsMobileNavOpen(true)}
      />

      {/* Mobile Slide-Over Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentView={currentView}
        onSelectView={handleNavigate}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Persistent Desktop Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={handleNavigate}
        />

        <div className="flex flex-col flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden scroll-smooth">
          {/* Main Content Area - Full width enterprise canvas */}
          <main className="flex-1 w-full pl-2 sm:pl-3 pr-4 sm:pr-6 lg:pr-8 pt-4 pb-20 md:pb-10">
          {/* Notifications Return-to-Workspace Bar */}
          {currentView === 'notifications' && (
            <div className="mb-4">
              <button
                onClick={() => handleNavigate(homeView)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {homeView === 'dashboard' ? 'Dashboard' : homeView === 'management' ? 'Organization overview' : 'Workspace'}</span>
              </button>
            </div>
          )}

          {/* Lazy loaded domain view with fallback */}
          <ErrorBoundary>
            <Suspense fallback={<ViewSkeletonFallback />}>
              <PageTransition viewKey={currentView}>
                {currentView === 'dashboard' && user?.role !== 'MANAGEMENT' ? (
                  <DashboardView
                    onNavigate={(view, params) => handleNavigate(view, params)}
                    initialConfig={dashboardConfig}
                  />
                ) : currentView === 'management' && user?.role === 'MANAGEMENT' ? (
                  <ManagementDashboardView departments={departments} />
                ) : currentView === 'ai_performance' && user?.role === 'SUPER_ADMIN' ? (
                  <AiPerformanceHub currentUser={user} />
                ) : currentView === 'appraisals' && ['SUPER_ADMIN', 'HR', 'MANAGEMENT', 'HOD', 'REPORTING_MANAGER', 'MANAGER'].includes(user?.role || '') ? (
                  <AppraisalManagementView
                    currentUser={user}
                    departments={departments}
                    cycles={cycles}
                    designations={designations}
                    employees={employees}
                    initialConfig={appraisalConfig}
                    onClearInitialConfig={() => setAppraisalConfig(null)}
                  />
                ) : currentView === 'calibration' && ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'].includes(user?.role || '') ? (
                  <BellCurveBudgetAnalytics cycles={cycles} />
                ) : currentView === 'reviews' ? (
                  <QuarterlyReviewView
                    currentUser={user}
                    departments={departments}
                    cycles={cycles}
                    employees={employees}
                    initialConfig={reviewConfig}
                    onClearInitialConfig={() => setReviewConfig(null)}
                  />
                ) : currentView === 'reports' && ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'].includes(user?.role || '') ? (
                  <ReportsCenterView
                    departments={departments}
                    cycles={cycles}
                    initialConfig={reportsConfig}
                  />
                ) : currentView === 'bulk' && ['SUPER_ADMIN', 'HR'].includes(user?.role || '') ? (
                  <BulkImportExportManager onDataImported={refreshMasterData} />
                ) : currentView === 'audit' && ['SUPER_ADMIN', 'HR'].includes(user?.role || '') ? (
                  <AuditComplianceExplorer currentUser={user} />
                ) : currentView === 'notifications' ? (
                  <NotificationsCenterView
                    currentUser={user}
                    onNavigate={(tab, opts) => handleNavigate(tab as AppView, opts)}
                  />
                ) : currentView === 'pip' && ['SUPER_ADMIN', 'HR', 'HOD', 'REPORTING_MANAGER', 'MANAGER', 'EMPLOYEE'].includes(user?.role || '') ? (
                  <PerformanceImprovementPlansView
                    currentUser={user}
                    employees={employees}
                    departments={departments}
                    initialConfig={pipConfig}
                  />
                ) : currentView === 'kras' && ['SUPER_ADMIN', 'HR'].includes(user?.role || '') ? (
                  <KraManagementView
                    templates={templates}
                    kras={kras}
                    departments={departments}
                    employees={employees}
                    canManage={canManageKras}
                    onOpenCreateBlueprint={() => {
                      setEditingTemplate(null);
                      setIsTemplateBuilderOpen(true);
                    }}
                    onOpenCreateTemplate={() => {
                      // New scorecards are always employee-owned now — open the
                      // employee-picker + Custom Scorecard builder instead of the old
                      // department/designation-scoped template creator.
                      setAssignKraTargetEmployee(null);
                      setAssignKraInitialRows([]);
                      setIsAssignKraModalOpen(true);
                    }}
                    onOpenEditTemplate={(tmpl) => {
                      if (tmpl.employeeId) {
                        // Employee-owned scorecard — edit it through the same
                        // Custom Scorecard flow so orphan cleanup / ownership
                        // invariants stay consistent with the rest of the app.
                        const owner = employees.find((e) => e.id === tmpl.employeeId) || null;
                        setAssignKraTargetEmployee(owner);
                        setAssignKraInitialRows(
                          (tmpl.items || []).map((it, idx) => ({
                            id: it.id || `kra_existing_${idx}`,
                            title: it.title || '',
                            weight: it.weight ?? 0,
                            target: it.target || '100% Target SLA',
                            description: it.description,
                            measurementCriteria: it.measurementCriteria,
                          }))
                        );
                        setIsAssignKraModalOpen(true);
                      } else {
                        // Shared/library blueprint — keep the classic template editor.
                        setEditingTemplate(tmpl);
                        setIsTemplateBuilderOpen(true);
                      }
                    }}
                    onOpenLibrary={() => setIsKraLibraryOpen(true)}
                    onQuickAssign={(emp) => {
                      setAssignKraTargetEmployee(emp);
                      setAssignKraInitialRows([]);
                      setIsAssignKraModalOpen(true);
                    }}
                  />
                ) : currentView === 'employees' && ['SUPER_ADMIN', 'HR'].includes(user?.role || '') ? (
                  <EmployeeDirectory
                    currentUser={user}
                    departments={departments}
                    designations={designations}
                    cycles={cycles}
                    kraTemplates={templates}
                    onNavigateToAppraisals={(opts) => handleNavigate('appraisals', opts)}
                    onNavigateToReviews={(opts) => handleNavigate('reviews', opts)}
                    onNavigateToHierarchy={() => handleNavigate('hierarchy')}
                    employees={employees}
                  />
                ) : currentView === 'hierarchy' && ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'].includes(user?.role || '') ? (
                  <div className="space-y-6">
                    <DepartmentHierarchyView
                      employees={employees}
                      departments={departments}
                      isHRorAdmin={['SUPER_ADMIN', 'HR'].includes(user?.role || '')}
                      onEditEmployee={(emp) => {
                        setHierarchyEditingEmployee(emp);
                        setIsHierarchyEmpModalOpen(true);
                      }}
                      onAddEmployee={() => {
                        setHierarchyEditingEmployee(null);
                        setIsHierarchyEmpModalOpen(true);
                      }}
                      onBackToDirectory={() => handleNavigate('employees')}
                    />
                    <Suspense fallback={null}>
                      {isHierarchyEmpModalOpen && (
                        <EmployeeModal
                          isOpen={isHierarchyEmpModalOpen}
                          onClose={() => setIsHierarchyEmpModalOpen(false)}
                          onSaved={refreshMasterData}
                          employeeToEdit={hierarchyEditingEmployee}
                          departments={departments}
                          designations={designations}
                          cycles={cycles}
                          allEmployees={employees}
                          kraTemplates={templates}
                        />
                      )}
                    </Suspense>
                  </div>
                ) : (
                  <DashboardView
                    onNavigate={(view, params) => handleNavigate(view, params)}
                    initialConfig={dashboardConfig}
                  />
                )}
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
          </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 mt-auto mb-16 md:mb-0">
          <div className="w-full px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center">
            <span>MintReview</span>
          </div>
        </footer>
        </div>
      </div>

      {/* Modals */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      {/* KRA Modals with Suspense */}
      <Suspense fallback={null}>
        {isTemplateBuilderOpen && (
          <KraTemplateBuilderModal
            template={editingTemplate}
            departments={departments}
            designations={designations}
            kraLibrary={kras}
            onSave={saveTemplate}
            onClose={() => {
              setIsTemplateBuilderOpen(false);
              setEditingTemplate(null);
            }}
          />
        )}

        {isKraLibraryOpen && (
          <KraLibraryModal
            kras={kras}
            departments={departments}
            canEdit={canManageKras}
            onSaveKra={saveKra}
            onClose={() => setIsKraLibraryOpen(false)}
          />
        )}

        {isAssignKraModalOpen && (
          <AssignKraModal
            isOpen={isAssignKraModalOpen}
            onClose={() => {
              setIsAssignKraModalOpen(false);
              setAssignKraTargetEmployee(null);
              setAssignKraInitialRows([]);
            }}
            employees={employees}
            cycles={cycles}
            templates={templates}
            kraLibrary={kras}
            preselectedEmployee={assignKraTargetEmployee}
            initialKras={assignKraInitialRows}
            onAssigned={refreshMasterData}
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationsProvider>
            <LazyMotion features={domMax} strict={false}>
              <MotionConfig reducedMotion="user">
                <AppContent />
              </MotionConfig>
            </LazyMotion>
          </NotificationsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
