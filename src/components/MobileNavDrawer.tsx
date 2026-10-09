import React from 'react';
import { createPortal } from 'react-dom';
import {
  Shield,
  Sparkles,
  X,
  LogOut,
  Moon,
  Sun,
  Building2,
  Briefcase,
  Layers,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { NAV_ITEMS, NavItemConfig, getNavLabel, getNavSubtitle, isNavItemVisible } from '../config/navigation';
import { useModalAnimation } from '../hooks/useModalAnimation';

import { AppLogo } from './ui/AppLogo';
interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onSelectView: (view: string) => void;
}

const ROLE_CONFIGS: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: Shield },
  HR: { label: 'HR Manager', icon: UserCheck },
  MANAGER: { label: 'Reporting Manager', icon: Briefcase },
  REPORTING_MANAGER: { label: 'Reporting Manager', icon: Briefcase },
  HOD: { label: 'Dept Head (HOD)', icon: Building2 },
  EMPLOYEE: { label: 'Employee', icon: Layers },
  MANAGEMENT: { label: 'Executive Management', icon: Sparkles },
};

const QUICK_PERSONAS = [
  { role: 'SUPER_ADMIN' as UserRole, name: 'System Admin', title: 'Admin', userId: 'usr_sa' },
  { role: 'HR' as UserRole, name: 'HR Manager', title: 'HR', userId: 'usr_mgr_hr' },
  { role: 'MANAGER' as UserRole, name: 'Dave Manager', title: 'Manager', userId: 'usr_mgr_eng' },
  { role: 'HOD' as UserRole, name: 'Alice HOD', title: 'HOD', userId: 'usr_hod_eng' },
  { role: 'EMPLOYEE' as UserRole, name: 'Grace Engineer', title: 'Employee', userId: 'usr_com_1' },
];

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  onSelectView,
}) => {
  const { isMounted, handleClose, backdropClass, drawerLeftClass } = useModalAnimation({
    isOpen,
    onClose,
  });

  const { user, logout, switchRole, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isMounted) return null;
  if (typeof document === 'undefined') return null;

  const userRole = user?.role;
  const currentRoleConfig = user ? ROLE_CONFIGS[user.role] : ROLE_CONFIGS.EMPLOYEE;
  const RoleIcon = currentRoleConfig.icon;

  // Both lists derive from the shared NAV_ITEMS registry (frontend/src/config/navigation.ts)
  // instead of hand-duplicating labels/icons/roles here — see that file's header comment for why.
  const visibleNavItems = NAV_ITEMS.filter((item) => isNavItemVisible(item, userRole));
  const primaryNavItems = visibleNavItems.filter((item) => item.mobileSection === 'primary');
  const adminNavItems = visibleNavItems.filter((item) => item.mobileSection === 'admin');

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    handleClose();
  };

  const renderItem = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
        }`}
      >
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight flex items-center gap-1.5">
            <span>{getNavLabel(item, userRole)}</span>
            {item.isAiBadge && (
              <span className="text-[11px] font-medium px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">AI</span>
            )}
          </div>
          <div className={`text-xs leading-snug mt-0.5 ${isActive ? 'text-indigo-700/80 dark:text-indigo-300/80' : 'text-slate-500 dark:text-slate-400'}`}>
            {getNavSubtitle(item, userRole)}
          </div>
        </div>
      </button>
    );
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9998] flex bg-slate-950/60 dark:bg-slate-950/80 ${backdropClass}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`w-[85vw] max-w-sm bg-white dark:bg-slate-900 h-full shadow-xl flex flex-col border-r border-slate-200 dark:border-slate-800 overflow-hidden ${drawerLeftClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo className="w-7 h-7" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">MintReview</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Signed-in user */}
        {user && (
          <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-medium text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <RoleIcon className="w-3 h-3" />
                  {currentRoleConfig.label}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          </div>
        )}

        {/* Menu items */}
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="px-2.5 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Main</div>
            <div className="space-y-0.5">{primaryNavItems.map(renderItem)}</div>
          </div>

          {adminNavItems.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="px-2.5 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Administration</div>
              <div className="space-y-0.5">{adminNavItems.map(renderItem)}</div>
            </div>
          )}

          {/* Demo role switcher (development / demo builds only) */}
          {(!import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO_PERSONAS === 'true') && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="px-2.5 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Switch role (demo)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PERSONAS.map((p) => {
                  const isCurrent = user?.role === p.role;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => {
                        switchRole(p.role, p.userId);
                        handleClose();
                      }}
                      disabled={isLoading}
                      className={`px-2.5 py-1.5 rounded-md text-left border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{p.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              handleClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-md text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
