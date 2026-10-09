import React from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  title: React.ReactNode;
  /** One short sentence about what the page is for. */
  description?: React.ReactNode;
  /** Small status shown next to the title, e.g. the active review period. */
  meta?: React.ReactNode;
  /** Buttons and controls, shown on the right (below the title on narrow screens). */
  actions?: React.ReactNode;
  className?: string;
}

/** The standard top of every page: title, one sentence, actions on the right. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, meta, actions, className }) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {meta}
      </div>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-prose leading-relaxed">{description}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
