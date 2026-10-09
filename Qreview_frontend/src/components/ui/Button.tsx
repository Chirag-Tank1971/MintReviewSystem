import React from 'react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  /** The one main action on a page or panel. */
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent',
  /** Everything else that is still a button. */
  secondary:
    'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  /** Quiet controls such as refresh, sitting next to other actions. */
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent',
};

const SIZES = {
  sm: { box: 'h-8 px-3 text-xs gap-1.5', iconOnly: 'w-8 px-0', icon: 'w-3.5 h-3.5' },
  md: { box: 'h-9 px-3.5 text-sm gap-2', iconOnly: 'w-9 px-0', icon: 'w-4 h-4' },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: React.ComponentType<{ className?: string }>;
  /** Spins the icon, e.g. a refresh icon while data reloads. */
  iconSpin?: boolean;
}

/**
 * Shared button. With no children it renders icon-only, so pass an `aria-label`.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', icon: Icon, iconSpin, className, children, type = 'button', ...rest }, ref) => {
    const s = SIZES[size];
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center shrink-0 font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950',
          VARIANTS[variant],
          s.box,
          !children && s.iconOnly,
          className
        )}
        {...rest}
      >
        {Icon && (
          <span aria-hidden="true" className="contents">
            <Icon className={cn(s.icon, 'shrink-0', iconSpin && 'animate-spin')} />
          </span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
