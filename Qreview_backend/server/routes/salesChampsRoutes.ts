import express, { Response } from 'express';
import { getDbCollection } from '../db.js';
import { authenticateToken, requireRoles, recordAuditLog, AuthenticatedRequest } from '../auth.js';
import { randomUUID } from 'crypto';

export const salesChampsRouter = express.Router();
salesChampsRouter.use(authenticateToken);

async function logChampsAudit(req: AuthenticatedRequest, action: string, recordId: string, oldVal: any, newVal: any, details?: string) {
  if (!req.user) return;
  await recordAuditLog(
    req.user.id,
    req.user.name,
    req.user.role,
    'SALES_CHAMPS',
    action,
    recordId,
    oldVal ? JSON.stringify(oldVal) : '',
    newVal ? JSON.stringify(newVal) : '',
    details || ''
  );
}

const SLAB_FIELDS = ['amcTargetLacs', 'amcIncentiveLacs', 'gm2AchievementLacs', 'salesIncentiveLacs'] as const;

/** Slabs must be a non-empty array of rows whose four amounts are finite, non-negative numbers. */
export function cleanSlabs(slabs: unknown): { slabs?: Record<string, number>[]; error?: string } {
  if (!Array.isArray(slabs) || slabs.length === 0) return { error: 'At least one slab row is required.' };
  const out: Record<string, number>[] = [];
  for (const row of slabs) {
    const clean: Record<string, number> = {};
    for (const f of SLAB_FIELDS) {
      const n = Number((row as any)?.[f] ?? 0);
      if (!Number.isFinite(n) || n < 0) return { error: `Slab value "${f}" must be a non-negative number.` };
      clean[f] = n;
    }
    out.push(clean);
  }
  return { slabs: out };
}

/** One report per employee per financial year. */
async function findDuplicate(col: any, employeeId: string, financialYear: string, excludeId?: string) {
  const docs = await (await col.find({ employeeId, financialYear })).toArray();
  return docs.find((d: any) => d.id !== excludeId);
}

// ──────────────────────────────────────────────
// GET /api/sales-champs  — list all (HR/Admin)
// ──────────────────────────────────────────────
salesChampsRouter.get(
  '/sales-champs',
  requireRoles('SUPER_ADMIN', 'HR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const { financialYear, status } = req.query;
      const query: any = {};
      if (financialYear) query.financialYear = financialYear;
      if (status) query.status = status;
      const docs = await (await col.find(query)).toArray();
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(docs);
    } catch (err: any) {
      console.error('sales-champs list error:', err);
      res.status(500).json({ error: 'Failed to fetch Sales Champs reports.' });
    }
  }
);

// ──────────────────────────────────────────────
// GET /api/sales-champs/employee/:employeeId  — employee's own report
// ──────────────────────────────────────────────
salesChampsRouter.get(
  '/sales-champs/employee/:employeeId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const { employeeId } = req.params;
      const { financialYear } = req.query;

      const role = req.user?.role;
      const myEmpId = req.user?.employeeId;

      // Non-admin users can only fetch their own
      if (role !== 'SUPER_ADMIN' && role !== 'HR' && myEmpId !== employeeId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const query: any = { employeeId };
      // Non-admin users can ONLY view LOCKED reports
      if (role !== 'SUPER_ADMIN' && role !== 'HR') {
        query.status = 'LOCKED';
      }
      if (financialYear) query.financialYear = financialYear;
      const docs = await (await col.find(query)).toArray();
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(docs);
    } catch (err: any) {
      console.error('sales-champs employee fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch report.' });
    }
  }
);

// ──────────────────────────────────────────────
// GET /api/sales-champs/:id
// ──────────────────────────────────────────────
salesChampsRouter.get(
  '/sales-champs/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const doc = await col.findOne({ id: req.params.id });
      if (!doc) return res.status(404).json({ error: 'Report not found.' });

      const role = req.user?.role;
      const myEmpId = req.user?.employeeId;
      if (role !== 'SUPER_ADMIN' && role !== 'HR') {
        if (doc.employeeId !== myEmpId || doc.status !== 'LOCKED') {
          return res.status(403).json({ error: 'Access denied.' });
        }
      }
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch report.' });
    }
  }
);

// ──────────────────────────────────────────────
// POST /api/sales-champs  — create (HR only)
// ──────────────────────────────────────────────
salesChampsRouter.post(
  '/sales-champs',
  requireRoles('SUPER_ADMIN', 'HR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const {
        employeeId, financialYear, fyDateRange,
        publishedDate, gm2TargetCr, slabs, mintValue,
        incentiveSchemeName, rules, customRuleText,
      } = req.body;

      if (!employeeId || !financialYear || !String(gm2TargetCr || '').trim()) {
        return res.status(400).json({ error: 'Employee, financial year and GM2 target are required.' });
      }
      const slabCheck = cleanSlabs(slabs);
      if (slabCheck.error) return res.status(400).json({ error: slabCheck.error });

      // Name comes from the employee record, never from the client
      const emp = await getDbCollection('employees').findOne({ id: employeeId });
      if (!emp) return res.status(400).json({ error: 'Selected employee was not found.' });

      const dup = await findDuplicate(col, employeeId, financialYear);
      if (dup) {
        return res.status(409).json({ error: `${emp.name} already has a Sales Champs report for ${financialYear}. Edit that one instead.` });
      }

      const now = new Date().toISOString();
      const doc = {
        id: randomUUID(),
        employeeId, employeeName: emp.name, financialYear,
        fyDateRange: fyDateRange || '',
        publishedDate: publishedDate || '',
        gm2TargetCr: String(gm2TargetCr).trim(),
        slabs: slabCheck.slabs,
        mintValue: mintValue || 'Strive for Excellence',
        incentiveSchemeName: incentiveSchemeName || '',
        rules: rules || {},
        customRuleText: customRuleText || '',
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
      await logChampsAudit(req, 'SALES_CHAMPS_CREATE', doc.id, null, doc);
      res.status(201).json(doc);
    } catch (err: any) {
      console.error('sales-champs create error:', err);
      res.status(500).json({ error: 'Failed to create report.' });
    }
  }
);

// ──────────────────────────────────────────────
// PUT /api/sales-champs/:id  — update (HR, not locked). Editing a FINAL report sends it back to DRAFT.
// ──────────────────────────────────────────────
salesChampsRouter.put(
  '/sales-champs/:id',
  requireRoles('SUPER_ADMIN', 'HR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const existing = await col.findOne({ id: req.params.id });
      if (!existing) return res.status(404).json({ error: 'Report not found.' });
      if (existing.status === 'LOCKED') {
        return res.status(403).json({ error: 'Locked reports cannot be edited.' });
      }

      const {
        employeeId, financialYear, fyDateRange,
        publishedDate, gm2TargetCr, slabs, mintValue,
        incentiveSchemeName, rules, customRuleText,
      } = req.body;

      const updates: any = {
        updatedAt: new Date().toISOString(),
      };
      if (employeeId !== undefined && employeeId !== existing.employeeId) {
        const emp = await getDbCollection('employees').findOne({ id: employeeId });
        if (!emp) return res.status(400).json({ error: 'Selected employee was not found.' });
        updates.employeeId = employeeId;
        updates.employeeName = emp.name;
      }
      if (financialYear !== undefined) updates.financialYear = financialYear;
      const dup = await findDuplicate(
        col,
        updates.employeeId || existing.employeeId,
        updates.financialYear || existing.financialYear,
        existing.id
      );
      if (dup) {
        return res.status(409).json({ error: `This employee already has a Sales Champs report for ${updates.financialYear || existing.financialYear}.` });
      }
      if (fyDateRange !== undefined) updates.fyDateRange = fyDateRange;
      if (publishedDate !== undefined) updates.publishedDate = publishedDate;
      if (gm2TargetCr !== undefined) {
        if (!String(gm2TargetCr).trim()) return res.status(400).json({ error: 'GM2 target is required.' });
        updates.gm2TargetCr = String(gm2TargetCr).trim();
      }
      if (slabs !== undefined) {
        const slabCheck = cleanSlabs(slabs);
        if (slabCheck.error) return res.status(400).json({ error: slabCheck.error });
        updates.slabs = slabCheck.slabs;
      }
      // A finalized report that changes must be reviewed again before it can be locked
      if (existing.status === 'FINAL') {
        updates.status = 'DRAFT';
        updates.reviewedById = null;
        updates.reviewedByName = null;
      }
      if (mintValue !== undefined) updates.mintValue = mintValue;
      if (incentiveSchemeName !== undefined) updates.incentiveSchemeName = incentiveSchemeName;
      if (rules !== undefined) updates.rules = rules;
      if (customRuleText !== undefined) updates.customRuleText = customRuleText;

      await col.updateOne({ id: req.params.id }, { $set: updates });
      const updated = await col.findOne({ id: req.params.id });
      await logChampsAudit(req, 'SALES_CHAMPS_UPDATE', req.params.id, existing, updated);
      res.json(updated);
    } catch (err: any) {
      console.error('sales-champs update error:', err);
      res.status(500).json({ error: 'Failed to update report.' });
    }
  }
);

// ──────────────────────────────────────────────
// POST /api/sales-champs/:id/finalize  — HR marks FINAL
// ──────────────────────────────────────────────
salesChampsRouter.post(
  '/sales-champs/:id/finalize',
  requireRoles('SUPER_ADMIN', 'HR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const existing = await col.findOne({ id: req.params.id });
      if (!existing) return res.status(404).json({ error: 'Report not found.' });
      if (existing.status !== 'DRAFT') {
        return res.status(400).json({ error: `Only draft reports can be finalized (this one is ${existing.status}).` });
      }
      const now = new Date().toISOString();
      await col.updateOne(
        { id: req.params.id },
        { $set: { status: 'FINAL', reviewedById: req.user?.id, reviewedByName: req.user?.name, updatedAt: now } }
      );
      const updated = await col.findOne({ id: req.params.id });
      await logChampsAudit(req, 'SALES_CHAMPS_FINALIZE', req.params.id, existing, updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to finalize report.' });
    }
  }
);

// ──────────────────────────────────────────────
// POST /api/sales-champs/:id/lock  — Admin locks (immutable)
// ──────────────────────────────────────────────
salesChampsRouter.post(
  '/sales-champs/:id/lock',
  requireRoles('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const existing = await col.findOne({ id: req.params.id });
      if (!existing) return res.status(404).json({ error: 'Report not found.' });
      if (existing.status === 'LOCKED') return res.status(400).json({ error: 'Already locked.' });
      if (existing.status !== 'FINAL') {
        return res.status(400).json({ error: 'Mark the report as Final before locking it.' });
      }

      const now = new Date().toISOString();
      await col.updateOne(
        { id: req.params.id },
        { $set: { status: 'LOCKED', lockedById: req.user?.id, lockedByName: req.user?.name, lockedAt: now, updatedAt: now } }
      );
      const updated = await col.findOne({ id: req.params.id });
      await logChampsAudit(req, 'SALES_CHAMPS_LOCK', req.params.id, existing, updated);

      // Tell the employee their scheme document is now available
      await getDbCollection('notifications').insertOne({
        id: `notif_champs_${existing.id}_locked`,
        userId: existing.employeeId,
        userRole: 'EMPLOYEE',
        type: 'GENERAL',
        title: `Your Sales Champs scheme for ${existing.financialYear} is ready`,
        message: `Your MINT Champs incentive scheme for ${existing.financialYear} has been approved and locked. Open Sales Champs to view or download it.`,
        isRead: false,
        priority: 'MEDIUM',
        metadata: { salesChampsReportId: existing.id, financialYear: existing.financialYear },
        createdAt: now,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to lock report.' });
    }
  }
);

// ──────────────────────────────────────────────
// DELETE /api/sales-champs/:id  — Admin only, any status except LOCKED
// ──────────────────────────────────────────────
salesChampsRouter.delete(
  '/sales-champs/:id',
  requireRoles('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const col = getDbCollection('salesChampsReports');
      const existing = await col.findOne({ id: req.params.id });
      if (!existing) return res.status(404).json({ error: 'Report not found.' });
      if (existing.status === 'LOCKED') {
        return res.status(403).json({ error: 'Locked reports cannot be deleted.' });
      }
      await col.deleteOne({ id: req.params.id });
      await logChampsAudit(req, 'SALES_CHAMPS_DELETE', req.params.id, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete report.' });
    }
  }
);
