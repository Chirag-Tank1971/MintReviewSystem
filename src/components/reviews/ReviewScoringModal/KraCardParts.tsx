import React from 'react';
import { ChevronDown, ChevronUp, Lock, LucideIcon } from 'lucide-react';

const LINK_BUTTON_CLASS =
  'font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white inline-flex items-center gap-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

/** Collapsed one-line row for a KRA that is locked because it isn't part of the open return. */
export const LockedKraRow: React.FC<{
  id: string;
  title?: string;
  summary: string;
  onExpand: () => void;
  children?: React.ReactNode;
}> = ({ id, title, summary, onExpand, children }) => (
  <div
    id={id}
    className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5 flex items-center justify-between gap-3"
  >
    <div className="flex items-center gap-3 min-w-0 flex-wrap text-xs">
      <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{title}</span>
      <span className="text-slate-500 dark:text-slate-400 tabular-nums">{summary}</span>
      {children}
    </div>
    <button type="button" onClick={onExpand} aria-label={`Show details for ${title || 'this KRA'}`} className={`shrink-0 text-xs ${LINK_BUTTON_CLASS}`}>
      Show <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  </div>
);

const STATUS_TONES = {
  warning: 'font-semibold text-amber-700 dark:text-amber-400',
  info: 'font-semibold text-indigo-700 dark:text-indigo-300',
  muted: 'text-slate-500 dark:text-slate-400',
};

/** One line of card status under the KRA title (e.g. "Sent back to you for re-evaluation"). */
export const CardStatus: React.FC<{ icon: LucideIcon; tone: keyof typeof STATUS_TONES; children: React.ReactNode }> = ({
  icon: Icon,
  tone,
  children,
}) => (
  <p className={`mt-2 text-xs flex items-center gap-1.5 flex-wrap ${STATUS_TONES[tone]}`}>
    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    {children}
  </p>
);

/** Status line for an expanded locked KRA, with a control to collapse it again. */
export const LockedStatus: React.FC<{ onCollapse: () => void }> = ({ onCollapse }) => (
  <CardStatus icon={Lock} tone="muted">
    Locked during this return
    <button type="button" onClick={onCollapse} className={`ml-1 ${LINK_BUTTON_CLASS}`}>
      Hide <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  </CardStatus>
);

/** Card header shared by the manager and HOD scoring steps. */
export const KraCardHeader: React.FC<{
  index: number;
  titleId: string;
  title?: string;
  description?: string;
  rating: number;
  contribution: number;
  weight?: number;
  children?: React.ReactNode;
}> = ({ index, titleId, title, description, rating, contribution, weight, children }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0 max-w-prose">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">{index + 1}</span>
        <h4 id={titleId} className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </h4>
      </div>
      {description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>}
      {children}
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
        {rating ? `+${contribution.toFixed(2)} pts` : <span className="font-normal text-slate-400">Not rated</span>}
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">{weight}% weight</div>
    </div>
  </div>
);

/** Read-only note from another reviewer, quoted with a rule on the left. */
export const QuotedNote: React.FC<{ label: string; text: string; accent?: string }> = ({
  label,
  text,
  accent = 'border-slate-300 dark:border-slate-600',
}) => (
  <figure className="space-y-1 text-xs">
    <figcaption className="font-semibold text-slate-700 dark:text-slate-300">{label}</figcaption>
    <blockquote className={`text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border-l-2 pl-2.5 ${accent}`}>{text}</blockquote>
  </figure>
);
