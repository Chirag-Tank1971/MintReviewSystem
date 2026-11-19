import type { Appraisal } from '../../src/types/index.js';

/**
 * What the employee an appraisal is about may see before it is locked.
 *
 * Until the Super Admin locks an appraisal, the recommendation, calibration, return reasons,
 * proposed increment and final rating are internal deliberations between manager, HOD and HR.
 * Showing them early would disclose a pay decision that can still change, so they are removed
 * from every response that goes to the employee (or to anyone looking at their own record).
 * Once locked, the outcome is final and the whole record is visible.
 */
const CONFIDENTIAL_UNTIL_LOCKED = [
  'managerRecommendation',
  'managerRecommendations',
  'managerRemarks',
  'hodRemarks',
  'hodCalibration',
  'hodReturn',
  'hrRemarks',
  'hrApproval',
  'remarks',
  'recommendedRating',
  'promotionRecommended',
  'promotedDesignationId',
  'promotedDesignationName',
  'promotionDesignationId',
  'promotionDesignationName',
  'proposedCtc',
  'proposedIncrementPercentage',
  'suggestedIncrementMin',
  'suggestedIncrementMax',
  'defaultIncrement',
  'incrementPercentage',
  'incrementAmount',
  'approvedIncrementPercentage',
  'revisedCtc',
  'finalCtc',
  'finalRating',
  'effectiveDate',
] as const;

/** Roles that always see the full record, whoever the appraisal is about. */
const FULL_ACCESS_ROLES = new Set(['SUPER_ADMIN', 'HR']);

/** True when this viewer is looking at their own, not-yet-locked appraisal and must not see deliberations. */
export function mustRedactAppraisal(
  appraisal: Pick<Appraisal, 'employeeId' | 'isLocked'>,
  viewer: { role?: string; employeeId?: string }
): boolean {
  if (appraisal.isLocked) return false;
  if (viewer.role && FULL_ACCESS_ROLES.has(viewer.role)) return false;
  if (viewer.role === 'EMPLOYEE') return true;
  return Boolean(viewer.employeeId) && appraisal.employeeId === viewer.employeeId;
}

export function redactAppraisal<T extends Record<string, any>>(appraisal: T): T {
  const copy: Record<string, any> = { ...appraisal };
  for (const key of CONFIDENTIAL_UNTIL_LOCKED) delete copy[key];
  return copy as T;
}

/** Returns the appraisal as this viewer is allowed to see it. */
export function appraisalForViewer<T extends Pick<Appraisal, 'employeeId' | 'isLocked'> & Record<string, any>>(
  appraisal: T,
  viewer: { role?: string; employeeId?: string }
): T {
  return mustRedactAppraisal(appraisal, viewer) ? redactAppraisal(appraisal) : appraisal;
}
