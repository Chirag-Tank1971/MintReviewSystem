import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { UserRole } from '../types';

// One lookup per employee per page load, shared by the Sidebar and the mobile drawer.
const cache = new Map<string, Promise<boolean>>();

/**
 * Whether the Sales Champs nav item should show: always for HR / Super Admin (they manage it),
 * otherwise only once the employee has a locked scheme document to look at.
 */
export function useHasSalesChamps(role?: UserRole, employeeId?: string): boolean {
  const manages = role === 'SUPER_ADMIN' || role === 'HR';
  const [has, setHas] = useState(false);

  useEffect(() => {
    if (manages || !employeeId) return;
    let alive = true;
    if (!cache.has(employeeId)) {
      cache.set(
        employeeId,
        api.getMySalesChampsReports(employeeId).then((r) => r.length > 0).catch(() => false)
      );
    }
    cache.get(employeeId)!.then((v) => alive && setHas(v));
    return () => { alive = false; };
  }, [manages, employeeId]);

  return manages || has;
}
