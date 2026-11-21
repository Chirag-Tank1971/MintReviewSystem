import express, { Response } from 'express';
import { randomUUID } from 'crypto';
import { getDbCollection } from '../db.js';
import { authenticateToken, requireRoles, recordAuditLog, AuthenticatedRequest } from '../auth.js';

export const achievementRouter = express.Router();
achievementRouter.use(authenticateToken);

/**
 * Sales Achievement report: one per financial year, one row per BDM.
 * Lifecycle matches Sales Champs: DRAFT -> FINAL (HR / Super Admin) -> LOCKED (Super Admin).
 * HR and Super Admin see every report; a BDM sees only their own row, and only once LOCKED.
 */

const AMOUNT_FIELDS = ['targetAchieved', 'actualTarget', 'turnover'] as const;

/** "FY 2024-25", "fy2024-25" and "2024-25" are the same year. */
const normFy = (s: string) => String(s || '').toLowerCase().replace(/^fy\s*/, '').replace(/\s+/g, '');

async function audit(req: AuthenticatedRequest, action: string, id: string, oldVal: any, newVal: any) {
  if (!req.user) return;
  await recordAuditLog(
    req.user.id, req.user.name, req.user.role, 'ACHIEVEMENT_REPORT', action, id,
    oldVal ? JSON.stringify(oldVal) : '', newVal ? JSON.stringify(newVal) : '', ''
  );
}

/** Rows need an existing employee and finite, non-negative amounts. Names come from the employee record. */
export async function cleanRows(rows: unknown): Promise<{ rows?: any[]; error?: string }> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Add at least one BDM row.' };
  if (rows.length > 100) return { error: 'A report can have at most 100 rows.' };
  const seen = new Set<string>();
  const out: any[] = [];
  const employees = getDbCollection('employees');
  for (const raw of rows) {
    const employeeId = String((raw as any)?.employeeId || '');
    if (!employeeId) return { error: 'Every row needs an employee.' };
    if (seen.has(employeeId)) return { error: 'An employee can appear only once in a report.' };
    seen.add(employeeId);
    const emp = await employees.findOne({ id: employeeId });
    if (!emp) return { error: 'A selected employee was not found.' };
    const row: any = { employeeId, employeeName: emp.name };
    for (const f of AMOUNT_FIELDS) {
      const n = Number((raw as any)?.[f] ?? 0);
      if (!Number.isFinite(n) || n < 0) return { error: `${emp.name}: "${f}" must be a non-negative number.` };
      row[f] = n;
    }
    // Percentage Achievement is typed in by the creator (in percent, e.g. 85.5). Blank means "not set".
    const rawPct = (raw as any)?.percentage;
    if (rawPct === undefined || rawPct === null || rawPct === '') {
      row.percentage = null;
    } else {
      const pct = Number(rawPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 10000) return { error: `${emp.name}: percentage must be between 0 and 10000.` };
      row.percentage = pct;
    }
    out.push(row);
  }
  return { rows: out };
}

async function findDuplicate(col: any, financialYear: string, excludeId?: string) {
  const docs = await (await col.find({})).toArray();
  return docs.find((d: any) => d.id !== excludeId && normFy(d.financialYear) === normFy(financialYear));
}

const byNewest = (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

// GET /api/achievement-reports: all reports (HR / Super Admin)
achievementRouter.get('/achievement-reports', requireRoles('SUPER_ADMIN', 'HR'), async (_req, res: Response) => {
  try {
    const docs = await (await getDbCollection('achievementReports').find({})).toArray();
    res.json(docs.sort(byNewest));
  } catch (err) {
    console.error('achievement list error:', err);
    res.status(500).json({ error: 'Failed to fetch achievement reports.' });
  }
});

// GET /api/achievement-reports/mine: locked reports that include the caller, showing only their own row
achievementRouter.get('/achievement-reports/mine', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const myEmpId = req.user?.employeeId;
    if (!myEmpId) return res.json([]);
    const docs = await (await getDbCollection('achievementReports').find({ status: 'LOCKED' })).toArray();
    const mine = docs
      .filter((d: any) => Array.isArray(d.rows) && d.rows.some((r: any) => r.employeeId === myEmpId))
      .map((d: any) => ({ ...d, rows: d.rows.filter((r: any) => r.employeeId === myEmpId) }));
    res.json(mine.sort(byNewest));
  } catch (err) {
    console.error('achievement mine error:', err);
    res.status(500).json({ error: 'Failed to fetch your achievement report.' });
  }
});

// POST /api/achievement-reports: create (HR / Super Admin)
achievementRouter.post('/achievement-reports', requireRoles('SUPER_ADMIN', 'HR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = getDbCollection('achievementReports');
    const financialYear = String(req.body?.financialYear || '').trim();
    if (!financialYear) return res.status(400).json({ error: 'Financial year is required.' });
    const cleaned = await cleanRows(req.body?.rows);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    if (await findDuplicate(col, financialYear)) {
      return res.status(409).json({ error: `An achievement report for ${financialYear} already exists. Edit that one instead.` });
    }
    const now = new Date().toISOString();
    const doc = {
      id: randomUUID(),
      financialYear,
      rows: cleaned.rows,
      status: 'DRAFT' as const,
      createdById: req.user?.id,
      createdByName: req.user?.name,
      reviewedById: null,
      lockedById: null,
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(doc);
    await audit(req, 'ACHIEVEMENT_CREATE', doc.id, null, doc);
    res.status(201).json(doc);
  } catch (err) {
    console.error('achievement create error:', err);
    res.status(500).json({ error: 'Failed to create achievement report.' });
  }
});

// PUT /api/achievement-reports/:id: edit (not locked). Editing a FINAL report sends it back to DRAFT.
achievementRouter.put('/achievement-reports/:id', requireRoles('SUPER_ADMIN', 'HR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = getDbCollection('achievementReports');
    const existing = await col.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Report not found.' });
    if (existing.status === 'LOCKED') return res.status(403).json({ error: 'Locked reports cannot be edited.' });

    const updates: any = { updatedAt: new Date().toISOString() };
    if (req.body?.financialYear !== undefined) {
      const fy = String(req.body.financialYear).trim();
      if (!fy) return res.status(400).json({ error: 'Financial year is required.' });
      if (await findDuplicate(col, fy, existing.id)) {
        return res.status(409).json({ error: `An achievement report for ${fy} already exists.` });
      }
      updates.financialYear = fy;
    }
    if (req.body?.rows !== undefined) {
      const cleaned = await cleanRows(req.body.rows);
      if (cleaned.error) return res.status(400).json({ error: cleaned.error });
      updates.rows = cleaned.rows;
    }
    if (existing.status === 'FINAL') {
      updates.status = 'DRAFT';
      updates.reviewedById = null;
      updates.reviewedByName = null;
    }
    await col.updateOne({ id: existing.id }, { $set: updates });
    const updated = await col.findOne({ id: existing.id });
    await audit(req, 'ACHIEVEMENT_UPDATE', existing.id, existing, updated);
    res.json(updated);
  } catch (err) {
    console.error('achievement update error:', err);
    res.status(500).json({ error: 'Failed to update achievement report.' });
  }
});

// POST /api/achievement-reports/:id/finalize: HR / Super Admin
achievementRouter.post('/achievement-reports/:id/finalize', requireRoles('SUPER_ADMIN', 'HR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = getDbCollection('achievementReports');
    const existing = await col.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Report not found.' });
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: `Only draft reports can be finalized (this one is ${existing.status}).` });
    }
    await col.updateOne(
      { id: existing.id },
      { $set: { status: 'FINAL', reviewedById: req.user?.id, reviewedByName: req.user?.name, updatedAt: new Date().toISOString() } }
    );
    const updated = await col.findOne({ id: existing.id });
    await audit(req, 'ACHIEVEMENT_FINALIZE', existing.id, existing, updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to finalize achievement report.' });
  }
});

// POST /api/achievement-reports/:id/lock: Super Admin. Makes it immutable and visible to the BDMs on it.
achievementRouter.post('/achievement-reports/:id/lock', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = getDbCollection('achievementReports');
    const existing = await col.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Report not found.' });
    if (existing.status === 'LOCKED') return res.status(400).json({ error: 'Already locked.' });
    if (existing.status !== 'FINAL') return res.status(400).json({ error: 'Mark the report as Final before locking it.' });

    const now = new Date().toISOString();
    await col.updateOne(
      { id: existing.id },
      { $set: { status: 'LOCKED', lockedById: req.user?.id, lockedByName: req.user?.name, lockedAt: now, updatedAt: now } }
    );
    const updated = await col.findOne({ id: existing.id });
    await audit(req, 'ACHIEVEMENT_LOCK', existing.id, existing, updated);

    // Tell each BDM on the report that it is now available
    const notifications = getDbCollection('notifications');
    for (const row of existing.rows || []) {
      await notifications.insertOne({
        id: `notif_achievement_${existing.id}_${row.employeeId}`,
        userId: row.employeeId,
        userRole: 'EMPLOYEE',
        type: 'GENERAL',
        title: `Your Sales Achievement report for ${existing.financialYear} is ready`,
        message: `The ${existing.financialYear} achievement report has been finalized. Open Achievement to see your figures.`,
        isRead: false,
        priority: 'MEDIUM',
        metadata: { achievementReportId: existing.id, financialYear: existing.financialYear },
        createdAt: now,
      });
    }
    res.json(updated);
  } catch (err) {
    console.error('achievement lock error:', err);
    res.status(500).json({ error: 'Failed to lock achievement report.' });
  }
});

// DELETE /api/achievement-reports/:id: Super Admin, any status except LOCKED
achievementRouter.delete('/achievement-reports/:id', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = getDbCollection('achievementReports');
    const existing = await col.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Report not found.' });
    if (existing.status === 'LOCKED') return res.status(403).json({ error: 'Locked reports cannot be deleted.' });
    await col.deleteOne({ id: existing.id });
    await audit(req, 'ACHIEVEMENT_DELETE', existing.id, existing, null);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete achievement report.' });
  }
});
