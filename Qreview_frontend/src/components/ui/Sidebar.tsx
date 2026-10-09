import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppView } from '../../hooks/useUrlHashView';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import { cn } from '../../utils/cn';
import { NAV_ITEMS, getNavLabel, isNavItemVisible, NavItemConfig } from '../../config/navigation';

interface SidebarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  className?: string;
}

interface NavGroup {
  title: string;
  items: NavItemConfig[];
}

const GROUP_ORDER: NavItemConfig['group'][] = ['Work', 'People', 'Configuration', 'System'];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  className = '',
}) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('appraisal_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('appraisal_sidebar_collapsed', String(next));
      } catch {
        // quiet fallback
      }
      return next;
    });
  };

  const role = user?.role;

  const navGroups: NavGroup[] = GROUP_ORDER.map((title) => ({
    title,
    items: NAV_ITEMS.filter(
      (item) => item.group === title && item.inSidebar !== false && isNavItemVisible(item, role)
    ),
  })).filter((group) => group.items.length > 0);

  // Wraps a control in a right-side tooltip while the sidebar is collapsed to icons only.
  const withTooltip = (key: string, label: string, control: React.ReactElement) =>
    isCollapsed ? (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="right">
          <span>{label}</span>
        </TooltipContent>
      </Tooltip>
    ) : (
      control
    );

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-[width] duration-150 z-30 select-none',
          isCollapsed ? 'w-14' : 'w-56',
          className
        )}
      >
        <nav aria-label="Main" className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2.5 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{group.title}</div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                const label = getNavLabel(item, role);

                return withTooltip(
                  item.id,
                  label,
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectView(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={isCollapsed ? label : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                      isCollapsed && 'justify-center',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'
                      )}
                    />
                    {!isCollapsed && <span className="truncate flex-1 text-left">{label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Signed-in user, sign out and collapse */}
        {user && (
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-1">
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-1.5 py-1">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center text-xs shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="truncate flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.role}</div>
                </div>
              </div>
            )}

            <div className={cn('flex gap-1', isCollapsed && 'flex-col')}>
              {withTooltip(
                'logout',
                'Sign out',
                <button
                  type="button"
                  onClick={() => logout()}
                  aria-label="Sign out"
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    isCollapsed && 'justify-center'
                  )}
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  {!isCollapsed && <span>Sign out</span>}
                </button>
              )}
              {withTooltip(
                'collapse',
                isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
                <button
                  type="button"
                  onClick={toggleCollapse}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="flex items-center justify-center p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
};
