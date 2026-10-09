import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Layers,
  BarChart3,
  FileCheck,
  Award,
  Download,
  Users,
  Target,
  Sparkles,
  Upload,
  Shield,
  ClipboardList,
  Bell,
} from 'lucide-react';
import type { AppView } from '../hooks/useUrlHashView';
import type { UserRole } from '../types';

export interface NavItemConfig {
  id: AppView;
  /** Sidebar section heading (also used as the Header breadcrumb "group"). */
  group: 'Work' | 'People' | 'Configuration' | 'System';
  /** MobileNavDrawer's two-section split — distinct from `group` because the mobile
   *  drawer intentionally groups by "how often you'd reach for this" rather than by
   *  the desktop sidebar's topical taxonomy. */
  mobileSection: 'primary' | 'admin';
  /** false hides the item from the desktop Sidebar entirely (e.g. Notifications, which
   *  only lives in the Header bell + mobile drawer). Defaults to true. */
  inSidebar?: boolean;
  label: string | ((role?: UserRole) => string);
  /** Mobile drawer only — a one-line description under the label. */
  subtitle?: string | ((role?: UserRole) => string);
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
  isAiBadge?: boolean;
}

/**
 * Single source of truth for every routable nav destination: which roles can see it,
 * what it's labelled, which icon it uses, and which section it belongs to on desktop vs
 * mobile. `Sidebar.tsx`, `MobileNavDrawer.tsx`, `Header.tsx` (breadcrumb), and
 * `useUrlHashView.ts` (role-permission gating + valid-hash list) all derive from this
 * list instead of each hand-maintaining their own copy — that duplication is exactly
 * what let a nav item exist in one place but not the role-permission list in another
 * (the 'pip' view briefly wasn't in ROLE_ALLOWED_VIEWS for HOD/Manager despite having a
 * working Sidebar entry). Add or change a destination here once; every surface picks it
 * up automatically.
 */
export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    group: 'Work',
    mobileSection: 'primary',
    label: 'Dashboard',
    subtitle: 'Your tasks, your review and your team',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'HR', 'REPORTING_MANAGER', 'MANAGER', 'HOD', 'EMPLOYEE'],
  },
  {
    id: 'management',
    group: 'Work',
    mobileSection: 'primary',
    label: 'Organization overview',
    subtitle: 'Progress, departments and trends across the organization',
    icon: BarChart3,
    roles: ['MANAGEMENT'],
  },
  {
    id: 'reviews',
    group: 'Work',
    mobileSection: 'primary',
    label: (role) => (role === 'EMPLOYEE' ? 'My reviews' : 'Quarterly reviews'),
    subtitle: 'Score KRAs and track review progress',
    icon: FileCheck,
    roles: ['SUPER_ADMIN', 'HR', 'REPORTING_MANAGER', 'MANAGER', 'HOD', 'EMPLOYEE'],
  },
  {
    id: 'appraisals',
    group: 'Work',
    mobileSection: 'primary',
    label: 'Annual appraisals',
    subtitle: 'Calibrate cohorts and propose increments',
    icon: Award,
    roles: ['SUPER_ADMIN', 'HR', 'HOD', 'REPORTING_MANAGER', 'MANAGER'],
  },
  {
    id: 'calibration',
    group: 'Work',
    mobileSection: 'primary',
    label: 'Bell curve and budget',
    subtitle: 'Rating distribution and department budgets',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'],
  },
  {
    id: 'reports',
    group: 'Work',
    mobileSection: 'primary',
    label: 'Reports',
    subtitle: 'Distributions, trends and exports',
    icon: Download,
    roles: ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'],
  },
  {
    id: 'employees',
    group: 'People',
    mobileSection: 'admin',
    label: 'Employees',
    subtitle: 'Profiles and employment details',
    icon: Users,
    roles: ['SUPER_ADMIN', 'HR'],
  },
  {
    id: 'hierarchy',
    group: 'People',
    mobileSection: 'admin',
    label: 'Departments',
    subtitle: 'Departments, HODs and reporting lines',
    icon: Layers,
    roles: ['SUPER_ADMIN', 'HR', 'HOD', 'MANAGEMENT'],
  },
  {
    id: 'pip',
    group: 'People',
    mobileSection: 'admin',
    label: 'Improvement plans',
    subtitle: 'Plans, goals and check-ins',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'HR', 'HOD', 'REPORTING_MANAGER', 'MANAGER', 'EMPLOYEE'],
  },
  {
    id: 'kras',
    group: 'Configuration',
    mobileSection: 'admin',
    label: 'KRA templates',
    subtitle: 'Standard goals and their weightings',
    icon: Target,
    roles: ['SUPER_ADMIN', 'HR'],
  },
  {
    id: 'ai_performance',
    group: 'Configuration',
    mobileSection: 'primary',
    label: 'AI review assistant',
    subtitle: 'Draft review summaries and talent insights',
    icon: Sparkles,
    roles: ['SUPER_ADMIN'],
    isAiBadge: true,
  },
  {
    id: 'bulk',
    group: 'System',
    mobileSection: 'admin',
    label: 'Import and export',
    subtitle: 'Move master data in and out with Excel or CSV',
    icon: Upload,
    roles: ['SUPER_ADMIN', 'HR'],
  },
  {
    id: 'audit',
    group: 'System',
    mobileSection: 'admin',
    label: (role) => (role === 'HR' ? 'Appraisal history' : 'Audit trail'),
    subtitle: (role) => (role === 'HR' ? 'How each appraisal changed over time' : 'Who changed what, and when'),
    icon: Shield,
    roles: ['SUPER_ADMIN', 'HR'],
  },
  {
    id: 'notifications',
    group: 'System',
    mobileSection: 'primary',
    inSidebar: false,
    label: 'Notifications',
    subtitle: 'Tasks and email delivery',
    icon: Bell,
    roles: ['SUPER_ADMIN', 'HR', 'REPORTING_MANAGER', 'MANAGER', 'HOD', 'EMPLOYEE', 'MANAGEMENT'],
  },
];

export function getNavLabel(item: NavItemConfig, role?: UserRole): string {
  return typeof item.label === 'function' ? item.label(role) : item.label;
}

export function getNavSubtitle(item: NavItemConfig, role?: UserRole): string | undefined {
  return typeof item.subtitle === 'function' ? item.subtitle(role) : item.subtitle;
}

export function isNavItemVisible(item: NavItemConfig, role?: UserRole): boolean {
  return !role || item.roles.includes(role);
}

/** The view a role lands on after login, and the fallback when a view isn't permitted. */
export function getHomeView(role?: UserRole): AppView {
  if (role === 'MANAGEMENT') return 'management';
  return 'dashboard';
}
