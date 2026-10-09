import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KraTemplate, KraItem, Kra, Department, Designation } from '../types';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Library,
  Info,
  Scale,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface KraTemplateBuilderModalProps {
  template?: KraTemplate | null;
  departments: Department[];
  designations: Designation[];
  kraLibrary: Kra[];
  onSave: (templateData: Partial<KraTemplate>) => Promise<void>;
  onClose: () => void;
}

export const KraTemplateBuilderModal: React.FC<KraTemplateBuilderModalProps> = ({
  template,
  departments,
  designations,
  kraLibrary,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(template?.title || template?.name || '');
  const [departmentId, setDepartmentId] = useState(template?.departmentId || '');
  const [designationId, setDesignationId] = useState(template?.designationId || '');
  const [items, setItems] = useState<KraItem[]>(
    template?.items && template.items.length > 0
      ? template.items
      : [
          {
            id: `item_${Date.now()}_1`,
            title: 'Core Deliverables & Sprint Execution',
            description: 'Timely and defect-free execution of assigned quarterly projects',
            target: '≥ 90% planned deliverables completed within sprint SLA',
            measurementCriteria: '1: <70% | 3: 85-90% | 5: >95% + exceptional quality',
            weight: 40,
          },
          {
            id: `item_${Date.now()}_2`,
            title: 'Quality & Process Rigor',
            description: 'Maintain high technical and operational standards',
            target: 'Zero critical defect slippages and active peer review',
            measurementCriteria: '1: Defects reported | 3: Clean deliverables | 5: Process optimization',
            weight: 35,
          },
          {
            id: `item_${Date.now()}_3`,
            title: 'Team Collaboration & Mentorship',
            description: 'Cross-functional support and mentoring teammates',
            target: 'Active participation in reviews and knowledge sharing',
            measurementCriteria: '1: Low engagement | 3: Meets expectations | 5: Proactive leadership',
            weight: 25,
          },
        ]
  );

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ onClose });

  // Filter designations by selected department
  const filteredDesignations = designations.filter(
    (d) => !departmentId || d.departmentId === departmentId
  );

  useEffect(() => {
    if (designationId && departmentId && filteredDesignations.length > 0 && !filteredDesignations.some((d) => d.id === designationId)) {
      setDesignationId('');
    }
  }, [departmentId, filteredDesignations, designationId]);

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, handleClose]);

  if (!isMounted) return null;

  // Compute total weight
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const isExact100 = Math.round(totalWeight) === 100;

  const handleAddItem = () => {
    const newItem: KraItem = {
      id: `item_${Date.now()}_${items.length + 1}`,
      title: '',
      description: '',
      target: '',
      measurementCriteria: '',
      weight: 10,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('A template must contain at least one KRA item.');
      return;
    }
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    setError('');
  };

  const handleItemChange = (index: number, field: keyof KraItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddFromLibrary = (kra: Kra) => {
    const newItem: KraItem = {
      id: `item_${Date.now()}_${items.length + 1}`,
      kraId: kra.id,
      title: kra.title,
      description: kra.description,
      target: kra.targetUnit ? `Target: [Value] ${kra.targetUnit}` : 'Target milestone / goal',
      measurementCriteria: '1: Below target | 3: Target met | 5: Exceeds target',
      weight: 15,
    };
    setItems([...items, newItem]);
    setShowLibraryPicker(false);
  };

  const handleAutoRebalance = () => {
    if (items.length === 0) return;
    const baseWeight = Math.floor(100 / items.length);
    const remainder = 100 - baseWeight * items.length;

    const rebalanced = items.map((item, idx) => ({
      ...item,
      weight: idx === 0 ? baseWeight + remainder : baseWeight,
    }));
    setItems(rebalanced);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Template title is required');
      toast.warning('Template title is required', 'Validation');
      return;
    }
    if (!departmentId) {
      setError('Department is required');
      toast.warning('Department is required', 'Validation');
      return;
    }
    if (!isExact100) {
      const msg = `Total weightage must equal exactly 100%. Currently it is ${totalWeight}%`;
      setError(msg);
      toast.warning(msg, 'Weight Invariant Violation');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].title.trim()) {
        const msg = `Item #${i + 1} is missing a title.`;
        setError(msg);
        toast.warning(msg, 'Validation');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');
      await onSave({
        ...(template ? { id: template.id } : {}),
        title: title.trim(),
        departmentId,
        designationId: designationId || undefined,
        items,
        totalWeight: 100,
      });
      toast.success(`KRA Template "${title.trim()}" saved with 100% weightage.`, 'Template Saved');
      handleClose();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save KRA template';
      setError(errMsg);
      toast.error(errMsg, 'Template Error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden ${cardClass}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                  {template ? 'Edit KRA Evaluation Template' : 'Create KRA Evaluation Template'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
                  100% Invariant Rule
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Define the key result areas, targets, and weighted scoring criteria for quarterly appraisals
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Template Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Template name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer Core KRA"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setDesignationId(''); // Reset designation when department changes
                }}
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target designation <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400"
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  All designations (Department-wide)
                </option>
                {filteredDesignations.map((des) => (
                  <option key={des.id} value={des.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    {des.name} (L{des.level})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setShowLibraryPicker(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
              >
                <Library className="w-3.5 h-3.5" />
                Pick from standard KRA library
              </button>
            </div>
          </div>

          {/* Library Picker Modal Popup if clicked */}
          {showLibraryPicker && (
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  <Library className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Select a standard KRA to insert into this template:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLibraryPicker(false)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {kraLibrary.map((kra) => (
                  <button
                    key={kra.id}
                    type="button"
                    onClick={() => handleAddFromLibrary(kra)}
                    className="text-left p-2 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-lg text-xs hover:bg-indigo-50/50 dark:hover:bg-slate-750 transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{kra.title}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {kra.category} • {kra.metricType}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Weightage Tracker Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total KRA weightage:</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isExact100
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : totalWeight > 100
                      ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {totalWeight}% / 100%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoRebalance}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-rebalance to 100%
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  isExact100
                    ? 'bg-emerald-500'
                    : totalWeight > 100
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            {!isExact100 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>
                  {totalWeight < 100
                    ? `Allocate remaining ${100 - totalWeight}% across items before saving.`
                    : `Reduce ${totalWeight - 100}% to balance total to exactly 100%.`}
                </span>
              </p>
            )}
          </div>

          {/* KRA Items List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Evaluation Items ({items.length})
              </h4>
              <button
                type="button"
                id="btn-add-custom-kra-item"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl space-y-3 hover:border-slate-300 dark:hover:border-slate-650 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                      {idx + 1}
                    </span>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          KRA title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                          placeholder="e.g. Sprint Feature Delivery & Execution"
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Weightage (%) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="1"
                            max="100"
                            value={item.weight}
                            onChange={(e) => handleItemChange(idx, 'weight', Number(e.target.value))}
                            className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pr-7 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Specific expectations and quality deliverables..."
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Target / milestone
                        </label>
                        <input
                          type="text"
                          value={item.target}
                          onChange={(e) => handleItemChange(idx, 'target', e.target.value)}
                          placeholder="e.g. ≥ 90% sprint story points completed"
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          1 - 5 Scoring Rubric / Measurement Criteria
                        </label>
                        <input
                          type="text"
                          value={item.measurementCriteria || ''}
                          onChange={(e) => handleItemChange(idx, 'measurementCriteria', e.target.value)}
                          placeholder="e.g. 1: <70% | 3: 85-90% (Meets target) | 5: >95% (Exceeds)"
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors mt-1 cursor-pointer"
                      title="Remove KRA item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>
              Templates become immutable snapshots when quarterly reviews are initiated.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-kra-template"
              type="submit"
              onClick={handleSubmit}
              disabled={submitting || !isExact100}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? 'Saving Template...' : template ? 'Update Template' : 'Save & Publish Template'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
