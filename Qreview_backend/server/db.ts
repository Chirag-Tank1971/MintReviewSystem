import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { matchesFilter } from './queryMatcher.js';

import {
  User,
  Role,
  Department,
  Designation,
  Cycle,
  Kra,
  Employee,
  KraTemplate,
  ReviewPeriod,
  EmployeeReview,
  Appraisal,
  Notification,
  AuditLog,
  TalentRecord,
  ComplianceFlag,
  EmailLog,
  DbStatus,
  SystemConfig,
  PerformanceImprovementPlan,
  ReviewReturnDraft,
} from '../src/types/index.js';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let dbMode: 'MONGODB' | 'EMBEDDED_COMPATIBLE' = 'EMBEDDED_COMPATIBLE';
let dbUri: string | undefined = process.env.MONGODB_URI;

const STORAGE_FILE_PATH = path.join(process.cwd(), '.local_database_store.json');

let fullDiskStore: Record<string, any[]> | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

function saveToDisk(collectionName: string, itemsMap: Map<string, any>) {
  try {
    if (!fullDiskStore) {
      if (fs.existsSync(STORAGE_FILE_PATH)) {
        try {
          fullDiskStore = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
        } catch {
          fullDiskStore = {};
        }
      } else {
        fullDiskStore = {};
      }
    }
    fullDiskStore[collectionName] = Array.from(itemsMap.values());

    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(() => {
      try {
        fs.writeFile(STORAGE_FILE_PATH, JSON.stringify(fullDiskStore), 'utf-8', () => {});
      } catch (_e) {
        // quiet fallback
      }
    }, 150);
  } catch (err) {
    // quiet fallback
  }
}

function loadFromDisk(collectionName: string): any[] | null {
  try {
    if (fs.existsSync(STORAGE_FILE_PATH)) {
      const store = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
      if (Array.isArray(store[collectionName]) && store[collectionName].length > 0) {
        return store[collectionName];
      }
    }
  } catch {
    // quiet fallback
  }
  return null;
}

export class MemoryCursor<T> {
  private sortSpec: Record<string, 1 | -1> | null = null;
  private skipN = 0;
  private limitN = 0;
  constructor(private rows: T[]) {}

  sort(spec: Record<string, 1 | -1>) { this.sortSpec = spec; return this; }
  skip(n: number) { this.skipN = Math.max(0, n || 0); return this; }
  limit(n: number) { this.limitN = Math.max(0, n || 0); return this; }

  async toArray(): Promise<T[]> {
    let out = [...this.rows];
    if (this.sortSpec) {
      const keys = Object.entries(this.sortSpec);
      out.sort((a: any, b: any) => {
        for (const [k, dir] of keys) {
          const av = a?.[k], bv = b?.[k];
          if (av === bv) continue;
          if (av === undefined || av === null) return -dir; // missing sorts first ascending, like MongoDB
          if (bv === undefined || bv === null) return dir;
          return (av < bv ? -1 : 1) * dir;
        }
        return 0;
      });
    }
    out = out.slice(this.skipN);
    return this.limitN > 0 ? out.slice(0, this.limitN) : out;
  }
}

// In-memory / document collections store with MongoDB-compatible API and disk persistence
class InMemoryCollection<T extends { id?: string; _id?: any }> {
  private items: Map<string, T> = new Map();
  name: string;

  constructor(name: string, initialData: T[] = []) {
    this.name = name;
    const diskData = loadFromDisk(name);
    const sourceData = diskData && diskData.length > 0 ? diskData : initialData;
    
    sourceData.forEach((item) => {
      const id = item.id || (item as any)._id || `id_${Math.random().toString(36).substr(2, 9)}`;
      this.items.set(String(id), { ...item, id: String(id), _id: String(id) });
    });

    // If initial seed was updated with more items not yet in disk
    if (diskData && diskData.length > 0 && initialData.length > 0) {
      initialData.forEach((seedItem) => {
        const id = seedItem.id || (seedItem as any)._id;
        if (id && !this.items.has(String(id))) {
          this.items.set(String(id), { ...seedItem, id: String(id), _id: String(id) });
        }
      });
    }

    // Ensure departments have budgetCapPercent populated for backward compatibility
    if (name === 'departments') {
      this.items.forEach((dept: any, id: string) => {
        if (typeof dept.budgetCapPercent !== 'number') {
          let cap = 12.0;
          if (dept.code === 'ENG' || dept.id === 'dept_eng') cap = 14.0;
          else if (dept.code === 'SLS' || dept.id === 'dept_sales') cap = 10.0;
          else if (dept.code === 'HR' || dept.id === 'dept_hr') cap = 8.5;
          this.items.set(id, { ...dept, budgetCapPercent: cap });
        }
      });
    }

    // Ensure employees have managerIds and reportsDirectlyToHod populated for backward compatibility
    if (name === 'employees') {
      this.items.forEach((emp: any, id: string) => {
        let changed = false;
        const patch: any = {};
        if (emp.managerId && (!emp.managerIds || emp.managerIds.length === 0)) {
          patch.managerIds = [emp.managerId];
          patch.managerNames = emp.managerName ? [emp.managerName] : [];
          changed = true;
        }
        if (emp.reportsDirectlyToHod === undefined) {
          patch.reportsDirectlyToHod = false;
          changed = true;
        }
        if (changed) {
          this.items.set(id, { ...emp, ...patch });
        }
      });
    }

    // Register default unique constraints for core collections
    if (name === 'employeeReviews') {
      this.uniqueIndexes.push({ fields: ['employeeId', 'reviewPeriodId'], name: 'employeeId_1_reviewPeriodId_1' });
    } else if (name === 'appraisals') {
      this.uniqueIndexes.push({ fields: ['employeeId', 'appraisalYear'], name: 'employeeId_1_appraisalYear_1' });
    }
  }

  // Returns a cursor-like object with MongoDB's chainable sort/skip/limit, so the same
  // `(await col.find(q)).sort(...).skip(...).limit(...).toArray()` code runs on both stores.
  // Projection options are accepted and ignored (full documents are returned).
  async find(filter: any = {}, _options?: any): Promise<MemoryCursor<T>> {
    return new MemoryCursor(Array.from(this.items.values()).filter((item) => matchesFilter(item, filter)));
  }

  async findOne(filter: any = {}): Promise<T | null> {
    const list = (await this.find(filter)).toArray();
    const resolved = await list;
    return resolved.length > 0 ? resolved[0] : null;
  }

  private uniqueIndexes: Array<{ fields: string[]; name: string }> = [];

  async insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }> {
    // Enforce unique index constraints
    for (const uIdx of this.uniqueIndexes) {
      const conflict = Array.from(this.items.values()).find((existing) => {
        return uIdx.fields.every((field) => {
          const docVal = (doc as any)[field];
          const existVal = (existing as any)[field];
          return docVal !== undefined && docVal !== null && docVal === existVal;
        });
      });
      if (conflict) {
        const conflictFields = uIdx.fields.map((f) => `${f}: ${(doc as any)[f]}`).join(', ');
        const error: any = new Error(
          `E11000 duplicate key error collection: ${this.name} index: ${uIdx.name} dup key: { ${conflictFields} }`
        );
        error.code = 11000;
        throw error;
      }
    }

    const id = doc.id || (doc as any)._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const saved = { ...doc, id: String(id), _id: String(id) };
    this.items.set(String(id), saved);
    saveToDisk(this.name, this.items);
    return { insertedId: String(id), acknowledged: true };
  }

  async insertMany(docs: T[]): Promise<{ insertedCount: number; acknowledged: boolean }> {
    for (const doc of docs) {
      await this.insertOne(doc);
    }
    return { insertedCount: docs.length, acknowledged: true };
  }

  async updateOne(filter: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }> {
    const target = await this.findOne(filter);
    if (!target) return { matchedCount: 0, modifiedCount: 0 };

    let updated = { ...target };
    if (update.$set) {
      updated = { ...updated, ...update.$set };
    } else {
      updated = { ...updated, ...update };
    }

    const id = String(target.id || (target as any)._id);
    this.items.set(id, updated);
    saveToDisk(this.name, this.items);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }> {
    const targets = await (await this.find(filter)).toArray();
    let modifiedCount = 0;
    for (const target of targets) {
      let updated = { ...target };
      if (update.$set) {
        updated = { ...updated, ...update.$set };
      } else {
        updated = { ...updated, ...update };
      }
      const id = String(target.id || (target as any)._id);
      this.items.set(id, updated);
      modifiedCount++;
    }
    saveToDisk(this.name, this.items);
    return { matchedCount: targets.length, modifiedCount };
  }

  async deleteMany(filter: any = {}): Promise<{ deletedCount: number }> {
    const targets = await (await this.find(filter)).toArray();
    let deletedCount = 0;
    for (const target of targets) {
      const id = String(target.id || (target as any)._id);
      this.items.delete(id);
      deletedCount++;
    }
    saveToDisk(this.name, this.items);
    return { deletedCount };
  }

  async deleteOne(filter: any): Promise<{ deletedCount: number }> {
    const target = await this.findOne(filter);
    if (!target) return { deletedCount: 0 };
    const id = String(target.id || (target as any)._id);
    this.items.delete(id);
    saveToDisk(this.name, this.items);
    return { deletedCount: 1 };
  }

  async countDocuments(filter: any = {}): Promise<number> {
    const items = await (await this.find(filter)).toArray();
    return items.length;
  }

  async createIndex(keys: any, options?: { unique?: boolean }): Promise<string> {
    if (options?.unique) {
      const fields = Object.keys(keys);
      const name = fields.join('_1_') + '_1';
      if (!this.uniqueIndexes.some((idx) => idx.name === name)) {
        this.uniqueIndexes.push({ fields, name });
      }
      return name;
    }
    return 'index_created';
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }
}

// In-Memory Collections Table
export const memoryDb = {
  users: new InMemoryCollection<User & { passwordHash: string }>('users', []),
  roles: new InMemoryCollection<Role>('roles', []),
  departments: new InMemoryCollection<Department>('departments', []),
  designations: new InMemoryCollection<Designation>('designations', []),
  cycles: new InMemoryCollection<Cycle>('cycles', []),
  kras: new InMemoryCollection<Kra>('kras', []),
  kraTemplates: new InMemoryCollection<KraTemplate>('kra_templates', []),
  employees: new InMemoryCollection<Employee>('employees', []),
  reviewPeriods: new InMemoryCollection<ReviewPeriod>('review_periods', []),
  employeeReviews: new InMemoryCollection<EmployeeReview>('employee_reviews', []),
  appraisals: new InMemoryCollection<Appraisal>('appraisals', []),
  notifications: new InMemoryCollection<Notification>('notifications', []),
  auditLogs: new InMemoryCollection<AuditLog>('audit_logs', []),
  talentRecords: new InMemoryCollection<TalentRecord>('talent_records', []),
  complianceFlags: new InMemoryCollection<ComplianceFlag>('compliance_flags', []),
  emailLogs: new InMemoryCollection<EmailLog>('email_logs', []),
  locations: new InMemoryCollection<any>('locations', []),
  performanceImprovementPlans: new InMemoryCollection<PerformanceImprovementPlan>('performance_improvement_plans', []),
  reviewReturnDrafts: new InMemoryCollection<ReviewReturnDraft>('review_return_drafts', []),
  salesChampsReports: new InMemoryCollection<any>('sales_champs_reports', []),
  systemConfig: new InMemoryCollection<SystemConfig>('system_config', [
    { id: 'default', hodApprovalEnabled: false, selfAssessmentEnabled: false, updatedAt: new Date().toISOString() },
  ]),
};

export async function initDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  dbUri = uri;

  if (uri && uri.trim()) {
    try {
      console.log(`[Database] Connecting to MongoDB instance at: ${uri.replace(/\/\/.*@/, '//***@')}`);
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 4000, connectTimeoutMS: 4000 });
      await mongoClient.connect();
      
      // Parse target database name directly from the URI path (e.g. review_appraisal_db)
      let targetDb = 'review_appraisal_db';
      try {
        const urlParsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
        const pathDb = urlParsed.pathname.replace(/^\//, '').split('?')[0];
        if (pathDb && pathDb !== 'test') {
          targetDb = pathDb;
        }
      } catch {
        // fallback
      }
      mongoDb = mongoClient.db(targetDb);
      
      dbMode = 'MONGODB';
      console.log(`[Database] Connected to MongoDB database '${mongoDb.databaseName}' successfully`);
      await ensureMongoIndexes();
      return;
    } catch (err: any) {
      console.warn(`[Database] MongoDB connection attempt failed: ${err.message}. Running in Persistent Embedded Mode.`);
      dbMode = 'EMBEDDED_COMPATIBLE';
    }
  } else {
    console.log('[Database] No MONGODB_URI found in environment. Initialized in High-Performance Embedded Persistent Document Mode.');
    dbMode = 'EMBEDDED_COMPATIBLE';
  }

  // Register unique indexes for Embedded mode as well
  try {
    await memoryDb.employeeReviews.createIndex({ employeeId: 1, reviewPeriodId: 1 }, { unique: true });
    await memoryDb.appraisals.createIndex({ employeeId: 1, appraisalYear: 1 }, { unique: true });
    await memoryDb.users.createIndex({ email: 1 }, { unique: true });
  } catch (_e) {
    // ignore
  }
}

const MONGO_COLLECTION_MAP: Record<string, string> = {
  reviewPeriods: 'review_periods',
  employeeReviews: 'employee_reviews',
  kraTemplates: 'kra_templates',
  auditLogs: 'audit_logs',
  talentRecords: 'talent_records',
  complianceFlags: 'compliance_flags',
  emailLogs: 'email_logs',
  systemConfig: 'system_config',
  performanceImprovementPlans: 'performance_improvement_plans',
  reviewReturnDrafts: 'review_return_drafts',
  salesChampsReports: 'sales_champs_reports',
};

export function getDbCollection(collectionName: keyof typeof memoryDb): any {
  if (dbMode === 'MONGODB' && mongoDb) {
    const mapped = MONGO_COLLECTION_MAP[collectionName] || collectionName;
    return mongoDb.collection(mapped);
  }
  return memoryDb[collectionName];
}

async function ensureMongoIndexes(): Promise<void> {
  console.log('[Database] Ensuring MongoDB collections and indexes are ready...');
  // Each index is created on its own, so one failure (e.g. duplicate data blocking a unique
  // index) is logged instead of silently skipping every index after it. Re-creating an
  // existing index is a no-op in MongoDB.
  const indexes: Array<[keyof typeof memoryDb, Record<string, 1 | -1>, { unique?: boolean }?]> = [
    // Reviews: every route looks them up by `id`; the list filters below back the scoped queries
    ['employeeReviews', { id: 1 }],
    ['employeeReviews', { employeeId: 1, reviewPeriodId: 1 }, { unique: true }],
    ['employeeReviews', { employeeId: 1 }],
    ['employeeReviews', { managerId: 1 }],
    ['employeeReviews', { managerIds: 1 }],
    ['employeeReviews', { hodId: 1 }],
    ['employeeReviews', { departmentId: 1 }],
    ['employeeReviews', { status: 1 }],
    ['employeeReviews', { reviewPeriodId: 1 }],

    ['appraisals', { id: 1 }],
    ['appraisals', { employeeId: 1, appraisalYear: 1 }, { unique: true }],
    ['appraisals', { employeeId: 1 }],
    ['appraisals', { managerId: 1 }],
    ['appraisals', { managerIds: 1 }],
    ['appraisals', { hodId: 1 }],
    ['appraisals', { departmentId: 1 }],
    ['appraisals', { status: 1 }],
    ['appraisals', { appraisalYear: 1 }],
    ['appraisals', { cycleId: 1 }],

    ['employees', { employeeCode: 1 }, { unique: true }],
    ['employees', { id: 1 }],
    ['employees', { departmentId: 1 }],
    ['employees', { managerId: 1 }],
    ['employees', { managerIds: 1 }],
    ['employees', { hodId: 1 }],
    ['employees', { status: 1 }],

    ['notifications', { id: 1 }],
    ['notifications', { userId: 1 }],
    ['notifications', { isRead: 1 }],

    ['performanceImprovementPlans', { id: 1 }],
    ['performanceImprovementPlans', { employeeId: 1 }],
    ['performanceImprovementPlans', { status: 1 }],
    ['performanceImprovementPlans', { managerId: 1 }],
    ['performanceImprovementPlans', { hodId: 1 }],

    ['auditLogs', { createdAt: -1 }],
    ['auditLogs', { module: 1, createdAt: -1 }],

    ['users', { email: 1 }, { unique: true }],
    ['users', { id: 1 }],
    ['users', { employeeId: 1 }],
  ];

  let failed = 0;
  for (const [collection, keys, options] of indexes) {
    try {
      await getDbCollection(collection).createIndex(keys, options);
    } catch (err: any) {
      failed++;
      console.error(`[Database] Could not create index ${collection} ${JSON.stringify(keys)}: ${err?.message}`);
    }
  }
  console.log(`[Database] MongoDB collections ready and indexed${failed ? ` (${failed} index(es) failed, see above)` : ''}.`);
}

export async function getDatabaseStatus(): Promise<DbStatus> {
  const [
    users,
    employees,
    departments,
    designations,
    cycles,
    kras,
    kraTemplates,
    reviewPeriods,
    employeeReviews,
    appraisals,
    notifications,
    auditLogs,
    emailLogs,
  ] = await Promise.all([
    getDbCollection('users').countDocuments(),
    getDbCollection('employees').countDocuments(),
    getDbCollection('departments').countDocuments(),
    getDbCollection('designations').countDocuments(),
    getDbCollection('cycles').countDocuments(),
    getDbCollection('kras').countDocuments(),
    getDbCollection('kraTemplates').countDocuments(),
    getDbCollection('reviewPeriods').countDocuments(),
    getDbCollection('employeeReviews').countDocuments(),
    getDbCollection('appraisals').countDocuments(),
    getDbCollection('notifications').countDocuments(),
    getDbCollection('auditLogs').countDocuments(),
    getDbCollection('emailLogs').countDocuments(),
  ]);

  const counts = {
    users,
    employees,
    departments,
    designations,
    cycles,
    kras,
    kraTemplates,
    reviewPeriods,
    employeeReviews,
    appraisals,
    notifications,
    auditLogs,
    emailLogs,
  };

  return {
    connected: true,
    mode: dbMode,
    uri: dbUri,
    databaseName: mongoDb ? mongoDb.databaseName : 'review_appraisal_db',
    collections: counts,
  };
}
