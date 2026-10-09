import React from 'react';
import { Sparkles } from 'lucide-react';
import { TEXTAREA_CLASS } from '../../ui/formStyles';

interface ManagerFeedbackSectionProps {
  strengths: string;
  setStrengths: (val: string) => void;
  improvements: string;
  setImprovements: (val: string) => void;
  managerComments: string;
  setManagerComments: (val: string) => void;
  canEdit: boolean;
  aiLoading: boolean;
  aiSuccessNote: string;
  onAiDraftSummary: () => void;
}

/** Manager's overall growth feedback — shown at the end of Step 2, below the KRA ratings. */
export const ManagerFeedbackSection: React.FC<ManagerFeedbackSectionProps> = ({
  strengths,
  setStrengths,
  improvements,
  setImprovements,
  managerComments,
  setManagerComments,
  canEdit,
  aiLoading,
  aiSuccessNote,
  onAiDraftSummary,
}) => {
  const fields = [
    {
      id: 'mgr-feedback-strengths',
      label: 'Strengths and contributions',
      value: strengths,
      onChange: setStrengths,
      placeholder: 'Skills, leadership, mentoring and standout results',
    },
    {
      id: 'mgr-feedback-improvements',
      label: 'Development areas',
      value: improvements,
      onChange: setImprovements,
      placeholder: 'Skill gaps, habits to change, or stretch goals for next quarter',
    },
    {
      id: 'mgr-feedback-summary',
      label: 'Overall summary and recommendation',
      value: managerComments,
      onChange: setManagerComments,
      placeholder: 'Your overall view for HOD and HR, including promotion or increment readiness',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Overall feedback</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Summarise strengths, development areas and your recommendation before you submit.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={aiLoading}
            onClick={onAiDraftSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${aiLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{aiLoading ? 'Drafting…' : 'Draft with AI'}</span>
          </button>
        )}
      </div>

      {aiSuccessNote && (
        <p role="status" className="text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {aiSuccessNote}
        </p>
      )}

      {fields.map((f) => (
        <div key={f.id}>
          <label htmlFor={f.id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {f.label}
          </label>
          <textarea
            id={f.id}
            rows={3}
            disabled={!canEdit}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            className={TEXTAREA_CLASS}
          />
        </div>
      ))}
    </div>
  );
};
