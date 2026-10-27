import { getDbCollection } from './db.js';

/** Escapes user text for safe use inside a RegExp. */
export const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive exact-match regex, e.g. for department names. */
export const exactCi = (value: string) => new RegExp(`^${escapeRegex(value)}$`, 'i');

/** A query-string value that is actually set (not empty, 'ALL' or 'undefined'). */
export const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'ALL' && v !== 'undefined';

/** Combines filter parts into one MongoDB query with $and, skipping empty parts. */
export function allOf(...parts: Array<Record<string, any> | null | undefined>): Record<string, any> {
  const real = parts.filter((p): p is Record<string, any> => !!p && Object.keys(p).length > 0);
  if (real.length === 0) return {};
  return real.length === 1 ? real[0] : { $and: real };
}

/** Ids of employees matching `filter`, fetching only the id field. */
export async function employeeIdsWhere(filter: Record<string, any>): Promise<string[]> {
  const rows = await (await getDbCollection('employees').find(filter, { projection: { id: 1 } })).toArray();
  return rows.map((e: { id: string }) => e.id);
}

/** Current employment status for the given employees only (id → status). */
export async function employeeStatusMap(employeeIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return new Map();
  const rows = await (
    await getDbCollection('employees').find({ id: { $in: ids } }, { projection: { id: 1, status: 1 } })
  ).toArray();
  return new Map(rows.map((e: { id: string; status: string }) => [e.id, e.status]));
}

/** Text search across several string fields (case-insensitive, user input escaped). */
export function searchFilter(term: unknown, fields: string[]): Record<string, any> | null {
  if (typeof term !== 'string' || !term.trim()) return null;
  const re = new RegExp(escapeRegex(term.trim()), 'i');
  return { $or: fields.map((f) => ({ [f]: { $regex: re } })) };
}
