import { useState, useEffect, useCallback } from 'react';
import { KraTemplate, Kra, Department, Designation, Employee, Cycle } from '../types';
import { api } from '../services/api';

export function useMasterData(enabled: boolean = true) {
  const [templates, setTemplates] = useState<KraTemplate[]>([]);
  const [kras, setKras] = useState<Kra[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMasterData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tmplRes, kraRes, deptRes, desRes, empRes, cycleRes] = await Promise.allSettled([
        api.getKraTemplates(),
        api.getKras(),
        api.getDepartments(),
        api.getDesignations(),
        api.getEmployees(),
        api.getCycles(),
      ]);

      if (tmplRes.status === 'fulfilled' && Array.isArray(tmplRes.value)) setTemplates(tmplRes.value);
      if (kraRes.status === 'fulfilled' && Array.isArray(kraRes.value)) setKras(kraRes.value);
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) setDepartments(deptRes.value);
      if (desRes.status === 'fulfilled' && Array.isArray(desRes.value)) setDesignations(desRes.value);
      if (empRes.status === 'fulfilled' && Array.isArray(empRes.value)) setEmployees(empRes.value);
      if (cycleRes.status === 'fulfilled' && Array.isArray(cycleRes.value)) setCycles(cycleRes.value);
    } catch (err: any) {
      console.error('Failed to load master data:', err);
      setError(err?.message || 'Failed to fetch master data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      refreshMasterData();
    }
  }, [enabled, refreshMasterData]);

  const saveTemplate = async (templateData: Partial<KraTemplate>) => {
    if (templateData.id) {
      await api.updateKraTemplate(templateData.id, templateData);
    } else {
      await api.createKraTemplate(templateData);
    }
    await refreshMasterData();
  };

  const saveKra = async (kraData: Partial<Kra>) => {
    if (kraData.id) {
      await api.updateKra(kraData.id, kraData);
    } else {
      await api.createKra(kraData);
    }
    await refreshMasterData();
  };

  return {
    templates,
    kras,
    departments,
    designations,
    employees,
    cycles,
    isLoading,
    error,
    refreshMasterData,
    saveTemplate,
    saveKra,
  };
}
