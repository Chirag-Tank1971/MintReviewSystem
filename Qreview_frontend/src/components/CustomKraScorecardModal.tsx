import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Briefcase,
  Building2,
  Users,
  UserCheck,
  Calendar,
  Hash,
  Loader2,
  Library,
  FileText,
  Search,
  Scale,
} from 'lucide-react';
import { KraTemplate, Kra } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Button } from './ui/Button';

export interface CustomKraRow {
  id: string;
  title: string;
  weight: number | string;
  target: string;
  description?: string;
  measurementCriteria?: string;
}

interface CustomKraScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: (rows: CustomKraRow[]) => void | Promise<void>;
  initialKras: CustomKraRow[];
  employeeCode: string;
  name: string;
  designationName?: string;
  departmentName?: string;
  managerName?: string;
  hodName?: string;
  cycleName?: string;
  templates?: KraTemplate[];
  kraLibrary?: Kra[];
}

const blankRow = (weight: number = 10): CustomKraRow => ({
  id: `kra_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  title: '',
  weight,
  target: '100% Target SLA',
  measurementCriteria: '',
});

/**
 * Standalone "fill the scorecard" modal, laid out like the paper/Excel KRA sheets
 * (Emp Id, Name, Designation, Reporting Manager, HOD, Department, Appraisal Cycle
 * header block, followed by the S.No / KRA / Weightage table) so HR can transcribe
 * an existing scorecard 1:1. Opened from the "Custom Scorecard" toggle in
 * EmployeeModal; only commits back to the parent form when "Done" is pressed.
 */
export const CustomKraScorecardModal: React.FC<CustomKraScorecardModalProps> = ({
  isOpen,
  onClose,
  onDone,
  initialKras,
  employeeCode,
  name,
  designationName,
  departmentName,
  managerName,
  hodName,
  cycleName,
  templates,
  kraLibrary,
}) => {
  const [rows, setRows] = useState<CustomKraRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template & Library master data
  const [loadedTemplates, setLoadedTemplates] = useState<KraTemplate[]>(templates || []);
  const [loadedLibrary, setLoadedLibrary] = useState<Kra[]>(kraLibrary || []);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  // Template waiting for the user to confirm it may replace KRAs they already typed
  const [pendingTemplateId, setPendingTemplateId] = useState('');
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('ALL');

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen) return;
    if (templates && templates.length > 0) {
      setLoadedTemplates(templates);
    } else {
      api.getKraTemplates().then((t) => setLoadedTemplates(Array.isArray(t) ? t : [])).catch(() => {});
    }
    if (kraLibrary && kraLibrary.length > 0) {
      setLoadedLibrary(kraLibrary);
    } else {
      api.getKras().then((k) => setLoadedLibrary(Array.isArray(k) ? k : [])).catch(() => {});
    }
  }, [isOpen, templates, kraLibrary]);

  useEffect(() => {
    if (isOpen) {
      setRows(
        initialKras && initialKras.length > 0
          ? initialKras.map((k) => ({ ...k, id: k.id || `kra_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` }))
          : [blankRow(25), blankRow(25), blankRow(25), blankRow(25)]
      );
      setSelectedTemplateId('');
      setPendingTemplateId('');
      setShowLibraryPicker(false);
      setIsSubmitting(false);
    }
  }, [isOpen, initialKras]);

  useEffect(() => {
    if (!isMounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, handleClose]);

  if (!isMounted) return null;

  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const isBalanced = totalWeight === 100;

  const handleAddRow = () => setRows((prev) => [...prev, blankRow(0)]);
  const handleRemoveRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const handleUpdateRow = (index: number, field: keyof CustomKraRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const blueprintTemplates = loadedTemplates.filter((t) => !t.employeeId && t.items?.length > 0);
  const otherTemplates = loadedTemplates.filter((t) => t.employeeId && t.items?.length > 0);

  const suggestedTemplate = loadedTemplates.find(
    (t) =>
      !t.employeeId &&
      t.items?.length > 0 &&
      ((designationName && t.designationName?.toLowerCase() === designationName.toLowerCase()) ||
       (departmentName && t.departmentName?.toLowerCase() === departmentName.toLowerCase()))
  );

  const categories = Array.from(new Set(loadedLibrary.map((k) => k.category).filter(Boolean)));
  const filteredLibrary = loadedLibrary.filter((k) => {
    if (libraryCategory !== 'ALL' && k.category !== libraryCategory) return false;
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      return (
        k.title.toLowerCase().includes(q) ||
        (k.description && k.description.toLowerCase().includes(q)) ||
        Boolean(k.category && k.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleApplyTemplate = (templateId: string, confirmed = false) => {
    if (!templateId) return;
    const tmpl = loadedTemplates.find((t) => t.id === templateId);
    if (!tmpl || !tmpl.items || tmpl.items.length === 0) {
      toast.warning('Selected template has no KRA items.', 'Template empty');
      return;
    }
    if (!confirmed && rows.some((r) => r.title.trim())) {
      setPendingTemplateId(templateId);
      return;
    }
    setSelectedTemplateId(templateId);
    const newRows: CustomKraRow[] = tmpl.items.map((it, idx) => ({
      id: it.id || `kra_${Date.now()}_${idx}`,
      title: it.title || '',
      weight: it.weight ?? 0,
      target: it.target || '100% Target SLA',
      description: it.description || '',
      measurementCriteria: it.measurementCriteria || '',
    }));
    setRows(newRows);
    toast.success(`Loaded "${tmpl.title || tmpl.name}" (${newRows.length} KRAs, 100% weightage).`, 'Template applied');
  };

  const handleAddFromLibrary = (kra: Kra) => {
    const hasOnlyBlank = rows.length > 0 && rows.every((r) => !r.title.trim());
    const newRow: CustomKraRow = {
      id: `kra_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: kra.title,
      weight: 10,
      target: kra.targetUnit ? `Target: [Value] ${kra.targetUnit}` : '100% Target SLA',
      description: kra.description || '',
      measurementCriteria: '1: Below target | 3: Meets target | 5: Exceeds target',
    };
    if (hasOnlyBlank) {
      setRows([newRow]);
    } else {
      setRows((prev) => [...prev, newRow]);
    }
    toast.info(`Added "${kra.title}" from KRA library.`, 'KRA added');
  };

  const handleAutoRebalance = () => {
    if (rows.length === 0) return;
    const baseWeight = Math.floor(100 / rows.length);
    const remainder = 100 - baseWeight * rows.length;
    setRows((prev) =>
      prev.map((r, idx) => ({
        ...r,
        weight: idx === 0 ? baseWeight + remainder : baseWeight,
      }))
    );
    toast.info('Weights rebalanced to 100%.', 'Weights balanced');
  };

  const handleDone = async () => {
    const filtered = rows
      .map((r) => ({
        ...r,
        title: r.title.trim(),
        target: r.target.trim() || '100% Target SLA',
        weight: Number(r.weight) || 0,
      }))
      .filter((r) => r.title.length > 0);

    if (filtered.length === 0) {
      toast.warning('Please add at least one Key Result Area.', 'Validation error');
      return;
    }

    const sum = filtered.reduce((s, r) => s + r.weight, 0);
    if (sum !== 100) {
      toast.warning(`Total weightage is ${sum}%. It must sum to exactly 100%.`, 'Weightage mismatch');
      return;
    }

    setIsSubmitting(true);
    try {
      await onDone(filtered);
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerFields: Array<{ label: string; value: string; icon: React.ReactNode }> = [
    { label: 'Emp Id', value: employeeCode || '—', icon: <Hash className="w-3 h-3" /> },
    { label: 'Name', value: name || '—', icon: <Users className="w-3 h-3" /> },
    { label: 'Designation', value: designationName || '—', icon: <Briefcase className="w-3 h-3" /> },
    { label: 'Department', value: departmentName || '—', icon: <Building2 className="w-3 h-3" /> },
    { label: 'Reporting Manager', value: managerName || '—', icon: <UserCheck className="w-3 h-3" /> },
    { label: 'HOD', value: hodName || '—', icon: <UserCheck className="w-3 h-3" /> },
    { label: 'Appraisal Cycle', value: cycleName || '—', icon: <Calendar className="w-3 h-3" /> },
  ];

  return createPortal(
    <div
      className={`fixed inset-0 z-[9995] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${cardClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">KRA performance scorecard</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fill in the key result areas for this employee's appraisal cycle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Employee Detail Header Block (mirrors the standard KRA sheet layout) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            {headerFields.map((f) => (
              <div key={f.label} className="bg-slate-50 dark:bg-slate-850 px-3 py-2">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  {f.icon}
                  {f.label}
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5 truncate" title={f.value}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Option: Load Already Created KRA Template or Pick from Library */}
          <div className="bg-slate-50 dark:bg-slate-850/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                  Load existing template:
                </span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="w-full max-w-md text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate shadow-xs"
                >
                  <option value="">-- Choose already created KRA template --</option>
                  {suggestedTemplate && (
                    <option value={suggestedTemplate.id}>
                      Suggested: {suggestedTemplate.title || suggestedTemplate.name} ({suggestedTemplate.items?.length} KRAs • 100%)
                    </option>
                  )}
                  {blueprintTemplates.length > 0 && (
                    <optgroup label="Shared templates">
                      {blueprintTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title || t.name} ({t.items?.length} KRAs • {t.departmentName || 'General'}{t.designationName ? ` - ${t.designationName}` : ''})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherTemplates.length > 0 && (
                    <optgroup label="Copy from an employee's scorecard">
                      {otherTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.employeeName ? `${t.employeeName}'s scorecard` : (t.title || t.name)} ({t.items?.length} KRAs • {t.departmentName || 'General'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowLibraryPicker((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    showLibraryPicker
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <Library className="w-3.5 h-3.5" />
                  Pick from KRA library
                </button>
              </div>
            </div>

            {/* Library Picker Drawer if toggled */}
            {showLibraryPicker && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={librarySearch}
                        onChange={(e) => setLibrarySearch(e.target.value)}
                        placeholder="Search standard KRAs in library..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {categories.length > 0 && (
                      <select
                        value={libraryCategory}
                        onChange={(e) => setLibraryCategory(e.target.value)}
                        className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <option value="ALL">All categories</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLibraryPicker(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredLibrary.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                      No standard KRAs found matching your search.
                    </div>
                  ) : (
                    filteredLibrary.map((kra) => (
                      <div
                        key={kra.id}
                        className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 dark:text-white truncate" title={kra.title}>
                            {kra.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {kra.category} • {kra.metricType}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddFromLibrary(kra)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded text-[11px] font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Weightage Indicator */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total weightage:</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isBalanced
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                }`}
              >
                {totalWeight}% / 100% {isBalanced ? 'Balanced' : `(Diff: ${100 - totalWeight > 0 ? `+${100 - totalWeight}` : 100 - totalWeight}%)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoRebalance}
                title="Automatically distribute weights evenly to 100%"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Auto-balance 100%
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add KRA
              </button>
            </div>
          </div>

          {/* KRA Table (S.No / Key Result Area / Weightage / Target) */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <div className="col-span-1">S.No</div>
              <div className="col-span-5">Key result area</div>
              <div className="col-span-2">Weightage</div>
              <div className="col-span-3">Target / SLA</div>
              <div className="col-span-1"></div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {rows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-50 dark:hover:bg-slate-850/60">
                  <div className="col-span-1 text-xs font-bold text-slate-400 dark:text-slate-500 text-center">{idx + 1}</div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="e.g. Ownership of breakdown calls"
                      value={row.title}
                      onChange={(e) => handleUpdateRow(idx, 'title', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Wt"
                        value={row.weight}
                        onChange={(e) => handleUpdateRow(idx, 'weight', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-5 py-1.5 text-xs text-slate-900 dark:text-white font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="absolute right-1.5 top-1.5 text-[11px] font-bold text-slate-400 pointer-events-none">%</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="Target SLA"
                      value={row.target}
                      onChange={(e) => handleUpdateRow(idx, 'target', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      disabled={rows.length <= 1}
                      onClick={() => handleRemoveRow(idx)}
                      title="Delete KRA"
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Weightage across all KRAs must total exactly 100% before this scorecard can be assigned.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Done — assign scorecard
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {pendingTemplateId && (
        <div
          className="fixed inset-0 z-[9996] flex items-center justify-center bg-slate-900/40 p-4 modal-backdrop-enter"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="replace-kras-title"
            aria-describedby="replace-kras-desc"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5 modal-card-enter"
          >
            <h3 id="replace-kras-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Replace your KRAs?
            </h3>
            <p id="replace-kras-desc" className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Loading "{loadedTemplates.find((t) => t.id === pendingTemplateId)?.title ||
                loadedTemplates.find((t) => t.id === pendingTemplateId)?.name}" will replace the KRAs you have entered.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="md" autoFocus onClick={() => setPendingTemplateId('')}>
                Keep my KRAs
              </Button>
              <Button
                size="md"
                variant="primary"
                onClick={() => {
                  const id = pendingTemplateId;
                  setPendingTemplateId('');
                  handleApplyTemplate(id, true);
                }}
              >
                Replace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
