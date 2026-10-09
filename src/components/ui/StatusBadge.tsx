import React from 'react';
import { EmployeeStatus } from '../../types';
import { cn } from '../../utils/cn';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  showDot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const TONE_CLASSES: Record<Tone, string> = {
  default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  primary: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/60',
  success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  danger: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
  info: 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
};

const DOT_COLORS: Record<Tone, string> = {
  default: 'bg-slate-400',
  primary: 'bg-indigo-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

const SIZE_CLASSES = {
  sm: 'text-[11px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
  lg: 'text-sm px-2.5 py-1 gap-1.5',
};

/** The one status badge used across the app. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone = 'default',
  size = 'md',
  icon,
  showDot = true,
  className = '',
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center font-medium rounded-md border whitespace-nowrap select-none tabular-nums',
      SIZE_CLASSES[size],
      TONE_CLASSES[tone],
      className
    )}
  >
    {icon ? icon : showDot ? <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_COLORS[tone])} /> : null}
    <span>{children || status}</span>
  </span>
);

const EMPLOYEE_STATUS: Partial<Record<EmployeeStatus | string, { label: string; tone: Tone }>> = {
  INACTIVE: { label: 'Inactive', tone: 'danger' },
  NOTICE: { label: 'Serving notice', tone: 'warning' },
  PROBATION: { label: 'Probation', tone: 'info' },
};

interface EmployeeStatusBadgeProps {
  status?: EmployeeStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Flags an employee who isn't simply active; renders nothing for active employees. */
export const EmployeeStatusBadge: React.FC<EmployeeStatusBadgeProps> = ({ status, size = 'sm', className = '' }) => {
  const config = status ? EMPLOYEE_STATUS[status] : undefined;
  if (!config) return null;
  return <StatusBadge status={config.label} tone={config.tone} size={size} className={className} />;
};
