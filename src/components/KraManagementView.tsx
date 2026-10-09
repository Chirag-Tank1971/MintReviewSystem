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
  Scale,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

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
  const [selectedTemplate, setSelectedTemplate] = useState<KraTemplate | null>(templates[0] || null);

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

      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('TEMPLATES')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === 'TEMPLATES'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          KRA Templates ({templates.length})
        </button>

        <button
          onClick={() => setActiveSubTab('LIBRARY')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === 'LIBRARY'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          Master Catalog ({kras.length})
        </button>

        <button
          onClick={() => setActiveSubTab('ASSIGNMENTS')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === 'ASSIGNMENTS'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Employee Role Mapping ({employees.length})
        </button>
      </div>

      {/* VIEW: TEMPLATES */}
      {activeSubTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Templates list (Left 5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search & Department Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All depts</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {d.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Cards List */}
            <div className="space-y-2.5">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  No KRA templates found.
                </div>
              ) : (
                filteredTemplates.map((tmpl) => {
                  const isSelected = selectedTemplate?.id === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {tmpl.title || tmpl.name}
                            </h4>
                            {tmpl.employeeId ? (
                              <span
                                title={`Owned exclusively by ${tmpl.employeeName || 'this employee'} — not shared`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0"
                              >
                                <UserCheck className="w-2.5 h-2.5" />
                                Employee-owned
                              </span>
                            ) : (
                              <span
                                title="A shared blueprint that can be assigned to multiple employees via Template Library mode"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0"
                              >
                                <Library className="w-2.5 h-2.5" />
                                Shared library
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              {tmpl.employeeId ? tmpl.employeeName : tmpl.departmentName || 'General Dept'}
                            </span>
                            {tmpl.designationName && !tmpl.employeeId && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                  {tmpl.designationName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">
                          {tmpl.items.length} KRAs • 100%
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                        <span>Updated: {tmpl.updatedAt || tmpl.createdAt ? new Date(tmpl.updatedAt || tmpl.createdAt || '').toLocaleDateString() : '—'}</span>
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-xs">
                          Preview <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Template Detail / Preview Panel (Right 7 cols) */}
          <div className="lg:col-span-7">
            {selectedTemplate ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      {selectedTemplate.employeeId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                          <UserCheck className="w-3 h-3" />
                          Employee-Owned • {selectedTemplate.employeeName}
                        </span>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                            {selectedTemplate.departmentName || 'Department Template'}
                          </span>
                          {selectedTemplate.designationName && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                              {selectedTemplate.designationName}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                      {selectedTemplate.title || selectedTemplate.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedTemplate.employeeId
                        ? 'Exclusive scorecard — assigned to this employee alone, never shared.'
                        : 'Shared blueprint — cloned into an employee-owned copy whenever it is assigned.'}
                    </p>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => onOpenEditTemplate(selectedTemplate)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Edit template
                    </button>
                  )}
                </div>

                {/* Weight summary card */}
                <div className="bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                      100%
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Total weightage invariant verified
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedTemplate.items.length} structured KRAs with calibrated 1-5 scoring criteria
                      </div>
                    </div>
                  </div>
                  <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>

                {/* Items detail list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Key Result Areas ({selectedTemplate.items.length})
                  </h4>

                  <div className="space-y-3">
                    {selectedTemplate.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.title || item.kraName}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                            {item.weight}%
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-7">
                            {item.description}
                          </p>
                        )}

                        <div className="pl-7 pt-1.5 border-t border-slate-100/80 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Target / SLA: </span>
                            <span className="text-slate-600 dark:text-slate-400">{item.target}</span>
                          </div>
                          {item.measurementCriteria && (
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">1-5 Rubric: </span>
                              <span className="text-slate-500 dark:text-slate-400">{item.measurementCriteria}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                Select a template from the left list to view its complete scoring breakdown.
              </div>
            )}
          </div>
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
              <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/95 dark:bg-[#18181d]/95 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-white/[0.06] font-semibold text-[11px]">
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
