import React, { useState } from 'react';
import { KraTemplate, Kra, Department, Employee } from '../types';
import {
  Plus,
  Search,
  FileText,
  Target,
  Users,
  ChevronRight,
  Edit2,
  Library,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { cn } from '../utils/cn';

interface KraManagementViewProps {
  templates: KraTemplate[];
  kras: Kra[];
  departments: Department[];
  employees: Employee[];
  canManage: boolean;
  onOpenCreateTemplate: () => void;
  onOpenCreateBlueprint?: () => void;
  onOpenEditTemplate: (template: KraTemplate) => void;
  onOpenLibrary: () => void;
  onQuickAssign: (employee: Employee) => void;
}

/** One template as a collapsible section: a short KRA table, with the full scoring rubric on request. */
const TemplateSection: React.FC<{
  tmpl: KraTemplate;
  isOpen: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
}> = ({ tmpl, isOpen, onToggle, canManage, onEdit }) => {
  const [showRubric, setShowRubric] = useState(false);
  const total = tmpl.items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.1;
  const panelId = `kra-panel-${tmpl.id}`;
  const updated = tmpl.updatedAt || tmpl.createdAt;
  const subtitle = [
    tmpl.employeeId ? tmpl.employeeName : tmpl.departmentName || 'General dept',
    !tmpl.employeeId ? tmpl.designationName : null,
    updated ? `Updated ${new Date(updated).toLocaleDateString('en-IN')}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <ChevronRight className={cn('w-4 h-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-90')} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{tmpl.title || tmpl.name}</span>
            {tmpl.employeeId ? (
              <span
                title={`Owned exclusively by ${tmpl.employeeName || 'this employee'}, not shared`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
              >
                <UserCheck className="w-3 h-3" aria-hidden="true" />
                Employee-owned
              </span>
            ) : (
              <span
                title="A shared blueprint that can be assigned to several employees"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                <Library className="w-3 h-3" aria-hidden="true" />
                Shared library
              </span>
            )}
          </span>
          <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
        </span>
        <span
          className={cn(
            'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums',
            totalOk
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          )}
        >
          {tmpl.items.length} KRAs · {total}%
        </span>
      </button>

      {isOpen && (
        <div id={panelId} className="border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-prose">
              {tmpl.employeeId
                ? 'Exclusive scorecard, assigned to this employee alone and never shared.'
                : 'Shared blueprint. It is copied into an employee-owned scorecard whenever it is assigned.'}
            </p>
            {canManage && (
              <Button icon={Edit2} onClick={onEdit}>
                Edit template
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3 text-left font-medium w-10">#</th>
                  <th className="py-2.5 px-3 text-left font-medium">Key result area</th>
                  <th className="py-2.5 px-3 text-left font-medium">Target / SLA</th>
                  <th className="py-2.5 px-3 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {tmpl.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium">{item.title || item.kraName}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{item.target || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{item.weight}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={cn('border-t-2 font-semibold', totalOk ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50')}>
                  <td className="py-2.5 px-3" colSpan={3}>
                    <span className="text-slate-900 dark:text-white">Total weightage</span>
                    {!totalOk && <span className="ml-2 font-normal text-amber-800 dark:text-amber-300">should add up to 100%</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-900 dark:text-white">{total}%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowRubric((v) => !v)}
              aria-expanded={showRubric}
              className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {showRubric ? 'Hide scoring rubric' : 'Show scoring rubric and descriptions'}
            </button>
            {showRubric && (
              <ol className="mt-3 space-y-3">
                {tmpl.items.map((item, idx) => (
                  <li key={item.id || idx} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{idx + 1}. {item.title || item.kraName}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">{item.weight}%</span>
                    </div>
                    {item.description && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.description}</p>}
                    {item.measurementCriteria && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">1-5 rubric: </span>
                        {item.measurementCriteria}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export const KraManagementView: React.FC<KraManagementViewProps> = ({
  templates,
  kras,
  departments,
  employees,
  canManage,
  onOpenCreateTemplate,
  onOpenCreateBlueprint,
  onOpenEditTemplate,
  onOpenLibrary,
  onQuickAssign,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'TEMPLATES' | 'LIBRARY' | 'ASSIGNMENTS'>('TEMPLATES');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  // null = the user hasn't touched it yet, so the first template shows open
  const [openIds, setOpenIds] = useState<string[] | null>(null);

  const filteredTemplates = templates.filter((t) => {
    if (selectedDept !== 'ALL' && t.departmentId !== selectedDept) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = t.title || t.name || '';
      return (
        title.toLowerCase().includes(q) ||
        (t.departmentName && t.departmentName.toLowerCase().includes(q)) ||
        (t.designationName && t.designationName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const currentOpen = openIds ?? (filteredTemplates[0] ? [filteredTemplates[0].id] : []);
  const toggleTemplate = (id: string) =>
    setOpenIds(currentOpen.includes(id) ? currentOpen.filter((x) => x !== id) : [...currentOpen, id]);
  const allOpen = filteredTemplates.length > 0 && filteredTemplates.every((tm) => currentOpen.includes(tm.id));

  const unassignedCount = employees.filter((e) => !e.currentKraTemplateId && e.status !== 'INACTIVE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="KRA templates"
        description="Standard key result areas, the templates built from them, and how each one is scored. A template's weights always add up to 100%."
        actions={
          <>
            <Button id="btn-open-kra-library" icon={Library} onClick={onOpenLibrary}>
              KRA library ({kras.length})
            </Button>
            {canManage && (
              <>
                {onOpenCreateBlueprint && (
                  <Button
                    id="btn-create-blueprint-template"
                    icon={FileText}
                    onClick={onOpenCreateBlueprint}
                  >
                    Create template
                  </Button>
                )}
                <Button id="btn-create-kra-template" variant="primary" icon={Plus} onClick={onOpenCreateTemplate}>
                  Assign KRAs
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Sections: same bold tab style as the Sales page */}
      <SegmentedControl
        ariaLabel="KRA section"
        strong
        className="max-w-full overflow-x-auto"
        value={activeSubTab}
        onChange={setActiveSubTab}
        options={[
          { value: 'TEMPLATES', label: <><span className="sm:hidden">Templates</span><span className="hidden sm:inline">KRA Templates</span> ({templates.length})</>, icon: FileText },
          { value: 'LIBRARY', label: <><span className="sm:hidden">Catalog</span><span className="hidden sm:inline">Master Catalog</span> ({kras.length})</>, icon: Target },
          { value: 'ASSIGNMENTS', label: <><span className="sm:hidden">Role mapping</span><span className="hidden sm:inline">Employee Role Mapping</span> ({employees.length})</>, icon: Users },
        ]}
      />

      {/* VIEW: TEMPLATES */}
      {activeSubTab === 'TEMPLATES' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                aria-label="Search templates"
                className="w-full h-8 pl-8 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              aria-label="Department"
              className="h-8 text-xs px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/25 cursor-pointer"
            >
              <option value="ALL">All depts</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>

            {filteredTemplates.length > 1 && (
              <Button onClick={() => setOpenIds(allOpen ? [] : filteredTemplates.map((tm) => tm.id))}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            )}
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              No KRA templates found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((tmpl) => (
                <TemplateSection
                  key={tmpl.id}
                  tmpl={tmpl}
                  isOpen={currentOpen.includes(tmpl.id)}
                  onToggle={() => toggleTemplate(tmpl.id)}
                  canManage={canManage}
                  onEdit={() => onOpenEditTemplate(tmpl)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: MASTER CATALOG (LIBRARY) */}
      {activeSubTab === 'LIBRARY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kras.map((kra) => (
              <div
                key={kra.id}
                className="bg-white dark:bg-[#121215] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{kra.title}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {kra.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 leading-relaxed">
                    {kra.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="tabular-nums text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                    {kra.metricType}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    {kra.departmentName || 'Universal Organization'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: EMPLOYEE ASSIGNMENTS */}
      {activeSubTab === 'ASSIGNMENTS' && (
        <div className="bg-white dark:bg-[#121215] rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#18181d]/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-white">
                Employee role & KRA assignment roster
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Each employee's KRA scorecard is exclusive to them — no defaults or shared fallbacks.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unassignedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {unassignedCount} without a KRA
                </span>
              )}
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#18181d] px-3 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08]">
                {employees.length} Employees Active
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#18181d]/95 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-white/[0.06] font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & designation</th>
                  <th className="py-3 px-4">Appraisal cycle</th>
                  <th className="py-3 px-4">Current KRA scorecard</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-700 dark:text-slate-300">
                {employees.map((emp) => {
                  // Only the employee's own currentKraTemplateId counts as "assigned" — a shared
                  // department/designation template must never be inferred as a fallback, since
                  // every employee's scorecard is now exclusive to them.
                  const assignedTemplate = templates.find((t) => t.id === emp.currentKraTemplateId);
                  const hasNoKra = !emp.currentKraTemplateId;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{emp.name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{emp.employeeCode} • {emp.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{emp.designationName || 'Specialist'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{emp.departmentName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: emp.cycleColor || '#1e3a8a' }}
                        >
                          Cycle {emp.cycleCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {assignedTemplate ? (
                          <div className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{assignedTemplate.title || assignedTemplate.name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            No KRA assigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && hasNoKra && emp.status !== 'INACTIVE' && (
                          <button
                            onClick={() => onQuickAssign(emp)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            Assign KRA
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
