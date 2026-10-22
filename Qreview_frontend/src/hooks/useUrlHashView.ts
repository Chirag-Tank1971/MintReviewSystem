import { useState, useEffect, useCallback, useTransition } from 'react';
import type { UserRole } from '../types';

export type AppView =
  | 'dashboard'
  | 'management'
  | 'ai_performance'
  | 'appraisals'
  | 'calibration'
  | 'reviews'
  | 'kras'
  | 'employees'
  | 'hierarchy'
  | 'reports'
  | 'bulk'
  | 'audit'
  | 'notifications'
  | 'pip'
  | 'sales_champs';

// NAV_ITEMS (frontend/src/config/navigation.ts) is the single source of truth for which
// roles can reach which view — VALID_VIEWS and ROLE_ALLOWED_VIEWS are both derived from it
// so a nav item can never exist in the Sidebar/MobileNavDrawer without also being
// permission-gated here (that exact drift — an item visible in the nav but missing from
// this file's role list — was a real bug earlier in this app's life).
//
// Imported lazily (require-style via a getter) would be overkill; a plain top-level import
// is safe here because navigation.ts only imports AppView/UserRole as `import type`, which
// is erased at compile time, so there's no real circular runtime dependency.
import { NAV_ITEMS } from '../config/navigation';

const VALID_VIEWS: AppView[] = NAV_ITEMS.map((item) => item.id);

const ALL_ROLES: UserRole[] = ['SUPER_ADMIN', 'HR', 'REPORTING_MANAGER', 'MANAGER', 'HOD', 'EMPLOYEE', 'MANAGEMENT'];

const ROLE_ALLOWED_VIEWS: Record<string, AppView[]> = ALL_ROLES.reduce((acc, role) => {
  acc[role] = NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => item.id);
  return acc;
}, {} as Record<string, AppView[]>);

export function isViewPermitted(view: AppView, role?: string): boolean {
  if (!role) return true;
  const allowed = ROLE_ALLOWED_VIEWS[role];
  return allowed ? allowed.includes(view) : true;
}

function getInitialView(): AppView {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  const raw = path || hash;

  if (raw === 'portal') return 'dashboard';
  if (VALID_VIEWS.includes(raw as AppView)) {
    return raw as AppView;
  }
  return 'dashboard';
}

export function useUrlHashView() {
  const [currentView, setCurrentViewState] = useState<AppView>(getInitialView);
  // Marks a navigation as low-priority so React keeps the outgoing view on screen until the
  // next (possibly lazy-loaded) view is ready, and reports that wait back as `isPending` — the
  // signal a top loading bar can key off without any timers or polling of its own.
  const [isPending, startTransition] = useTransition();

  // Sync pathname when view changes
  const setView = useCallback((view: AppView, replaceHistory = false) => {
    startTransition(() => {
      setCurrentViewState(view);
    });
    const newPath = `/${view}`;
    if (window.location.pathname !== newPath || window.location.hash) {
      if (replaceHistory) {
        window.history.replaceState(null, '', newPath);
      } else {
        window.history.pushState(null, '', newPath);
      }
    }
  }, []);

  // Listen to browser Back/Forward (popstate) & legacy hashchange
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      const raw = path || hash;

      startTransition(() => {
        if (raw === 'portal') {
          setCurrentViewState('dashboard');
        } else if (VALID_VIEWS.includes(raw as AppView)) {
          setCurrentViewState(raw as AppView);
        } else {
          setCurrentViewState('dashboard');
        }
      });
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  return { currentView, setView, isPending };
}
