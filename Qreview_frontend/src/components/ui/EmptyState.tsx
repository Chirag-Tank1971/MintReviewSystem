import React from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  /** Primary call to action. */
  action?: EmptyStateAction;
  /** Secondary call to action, rendered after the primary one. */
  secondaryAction?: EmptyStateAction;
  /** 'neutral' (default) for "nothing here yet"; 'success' for a positive empty state
   *  like an empty inbox ("all caught up"). */
  tone?: 'neutral' | 'success';
  className?: string;
}

const TONE_STYLES: Record<'neutral' | 'success', string> = {
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
};

/** Shared empty state: icon, title, one line of direction, and what to do next. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tone = 'neutral',
  className,
}) => (
  <div
    className={cn(
      'px-6 py-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg mx-auto my-8',
      className
    )}
  >
    <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4', TONE_STYLES[tone])}>
      <Icon className="w-6 h-6" />
    </div>
    <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
    {description && (
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>
    )}
    {(action || secondaryAction) && (
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {action && (
          <Button variant="primary" size="md" icon={action.icon} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button size="md" icon={secondaryAction.icon} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    )}
  </div>
);
