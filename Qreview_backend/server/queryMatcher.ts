// ── MongoDB-compatible filter matching for the fallback store ────────────────
// Covers the operators the routes use, with MongoDB's semantics (a scalar condition on an
// array field matches when the array contains it), so the same queries behave the same in
// both stores. An unsupported operator throws instead of silently matching nothing.

function equalsOrContains(value: any, target: any): boolean {
  if (Array.isArray(value) && !Array.isArray(target)) return value.includes(target);
  return value === target;
}

function matchesValue(value: any, cond: any): boolean {
  const isOperatorObject =
    cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof RegExp) &&
    Object.keys(cond).some((k) => k.startsWith('$'));
  if (cond instanceof RegExp) return matchesValue(value, { $regex: cond });
  if (!isOperatorObject) return equalsOrContains(value, cond);

  return Object.entries(cond).every(([op, arg]: [string, any]) => {
    switch (op) {
      case '$in': return (arg as any[]).some((a) => equalsOrContains(value, a));
      case '$nin': return !(arg as any[]).some((a) => equalsOrContains(value, a));
      case '$ne': return !equalsOrContains(value, arg);
      case '$exists': return (value !== undefined && value !== null) === Boolean(arg);
      case '$gt': return value !== undefined && value !== null && value > arg;
      case '$gte': return value !== undefined && value !== null && value >= arg;
      case '$lt': return value !== undefined && value !== null && value < arg;
      case '$lte': return value !== undefined && value !== null && value <= arg;
      case '$regex': {
        const re = arg instanceof RegExp ? arg : new RegExp(String(arg), cond.$options || '');
        const test = (v: any) => typeof v === 'string' && re.test(v);
        return Array.isArray(value) ? value.some(test) : test(value);
      }
      case '$options': return true;
      default: throw new Error(`Fallback store does not support query operator ${op}`);
    }
  });
}

// Dotted paths ('metadata.reviewId') walk into nested objects.
// ponytail: does not fan out through arrays of objects ('items.kraId'); add that if a query needs it.
const getPath = (obj: any, path: string) => path.split('.').reduce((v, p) => (v == null ? undefined : v[p]), obj);

export function matchesFilter(item: any, filter: any): boolean {
  return Object.entries(filter || {}).every(([key, cond]: [string, any]) => {
    if (key === '$or') return (cond as any[]).some((f) => matchesFilter(item, f));
    if (key === '$and') return (cond as any[]).every((f) => matchesFilter(item, f));
    return matchesValue(key.includes('.') ? getPath(item, key) : item?.[key], cond);
  });
}
