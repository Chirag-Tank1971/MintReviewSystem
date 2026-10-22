import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmployeeReview } from '../../src/types/index.js';

const store: Record<string, Map<string, any>> = {};
function fakeCollection(name: string) {
  store[name] ||= new Map();
  const items = store[name];
  return {
    findOne: async (f: any) => (f?.id ? items.get(f.id) ?? null : null),
    find: async () => ({ toArray: async () => Array.from(items.values()) }),
    insertOne: async (doc: any) => {
      items.set(doc.id, doc);
      return { insertedId: doc.id };
    },
    updateOne: async (f: any, u: any) => {
      const cur = items.get(f.id);
      if (cur) items.set(f.id, { ...cur, ...(u.$set || u) });
      return { matchedCount: cur ? 1 : 0 };
    },
    updateMany: async () => ({ matchedCount: 0 }),
    deleteOne: async (f: any) => ({ deletedCount: items.delete(f.id) ? 1 : 0 }),
  };
}

vi.mock('../db.js', () => ({ getDbCollection: (name: string) => fakeCollection(name) }));
vi.mock('../auth.js', () => ({ recordAuditLog: async () => {} }));
vi.mock('./notificationService.js', () => ({
  notifyReviewTransition: async () => {},
  notifyDirectHodSubmission: async () => {},
}));

const { submitManagerReview } = await import('./workflowService.js');

function createDualManagerReview(id = 'rev_dual'): EmployeeReview {
  return {
    id,
    employeeId: 'emp_1',
    employeeCode: 'EMP001',
    employeeName: 'Alice Dev',
    departmentId: 'dept_eng',
    departmentName: 'Engineering',
    designationName: 'Senior Engineer',
    reviewPeriodId: 'per_q1',
    reviewPeriodName: 'Q1 2026',
    cycleId: 'cyc_1',
    cycleCode: 'Q1',
    createdAt: new Date().toISOString(),
    managerId: 'mgr_1',
    managerName: 'Manager One',
    managerIds: ['mgr_1', 'mgr_2'],
    managerNames: ['Manager One', 'Manager Two'],
    hodId: 'hod_1',
    hodName: 'Head of Dept',
    status: 'MANAGER_PENDING',
    kraSnapshot: [
      {
        id: 'kra_1',
        kraId: 'k1',
        kraName: 'Feature Delivery',
        title: 'Feature Delivery',
        targetSnapshot: 'Deliver on time',
        weight: 60,
        rating: 0,
        achievement: '',
        comments: '',
      },
      {
        id: 'kra_2',
        kraId: 'k2',
        kraName: 'Code Quality',
        title: 'Code Quality',
        targetSnapshot: 'Zero critical bugs',
        weight: 40,
        rating: 0,
        achievement: '',
        comments: '',
      },
    ],
  };
}

describe('Dual Manager Review Scoring', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      store[key].clear();
    }
  });

  it('keeps review in MANAGER_PENDING when only Manager 1 submits and records partial submission', async () => {
    const review = createDualManagerReview('rev_partial');
    const reviewsCol = fakeCollection('employeeReviews');
    await reviewsCol.insertOne(review);

    const m1User = { id: 'usr_mgr1', employeeId: 'mgr_1', name: 'Manager One', role: 'MANAGER' as const };
    const result = await submitManagerReview(
      'rev_partial',
      {
        kraSnapshot: [
          { id: 'kra_1', rating: 4, comments: 'Good job' },
          { id: 'kra_2', rating: 4, comments: 'Clean code' },
        ],
        strengths: 'Fast delivery',
        improvements: 'Testing',
      },
      m1User
    );

    expect(result.status).toBe('MANAGER_PENDING');
    expect(result.managerSubmissions?.['mgr_1']?.submitted).toBe(true);
    expect(result.managerSubmissions?.['mgr_1']?.score).toBe(4);
    expect(result.managerSubmissions?.['mgr_2']?.submitted).toBeFalsy();
    expect(result.actionHistory?.some((a) => a.action === 'MANAGER_PARTIAL_SUBMITTED')).toBe(true);
  });

  it('averages KRA ratings and transitions to HOD_PENDING once both managers submit', async () => {
    const review = createDualManagerReview('rev_full');
    const reviewsCol = fakeCollection('employeeReviews');
    await reviewsCol.insertOne(review);

    // Manager 1 submits (rates kra_1 = 4, kra_2 = 4 -> score = 4.0)
    const m1User = { id: 'usr_mgr1', employeeId: 'mgr_1', name: 'Manager One', role: 'MANAGER' as const };
    await submitManagerReview(
      'rev_full',
      {
        kraSnapshot: [
          { id: 'kra_1', rating: 4, comments: 'M1 comment 1' },
          { id: 'kra_2', rating: 4, comments: 'M1 comment 2' },
        ],
      },
      m1User
    );

    // Manager 2 submits (rates kra_1 = 2, kra_2 = 4)
    // kra_1 average = (4 + 2) / 2 = 3.0 (weight 60% -> 1.8)
    // kra_2 average = (4 + 4) / 2 = 4.0 (weight 40% -> 1.6)
    // Final weighted score = 1.8 + 1.6 = 3.4
    const m2User = { id: 'usr_mgr2', employeeId: 'mgr_2', name: 'Manager Two', role: 'MANAGER' as const };
    const finalResult = await submitManagerReview(
      'rev_full',
      {
        kraSnapshot: [
          { id: 'kra_1', rating: 2, comments: 'M2 comment 1', ratingJustification: 'Missed deadline' },
          { id: 'kra_2', rating: 4, comments: 'M2 comment 2' },
        ],
      },
      m2User
    );

    expect(finalResult.status).toBe('HOD_PENDING');
    expect(finalResult.managerSubmissions?.['mgr_1']?.submitted).toBe(true);
    expect(finalResult.managerSubmissions?.['mgr_2']?.submitted).toBe(true);

    const kra1 = finalResult.kraSnapshot?.find((k) => k.id === 'kra_1');
    const kra2 = finalResult.kraSnapshot?.find((k) => k.id === 'kra_2');
    expect(kra1?.rating).toBe(3);
    expect(kra2?.rating).toBe(4);
    expect(finalResult.finalScore).toBe(3.4);
    expect(finalResult.managerScore).toBe(3.4);
    expect(finalResult.actionHistory?.some((a) => a.action === 'SUBMITTED')).toBe(true);
  });
});
