import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Kra, Department } from '../types';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Target, Plus, Search, Filter, ShieldCheck, Edit2, Loader2 } from 'lucide-react';

interface KraLibraryModalProps {
  kras: Kra[];
  departments: Department[];
  canEdit: boolean;
  onSaveKra: (kraData: Partial<Kra>) => Promise<void>;
  onClose: () => void;
}

export const KraLibraryModal: React.FC<KraLibraryModalProps> = ({
  kras,
  departments,
  canEdit,
  onSaveKra,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [editingKra, setEditingKra] = useState<Kra | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Delivery & Execution');
  const [formMetricType, setFormMetricType] = useState<Kra['metricType']>('PERCENTAGE');
  const [formTargetUnit, setFormTargetUnit] = useState('%');
  const [formDeptId, setFormDeptId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ onClose });

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, handleClose]);

  if (!isMounted) return null;

  const categories = Array.from(new Set(kras.map((k) => k.category).filter(Boolean)));

  const filteredKras = kras.filter((k) => {
    if (selectedDept !== 'ALL' && k.departmentId !== selectedDept) return false;
    if (selectedCategory !== 'ALL' && k.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        k.title.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q) ||
        (k.category && k.category.toLowerCase().includes(q)) ||
        (k.departmentName && k.departmentName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleStartCreate = () => {
    setEditingKra(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory('Delivery & Execution');
    setFormMetricType('PERCENTAGE');
    setFormTargetUnit('%');
    setFormDeptId('');
    setFormError('');
    setIsCreating(true);
  };

  const handleStartEdit = (kra: Kra) => {
    setEditingKra(kra);
    setFormTitle(kra.title);
    setFormDesc(kra.description);
    setFormCategory(kra.category || 'Delivery & Execution');
    setFormMetricType(kra.metricType);
    setFormTargetUnit(kra.targetUnit || '');
    setFormDeptId(kra.departmentId || '');
    setFormError('');
    setIsCreating(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Title is required');
      toast.warning('Title is required for standard KRA', 'Validation');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      await onSaveKra({
        ...(editingKra ? { id: editingKra.id } : {}),
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory.trim(),
        metricType: formMetricType,
        targetUnit: formTargetUnit.trim() || undefined,
        departmentId: formDeptId || undefined,
      });
      toast.success(`KRA "${formTitle.trim()}" saved to library.`, 'KRA Saved');
      setIsCreating(false);
      setEditingKra(null);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save KRA item';
      setFormError(errMsg);
      toast.error(errMsg, 'KRA Error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden ${cardClass}`}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white">Master KRA library</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-indigo-950/40 text-blue-700 dark:text-indigo-300 border border-blue-100 dark:border-indigo-850">
                  {kras.length} items cataloged
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Standardized organizational key result areas used to construct evaluation templates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !isCreating && (
              <button
                id="btn-add-kra-library"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add standard KRA
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            /* Creation / Edit Form */
            <form onSubmit={handleSubmitForm} className="space-y-4 max-w-2xl mx-auto bg-slate-50/70 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-750">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {editingKra ? `Edit KRA: ${editingKra.title}` : 'Add Standard KRA to Library'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    KRA title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Sprint Feature Delivery & Execution"
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description & objectives
                  </label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Describe the scope, objectives, and expected impact of this KRA..."
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Evaluation category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    list="category-suggestions"
                    placeholder="e.g. Delivery & Execution"
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <datalist id="category-suggestions">
                    <option value="Delivery & Execution" />
                    <option value="Quality & Reliability" />
                    <option value="Leadership & Team" />
                    <option value="Revenue & Growth" />
                    <option value="People & Operations" />
                    <option value="Customer Success" />
                    <option value="Innovation & Architecture" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Metric measurement type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formMetricType}
                    onChange={(e) => setFormMetricType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="PERCENTAGE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Percentage (% completed / attained)</option>
                    <option value="TARGET_NUMERIC" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Quantitative metric (number / value / SLA)</option>
                    <option value="RATING_SCALE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Qualitative scale (1 - 5 scoring rubric)</option>
                    <option value="MILESTONE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Milestone / deliverable SLA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target measurement unit
                  </label>
                  <input
                    type="text"
                    value={formTargetUnit}
                    onChange={(e) => setFormTargetUnit(e.target.value)}
                    placeholder="e.g. %, ms, PRs/quarter, $ ARR"
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Associated department (optional)
                  </label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All departments (universal KRA)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </span>
                  ) : editingKra ? (
                    'Update KRA'
                  ) : (
                    'Save KRA'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Catalog List & Search Filters */
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search KRAs by title, category, keywords..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium focus:outline-hidden focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium focus:outline-hidden focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KRA Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredKras.length === 0 ? (
                  <div className="col-span-2 text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                    No KRAs found matching your search and filter criteria.
                  </div>
                ) : (
                  filteredKras.map((kra) => (
                    <div
                      key={kra.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-750 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-650 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {kra.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {kra.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                          {kra.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 tabular-nums text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
                            {kra.metricType}
                          </span>
                          {kra.targetUnit && (
                            <span className="text-slate-400 dark:text-slate-500">Unit: {kra.targetUnit}</span>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleStartEdit(kra)}
                            className="opacity-0 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 p-1 rounded transition-opacity cursor-pointer"
                            title="Edit KRA"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Standard KRAs enforce organizational measurement alignment</span>
          </div>
          <button
            onClick={handleClose}
            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
