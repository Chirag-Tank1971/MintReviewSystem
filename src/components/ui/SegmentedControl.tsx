import React from 'react';
import { cn } from '../../utils/cn';

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Dashboard view". */
  ariaLabel: string;
  className?: string;
}

/** A small set of mutually exclusive views, shown as one joined row of buttons. */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex p-0.5 rounded-md bg-slate-100 dark:bg-slate-800', className)}>
      {options.map(({ value: v, label, icon: Icon }) => {
        const isActive = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              isActive
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            {Icon && (
              <span aria-hidden="true" className="contents">
                <Icon className="w-3.5 h-3.5 shrink-0" />
              </span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
