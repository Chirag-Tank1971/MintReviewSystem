import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Department, Designation, Employee, Cycle } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { MasterDeleteModal, MasterDeleteTarget } from './MasterDeleteModal';
import {
  Plus,
  Building2,
  Briefcase,
  Check,
  AlertCircle,
  Calendar,
  Edit2,
  X,
  Save,
  Trash2,
  Users,
  Search,
  UserMinus,
  CheckCircle2,
  Loader2,
  MapPin,
} from 'lucide-react';

interface MastersManagementProps {
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  cycles: Cycle[];
  onRefresh: () => void;
  currentUser?: { role?: string } | null;
}

export const MastersManagement: React.FC<MastersManagementProps> = ({
  departments,
  designations,
  employees,
  cycles,
  onRefresh,
  currentUser,
}) => {
  const { user } = useAuth();
  const effectiveUser = currentUser || user;
  const isHRorAdmin = effectiveUser?.role === 'SUPER_ADMIN' || effectiveUser?.role === 'HR';

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<MasterDeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Department Form State
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptHodId, setDeptHodId] = useState('');
  const [deptBudgetCapPercent, setDeptBudgetCapPercent] = useState<number | string>(12.0);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccess, setDeptSuccess] = useState(false);

  // Department Edit State
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptData, setEditDeptData] = useState<{
    name: string;
    code: string;
    hodId: string;
    budgetCapPercent: number | string;
  }>({ name: '', code: '', hodId: '', budgetCapPercent: 12.0 });
  const [deptUpdateLoading, setDeptUpdateLoading] = useState(false);

  // Designation Form State
  const [desName, setDesName] = useState('');
  const [desDeptId, setDesDeptId] = useState(departments[0]?.id || '');
  const [desLevel, setDesLevel] = useState(1);
  const [desLoading, setDesLoading] = useState(false);
  const [desError, setDesError] = useState<string | null>(null);
  const [desSuccess, setDesSuccess] = useState(false);

  // Cycle Form State
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [editCycleData, setEditCycleData] = useState<{name: string, appraisalMonth: number, description: string}>({ name: '', appraisalMonth: 1, description: '' });
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [selectedCycleForView, setSelectedCycleForView] = useState<Cycle | null>(null);
  const [cycleModalSearch, setCycleModalSearch] = useState('');

  // Location Management State
  const [locations, setLocations] = useState<{ id?: string; name: string; employeeCount: number; assignedEmployees?: { id: string; name: string; employeeCode: string }[] }[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocLoading, setNewLocLoading] = useState(false);
  const [newLocError, setNewLocError] = useState<string | null>(null);
  const [newLocSuccess, setNewLocSuccess] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      setLocationsLoading(true);
      const data = await api.getLocations();
      setLocations(data);
    } catch (err: any) {
      console.error('Failed to load locations', err);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    setDeptSuccess(false);
    setDeptLoading(true);

    try {
      const selectedHod = employees.find((emp) => emp.id === deptHodId);
      const parsedCap = typeof deptBudgetCapPercent === 'number'
        ? deptBudgetCapPercent
        : parseFloat(deptBudgetCapPercent as string);

      await api.createDepartment({
        name: deptName,
        code: deptCode,
        hodId: deptHodId || undefined,
        hodName: selectedHod?.name || undefined,
        budgetCapPercent: !isNaN(parsedCap) ? parsedCap : 12.0,
      });

      toast.success(`Department "${deptName}" (${deptCode}) created with ${!isNaN(parsedCap) ? parsedCap : 12.0}% budget cap.`, 'Department Created');
      setDeptName('');
      setDeptCode('');
      setDeptHodId('');
      setDeptBudgetCapPercent(12.0);
      setDeptSuccess(true);
      onRefresh();
      setTimeout(() => setDeptSuccess(false), 3000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create department';
      setDeptError(errMsg);
      toast.error(errMsg, 'Department Error');
    } finally {
      setDeptLoading(false);
    }
  };

  const handleUpdateDepartment = async (deptId: string) => {
    setDeptError(null);
    setDeptUpdateLoading(true);
    try {
      const selectedHod = employees.find((emp) => emp.id === editDeptData.hodId);
      const parsedCap = typeof editDeptData.budgetCapPercent === 'number'
        ? editDeptData.budgetCapPercent
        : parseFloat(editDeptData.budgetCapPercent as string);

      await api.updateDepartment(deptId, {
        name: editDeptData.name.trim(),
        code: editDeptData.code.toUpperCase().trim(),
        hodId: editDeptData.hodId || undefined,
        hodName: selectedHod?.name || undefined,
        budgetCapPercent: !isNaN(parsedCap) ? parsedCap : 12.0,
      });

      setEditingDeptId(null);
      toast.success(`Department "${editDeptData.name}" updated successfully.`, 'Department Saved');
      onRefresh();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update department';
      setDeptError(errMsg);
      toast.error(errMsg, 'Department Error');
    } finally {
      setDeptUpdateLoading(false);
    }
  };

  const promptDeleteDepartment = (d: Department) => {
    const assigned = employees.filter((e) => e.departmentId === d.id && e.status !== 'INACTIVE');
    setDeleteTarget({
      type: 'department',
      id: d.id,
      name: d.name,
      code: d.code,
      assignedEmployees: assigned,
    });
  };

  const promptDeleteDesignation = (des: Designation) => {
    const assigned = employees.filter((e) => e.designationId === des.id && e.status !== 'INACTIVE');
    const dept = departments.find((d) => d.id === des.departmentId);
    setDeleteTarget({
      type: 'designation',
      id: des.id,
      name: des.name,
      level: des.level,
      associatedDeptName: dept?.name || 'General',
      assignedEmployees: assigned,
    });
  };

  const promptDeleteLocation = (loc: { name: string; employeeCount: number }) => {
    const assigned = employees.filter(
      (e) => (e.location || '').trim().toLowerCase() === loc.name.trim().toLowerCase() && e.status !== 'INACTIVE' && !e.isPastEmployee
    );
    setDeleteTarget({
      type: 'location',
      id: loc.name,
      name: loc.name,
      assignedEmployees: assigned,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'department') {
        const res = await api.deleteDepartment(deleteTarget.id);
        toast.success(res.message || `Department "${deleteTarget.name}" deleted from database.`, 'Department Deleted');
      } else if (deleteTarget.type === 'designation') {
        const res = await api.deleteDesignation(deleteTarget.id);
        toast.success(res.message || `Designation "${deleteTarget.name}" deleted from database.`, 'Designation Deleted');
      } else if (deleteTarget.type === 'location') {
        const res = await api.deleteLocation(deleteTarget.name);
        toast.success(res.message || `Location "${deleteTarget.name}" deleted from database.`, 'Location Deleted');
        loadLocations();
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || `Failed to delete ${deleteTarget.type}`, 'Deletion Blocked');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    setNewLocError(null);
    setNewLocSuccess(false);
    setNewLocLoading(true);
    try {
      await api.createLocation(newLocationName.trim());
      toast.success(`Location "${newLocationName.trim()}" created successfully.`, 'Location Created');
      setNewLocationName('');
      setNewLocSuccess(true);
      loadLocations();
      setTimeout(() => setNewLocSuccess(false), 3000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create location';
      setNewLocError(errMsg);
      toast.error(errMsg, 'Location Error');
    } finally {
      setNewLocLoading(false);
    }
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setDesError(null);
    setDesSuccess(false);
    setDesLoading(true);

    try {
      await api.createDesignation({
        name: desName,
        departmentId: desDeptId || departments[0]?.id,
        level: desLevel,
      });

      toast.success(`Designation "${desName}" created successfully.`, 'Designation Created');
      setDesName('');
      setDesSuccess(true);
      onRefresh();
      setTimeout(() => setDesSuccess(false), 3000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create designation';
      setDesError(errMsg);
      toast.error(errMsg, 'Designation Error');
    } finally {
      setDesLoading(false);
    }
  };

  const handleUpdateCycle = async (cycleId: string) => {
    setCycleError(null);
    setCycleLoading(true);
    try {
      await api.updateCycle(cycleId, editCycleData);
      setEditingCycleId(null);
      toast.success(`Cycle "${editCycleData.name}" updated successfully.`, 'Cohort Cycle Saved');
      onRefresh();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update cycle';
      setCycleError(errMsg);
      toast.error(errMsg, 'Cycle Error');
    } finally {
      setCycleLoading(false);
    }
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const activeCycles = (cycles || []).filter((c) => c.active !== false);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Master */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Department master</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage business units & head of departments (HOD)</p>
              </div>
            </div>
            <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {departments.length} Units
            </span>
          </div>

          {/* New Dept Form */}
          <form onSubmit={handleCreateDepartment} className="space-y-3 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Add new department</h4>

            {deptError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{deptError}</span>
              </div>
            )}

            {deptSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Department created successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Department name</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Engineering"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. ENG"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Designated HOD</label>
                <select
                  value={deptHodId}
                  onChange={(e) => setDeptHodId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600 font-medium"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Select HOD (optional)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {emp.name} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Increment budget cap (%)</span>
                  <span className="text-[11px] text-slate-400 font-normal">0 - 100%</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={deptBudgetCapPercent}
                  onChange={(e) => setDeptBudgetCapPercent(e.target.value)}
                  placeholder="12.0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={deptLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deptLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{deptLoading ? 'Creating...' : 'Create Department'}</span>
            </button>
          </form>

          {/* List of Departments */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Active departments</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              {departments.map((d) => (
                <div key={d.id} className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  {editingDeptId === d.id ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">Edit Department: {d.name}</span>
                        <button
                          onClick={() => setEditingDeptId(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Name</label>
                          <input
                            type="text"
                            value={editDeptData.name}
                            onChange={(e) => setEditDeptData({ ...editDeptData, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Code</label>
                          <input
                            type="text"
                            value={editDeptData.code}
                            onChange={(e) => setEditDeptData({ ...editDeptData, code: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">HOD</label>
                          <select
                            value={editDeptData.hodId}
                            onChange={(e) => setEditDeptData({ ...editDeptData, hodId: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          >
                            <option value="">Not assigned</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.employeeCode})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Budget cap (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editDeptData.budgetCapPercent}
                            onChange={(e) => setEditDeptData({ ...editDeptData, budgetCapPercent: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleUpdateDepartment(d.id)}
                        disabled={deptUpdateLoading}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deptUpdateLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{deptUpdateLoading ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">{d.name}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {d.code}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tabular-nums font-semibold">
                            {typeof d.budgetCapPercent === 'number' ? d.budgetCapPercent : 12.0}% Cap
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          HOD: <span className="text-slate-700 dark:text-slate-200 font-medium">{d.hodName || 'Not assigned'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingDeptId(d.id);
                            setEditDeptData({
                              name: d.name,
                              code: d.code,
                              hodId: d.hodId || '',
                              budgetCapPercent: typeof d.budgetCapPercent === 'number' ? d.budgetCapPercent : 12.0,
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg transition-colors cursor-pointer"
                          title="Edit Department & Budget Cap"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => promptDeleteDepartment(d)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete Department from Database"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                          Active
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Designation Master */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Designation & role master</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure hierarchy levels & role titles per department</p>
              </div>
            </div>
            <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {designations.length} Roles
            </span>
          </div>

          {/* New Des Form */}
          <form onSubmit={handleCreateDesignation} className="space-y-3 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Add new designation</h4>

            {desError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{desError}</span>
              </div>
            )}

            {desSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Designation created successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation title</label>
                <input
                  type="text"
                  required
                  value={desName}
                  onChange={(e) => setDesName(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Hierarchy level</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={desLevel}
                  onChange={(e) => setDesLevel(parseInt(e.target.value) || 1)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Associated department</label>
              <select
                value={desDeptId}
                onChange={(e) => setDesDeptId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 dark:focus:border-slate-600 font-medium"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={desLoading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {desLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{desLoading ? 'Creating...' : 'Create Designation'}</span>
            </button>
          </form>

          {/* List of Designations */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Active designations</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              {designations.map((des) => (
                <div key={des.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white text-xs">{des.name}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Level {des.level}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Dept: {departments.find((d) => d.id === des.departmentId)?.name || 'General'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium">
                      Role Tier {des.level}
                    </span>
                    <button
                      onClick={() => promptDeleteDesignation(des)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Designation from Database"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cycle Master */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appraisal cycle framework master</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure appraisal months and cycle designations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {activeCycles.length} Active Cycles
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {employees?.length || 0} Total Headcount
            </span>
          </div>
        </div>

        {cycleError && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{cycleError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCycles.map((cycle) => {
            const cycleEmployees = (employees || []).filter(
              (e) => e.cycleId === cycle.id || e.cycleCode === cycle.code
            );

            return (
              <div
                key={cycle.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                {editingCycleId === cycle.id ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">Edit Cycle {cycle.code}</span>
                      <button onClick={() => setEditingCycleId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Cycle name</label>
                      <input
                        type="text"
                        value={editCycleData.name}
                        onChange={(e) => setEditCycleData({ ...editCycleData, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Appraisal month</label>
                      <select
                        value={editCycleData.appraisalMonth}
                        onChange={(e) => setEditCycleData({ ...editCycleData, appraisalMonth: parseInt(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                      >
                        {monthNames.map((month, idx) => (
                          <option key={idx + 1} value={idx + 1} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{month}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleUpdateCycle(cycle.id)}
                      disabled={cycleLoading}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {cycleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{cycleLoading ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cycle.colorHex }}></div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm truncate">{cycle.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCycleId(cycle.id);
                              setEditCycleData({ name: cycle.name, appraisalMonth: cycle.appraisalMonth, description: cycle.description || '' });
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg transition-colors cursor-pointer"
                            title="Edit Cycle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{cycle.description}</div>
                      
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            Month: <span className="font-bold text-slate-900 dark:text-white">{monthNames[cycle.appraisalMonth - 1]}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCycleForView(cycle);
                            setCycleModalSearch('');
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            cycleEmployees.length > 0
                              ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80'
                              : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Click to view enrolled employees"
                        >
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>
                            <strong className="font-bold text-slate-900 dark:text-white">{cycleEmployees.length}</strong>{' '}
                            <span className="font-normal text-[11px]">{cycleEmployees.length === 1 ? 'emp' : 'emps'}</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Location Master */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Work location master</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage base office and remote work locations across the organization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {locations.length} Locations
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {locations.reduce((acc, l) => acc + (l.employeeCount || 0), 0)} Total Assigned
            </span>
          </div>
        </div>

        {/* Add Location Form (HR / Super Admin only) */}
        {isHRorAdmin && (
          <form onSubmit={handleCreateLocation} className="space-y-3 bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Add new work location</h4>

            {newLocError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{newLocError}</span>
              </div>
            )}

            {newLocSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Location added successfully!</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g. Pune Tech Park, Kolkata Hub, Singapore Office"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={newLocLoading || !newLocationName.trim()}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {newLocLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{newLocLoading ? 'Adding...' : 'Add Location'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Location Search Bar & Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Registered locations</h4>
            <div className="relative w-64 max-w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search locations..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {locationsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading locations...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
              {locations
                .filter((loc) => !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()))
                .map((loc) => {
                  const hasEmployees = loc.employeeCount > 0;
                  return (
                    <div
                      key={loc.id || loc.name}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          hasEmployees
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={loc.name}>
                            {loc.name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {hasEmployees ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Active work hub</span>
                            ) : (
                              'No employees assigned'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            hasEmployees
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                          title={`${loc.employeeCount} active employee(s) assigned`}
                        >
                          {loc.employeeCount} {loc.employeeCount === 1 ? 'emp' : 'emps'}
                        </span>

                        {isHRorAdmin && (
                          <button
                            type="button"
                            onClick={() => promptDeleteLocation(loc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title={hasEmployees ? "Cannot delete: employees assigned" : "Delete location from database"}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {locations.filter((loc) => !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase())).length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-slate-400">
                  {locationSearch ? 'No locations matching search.' : 'No locations registered.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      <MasterDeleteModal
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* Enrolled Employees in Cycle Modal */}
      <CycleEnrolledModal
        cycle={selectedCycleForView}
        employees={employees}
        search={cycleModalSearch}
        onSearchChange={setCycleModalSearch}
        onClose={() => setSelectedCycleForView(null)}
      />
    </div>
  );
};

interface CycleEnrolledModalProps {
  cycle: Cycle | null;
  employees: Employee[];
  search: string;
  onSearchChange: (val: string) => void;
  onClose: () => void;
}

const CycleEnrolledModal: React.FC<CycleEnrolledModalProps> = ({
  cycle,
  employees,
  search,
  onSearchChange,
  onClose,
}) => {
  const cachedCycleRef = React.useRef(cycle);
  if (cycle) {
    cachedCycleRef.current = cycle;
  }
  const activeCycle = cycle || cachedCycleRef.current;

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen: !!cycle,
    onClose,
  });

  if (!isMounted || !activeCycle) return null;
  if (typeof document === 'undefined') return null;

  const enrolled = (employees || []).filter(
    (e) => e.cycleId === activeCycle.id || e.cycleCode === activeCycle.code
  );
  const filteredEnrolled = enrolled.filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      (emp.departmentName && emp.departmentName.toLowerCase().includes(q)) ||
      (emp.designationName && emp.designationName.toLowerCase().includes(q))
    );
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${backdropClass}`}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] my-auto flex flex-col overflow-hidden ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${activeCycle.colorHex}15`,
                borderColor: `${activeCycle.colorHex}40`,
              }}
            >
              <Calendar className="w-5 h-5" style={{ color: activeCycle.colorHex }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeCycle.name} — Enrolled Employees
                </h3>
                <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {enrolled.length} Enrolled
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Annual appraisal month: <strong>{monthNames[activeCycle.appraisalMonth - 1]}</strong> • {activeCycle.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search enrolled employees by name, code, department, or role..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Employees List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredEnrolled.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
              {enrolled.length === 0
                ? 'No employees are currently assigned to this cycle cohort.'
                : 'No employees matched your search.'}
            </div>
          ) : (
            filteredEnrolled.map((emp) => (
              <div key={emp.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {emp.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {emp.designationName || 'Role'} • {emp.departmentName || 'Department'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {emp.employeeCode}
                  </span>
                  {emp.status === 'INACTIVE' || emp.isPastEmployee ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      <UserMinus className="w-2.5 h-2.5 text-slate-400" /> Past employee
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Active
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
