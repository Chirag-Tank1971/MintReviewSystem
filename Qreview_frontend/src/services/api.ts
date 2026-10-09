import {
  User,
  Employee,
  Department,
  Designation,
  Cycle,
  Kra,
  KraTemplate,
  ReviewPeriod,
  EmployeeReview,
  ReviewSummaryStats,
  ReviewKraSnapshot,
  ReviewStatus,
  Appraisal,
  AppraisalSummaryStats,
  DbStatus,
  TalentRecord,
  AiReviewSynthesisRequest,
  AiReviewSynthesisResult,
  AiTalentInsightsRequest,
  AiTalentInsightsResult,
  CreateEmployeePayload,
  CreateEmployeeResponse,
  UpdateEmployeePayload,
  ManagementDashboardData,
  ManagementDepartmentPerformanceItem,
  ManagementPerformanceTrendsData,
  ManagementPerformerItem,
  ManagementAttentionItem,
  ManagementAppraisalSummaryData,
  ManagementEmployeeDossier,
  ManagementWorkforceRiskData,
  PerformanceImprovementPlan,
  DepartmentBudgetSnapshot,
  DashboardSummary,
  ReturnPolicy,
  ReturnSelection,
  ReviewReturnDraft,
} from '../types'

// Resolve API Base URL: respects VITE_API_BASE_URL; falls back to relative '/api' in production
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : import.meta.env.PROD
    ? '/api'
    : (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('review_app_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Older review records store empty KRA fields as null, but the API validates optional fields
 * as "value or absent" and rejects null. The server keeps the stored value for any field that
 * isn't sent, so leaving nulls out never erases data.
 */
function withoutNulls<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null)) as T;
}

function cleanSnapshotPayload<T extends { kraSnapshot?: ReviewKraSnapshot[] }>(data: T): T {
  const cleaned = withoutNulls(data);
  return data.kraSnapshot ? { ...cleaned, kraSnapshot: data.kraSnapshot.map(withoutNulls) } : cleaned;
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Transparent fetch wrapper with automatic token refresh and failed request replay
 */
async function fetchWithAutoRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const currentToken = localStorage.getItem('review_app_token');
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  options.headers = headers;

  const res = await fetch(url, options);

  // If 401 Unauthorized and not an auth endpoint, attempt transparent token refresh
  if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('review_app_refresh_token');
    if (!refreshToken) {
      return res;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.token) {
            localStorage.setItem('review_app_token', data.token);
          }
          if (data.refreshToken) {
            localStorage.setItem('review_app_refresh_token', data.refreshToken);
          }
          isRefreshing = false;
          onRefreshed(data.token);

          // Retry the original request with the fresh token
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${data.token}`);
          options.headers = retryHeaders;
          return fetch(url, options);
        } else {
          // Refresh token expired or revoked
          isRefreshing = false;
          refreshSubscribers = [];
          localStorage.removeItem('review_app_token');
          localStorage.removeItem('review_app_refresh_token');
          window.dispatchEvent(new CustomEvent('auth:session_expired'));
          return res;
        }
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        return res;
      }
    } else {
      // If refresh is already in flight, queue this request
      return new Promise<Response>((resolve) => {
        refreshSubscribers.push((newToken: string) => {
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          options.headers = retryHeaders;
          resolve(fetch(url, options));
        });
      });
    }
  }

  return res;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

async function requestWithDedupeAndCache<T>(
  url: string,
  options?: RequestInit,
  cacheTtlMs: number = 0
): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    const res = await fetchWithAutoRefresh(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Request failed with status ${res.status}` }));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  const now = Date.now();
  const cacheKey = url;

  if (cacheTtlMs > 0 && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey)!;
    if (cached.expiresAt > now) {
      return cached.data;
    }
    memoryCache.delete(cacheKey);
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetchWithAutoRefresh(url, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed with status ${res.status}` }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (cacheTtlMs > 0) {
        memoryCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
      }
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export const api = {
  // Auth & Session
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Authentication failed' }));
      let msg = err.error || 'Login failed';
      if (typeof err.remainingAttempts === 'number') {
        msg += err.remainingAttempts === 0
          ? ' Your account is now locked. Please try again in 15 minutes.'
          : ` ${err.remainingAttempts} attempt${err.remainingAttempts !== 1 ? 's' : ''} remaining before lockout.`;
      }
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('review_app_token', data.token);
    if (data.refreshToken) localStorage.setItem('review_app_refresh_token', data.refreshToken);
    return data;
  },

  async getMe(): Promise<{ user: User; employeeProfile?: Employee; permissions: string[] }> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error('Session expired or invalid token');
    }
    return res.json();
  },

  async switchRole(role?: string, userId?: string) {
    const res = await fetchWithAutoRefresh(`${API_BASE}/auth/switch-role`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role, userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Role switch failed' }));
      throw new Error(err.error || 'Failed to switch role');
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('review_app_token', data.token);
    if (data.refreshToken) localStorage.setItem('review_app_refresh_token', data.refreshToken);
    return data;
  },

  async getDemoUsers() {
    const res = await fetchWithAutoRefresh(`${API_BASE}/auth/demo-users`);
    if (!res.ok) throw new Error('Failed to fetch demo users');
    return res.json();
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('review_app_token');
    localStorage.removeItem('review_app_refresh_token');
  },

  async refreshToken(): Promise<{ token: string; refreshToken?: string; user: User; employeeProfile?: Employee; permissions: string[] }> {
    const storedRefresh = localStorage.getItem('review_app_refresh_token') || localStorage.getItem('review_app_token');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Token refresh failed' }));
      throw new Error(err.error || 'Failed to refresh token');
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('review_app_token', data.token);
    if (data.refreshToken) localStorage.setItem('review_app_refresh_token', data.refreshToken);
    return data;
  },

  async revokeSessions(userId?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/auth/revoke-sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to revoke sessions' }));
      throw new Error(err.error || 'Failed to revoke sessions');
    }
    return res.json();
  },

  async changePassword(newPassword: string, confirmPassword: string): Promise<{ success: boolean; user: User; token: string; refreshToken?: string }> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword, confirmPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Password change failed' }));
      throw new Error(err.error || 'Failed to change password');
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('review_app_token', data.token);
    if (data.refreshToken) localStorage.setItem('review_app_refresh_token', data.refreshToken);
    return data;
  },

  async getDbStatus(): Promise<DbStatus> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/system/db-status`);
    if (!res.ok) throw new Error('Failed to fetch DB status');
    return res.json();
  },

  // Employees API
  async getEmployees(params?: { departmentId?: string; cycleId?: string; status?: string; search?: string }): Promise<Employee[]> {
    const query = new URLSearchParams();
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    return requestWithDedupeAndCache<Employee[]>(
      `${API_BASE}/employees?${query.toString()}`,
      { headers: getAuthHeaders() },
      60000 // 60s cache
    );
  },

  async getEmployeeById(id: string): Promise<Employee> {
    return requestWithDedupeAndCache<Employee>(
      `${API_BASE}/employees/${id}`,
      { headers: getAuthHeaders() },
      60000
    );
  },

  async createEmployee(data: CreateEmployeePayload): Promise<CreateEmployeeResponse> {
    invalidateApiCache('/employees');
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create employee' }));
      throw new Error(err.error || 'Failed to create employee');
    }
    return res.json();
  },

  async updateEmployee(id: string, data: UpdateEmployeePayload): Promise<Employee> {
    invalidateApiCache('/employees');
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update employee' }));
      throw new Error(err.error || 'Failed to update employee');
    }
    return res.json();
  },

  async deleteEmployee(id: string): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('/employees');
    invalidateApiCache('/departments');
    invalidateApiCache('/reviews');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete employee' }));
      throw new Error(err.error || 'Failed to delete employee');
    }
    return res.json();
  },

  // Departments API
  async getDepartments(): Promise<Department[]> {
    return requestWithDedupeAndCache<Department[]>(
      `${API_BASE}/departments`,
      { headers: getAuthHeaders() },
      180000 // 3 min cache
    );
  },

  async createDepartment(data: { name: string; code: string; hodId?: string; hodName?: string; budgetCapPercent?: number }): Promise<Department> {
    invalidateApiCache('/departments');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create department' }));
      throw new Error(err.error || 'Failed to create department');
    }
    return res.json();
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    invalidateApiCache('/departments');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update department' }));
      throw new Error(err.error || 'Failed to update department');
    }
    return res.json();
  },

  async deleteDepartment(id: string): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('/departments');
    invalidateApiCache('/designations');
    invalidateApiCache('/employees');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete department' }));
      throw new Error(err.error || 'Failed to delete department');
    }
    return res.json();
  },

  // Designations API
  async getDesignations(): Promise<Designation[]> {
    return requestWithDedupeAndCache<Designation[]>(
      `${API_BASE}/designations`,
      { headers: getAuthHeaders() },
      180000 // 3 min cache
    );
  },

  async createDesignation(data: { name: string; departmentId: string; level: number }): Promise<Designation> {
    invalidateApiCache('/designations');
    const res = await fetch(`${API_BASE}/designations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create designation' }));
      throw new Error(err.error || 'Failed to create designation');
    }
    return res.json();
  },

  async deleteDesignation(id: string): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('/designations');
    invalidateApiCache('/employees');
    const res = await fetch(`${API_BASE}/designations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete designation' }));
      throw new Error(err.error || 'Failed to delete designation');
    }
    return res.json();
  },

  // Locations API
  async getLocations(): Promise<{ id?: string; name: string; employeeCount: number; assignedEmployees?: { id: string; name: string; employeeCode: string }[] }[]> {
    return requestWithDedupeAndCache<{ id?: string; name: string; employeeCount: number; assignedEmployees?: { id: string; name: string; employeeCode: string }[] }[]>(
      `${API_BASE}/locations`,
      { headers: getAuthHeaders() },
      30000 // 30 sec cache
    );
  },

  async createLocation(name: string): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('/locations');
    const res = await fetch(`${API_BASE}/locations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create location' }));
      throw new Error(err.error || 'Failed to create location');
    }
    return res.json();
  },

  async deleteLocation(name: string): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('/locations');
    const res = await fetch(`${API_BASE}/locations/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete location' }));
      throw new Error(err.error || 'Failed to delete location');
    }
    return res.json();
  },

  // Cycles API
  async getCycles(): Promise<Cycle[]> {
    return requestWithDedupeAndCache<Cycle[]>(
      `${API_BASE}/cycles`,
      { headers: getAuthHeaders() },
      180000 // 3 min cache
    );
  },

  async updateCycle(id: string, data: Partial<Cycle>): Promise<Cycle> {
    invalidateApiCache('/cycles');
    const res = await fetch(`${API_BASE}/cycles/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update cycle' }));
      throw new Error(err.error || 'Failed to update cycle');
    }
    return res.json();
  },

  // KRA Master Library API
  async getKras(params?: { departmentId?: string; search?: string }): Promise<Kra[]> {
    const query = new URLSearchParams();
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.search) query.append('search', params.search);

    return requestWithDedupeAndCache<Kra[]>(
      `${API_BASE}/kras?${query.toString()}`,
      { headers: getAuthHeaders() },
      180000 // 3 min cache
    );
  },

  async createKra(data: Partial<Kra>): Promise<Kra> {
    invalidateApiCache('/kras');
    const res = await fetch(`${API_BASE}/kras`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create KRA' }));
      throw new Error(err.error || 'Failed to create KRA');
    }
    return res.json();
  },

  async updateKra(id: string, data: Partial<Kra>): Promise<Kra> {
    invalidateApiCache('/kras');
    const res = await fetch(`${API_BASE}/kras/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update KRA' }));
      throw new Error(err.error || 'Failed to update KRA');
    }
    return res.json();
  },

  // KRA Templates API
  async getKraTemplates(params?: { departmentId?: string; designationId?: string; search?: string }): Promise<KraTemplate[]> {
    const query = new URLSearchParams();
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.designationId) query.append('designationId', params.designationId);
    if (params?.search) query.append('search', params.search);

    return requestWithDedupeAndCache<KraTemplate[]>(
      `${API_BASE}/kra-templates?${query.toString()}`,
      { headers: getAuthHeaders() },
      180000 // 3 min cache
    );
  },

  async getKraTemplateById(id: string): Promise<KraTemplate> {
    return requestWithDedupeAndCache<KraTemplate>(
      `${API_BASE}/kra-templates/${id}`,
      { headers: getAuthHeaders() },
      180000
    );
  },

  async createKraTemplate(data: Partial<KraTemplate>): Promise<KraTemplate> {
    invalidateApiCache('/kra-templates');
    const res = await fetch(`${API_BASE}/kra-templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create KRA template' }));
      throw new Error(err.error || 'Failed to create KRA template');
    }
    return res.json();
  },

  async updateKraTemplate(id: string, data: Partial<KraTemplate>): Promise<KraTemplate> {
    invalidateApiCache('/kra-templates');
    const res = await fetch(`${API_BASE}/kra-templates/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update KRA template' }));
      throw new Error(err.error || 'Failed to update KRA template');
    }
    return res.json();
  },

  // ==========================================
  // PHASE 4: REVIEW PERIODS & REVIEWS API
  // ==========================================

  async getReviewPeriods(): Promise<ReviewPeriod[]> {
    return requestWithDedupeAndCache<ReviewPeriod[]>(
      `${API_BASE}/review-periods`,
      { headers: getAuthHeaders() },
      120000 // 2 min cache
    );
  },

  async createReviewPeriod(data: Partial<ReviewPeriod>): Promise<ReviewPeriod> {
    invalidateApiCache('/review-periods');
    const res = await fetch(`${API_BASE}/review-periods`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create review period' }));
      throw new Error(err.error || 'Failed to create review period');
    }
    return res.json();
  },

  async updateReviewPeriod(id: string, data: Partial<ReviewPeriod>): Promise<ReviewPeriod> {
    invalidateApiCache('/review-periods');
    const res = await fetch(`${API_BASE}/review-periods/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update review period' }));
      throw new Error(err.error || 'Failed to update review period');
    }
    return res.json();
  },

  async getReviews(params?: {
    periodId?: string;
    departmentId?: string;
    managerId?: string;
    employeeId?: string;
    status?: string;
    search?: string;
    onlyMine?: boolean;
  }): Promise<EmployeeReview[]> {
    const query = new URLSearchParams();
    if (params?.periodId) query.append('periodId', params.periodId);
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.managerId) query.append('managerId', params.managerId);
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.onlyMine) query.append('onlyMine', 'true');

    return requestWithDedupeAndCache<EmployeeReview[]>(
      `${API_BASE}/reviews?${query.toString()}`,
      { headers: getAuthHeaders() },
      0 // In-flight request deduplication without stale data risk
    );
  },

  async getReviewById(id: string): Promise<EmployeeReview> {
    return requestWithDedupeAndCache<EmployeeReview>(
      `${API_BASE}/reviews/${id}`,
      { headers: getAuthHeaders() },
      0
    );
  },

  async getReviewStats(params?: { periodId?: string; departmentId?: string }): Promise<ReviewSummaryStats> {
    const query = new URLSearchParams();
    if (params?.periodId) query.append('periodId', params.periodId);
    if (params?.departmentId) query.append('departmentId', params.departmentId);

    return requestWithDedupeAndCache<ReviewSummaryStats>(
      `${API_BASE}/reviews/stats?${query.toString()}`,
      { headers: getAuthHeaders() },
      0
    );
  },

  async generateBatchReviews(data: {
    reviewPeriodId: string;
    departmentId?: string;
    cycleId?: string;
    overrideExisting?: boolean;
  }): Promise<{ message: string; createdCount: number; skippedCount: number; periodName: string }> {
    const res = await fetch(`${API_BASE}/reviews/generate-batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate reviews' }));
      throw new Error(err.error || 'Failed to generate reviews');
    }
    return res.json();
  },

  async previewBatchReviews(params: {
    reviewPeriodId: string;
    departmentId?: string;
    cycleId?: string;
    overrideExisting?: boolean;
  }): Promise<{ eligibleCount: number; skippedExisting: number; skippedTenure: number; skippedNoKra: number }> {
    const query = new URLSearchParams({ reviewPeriodId: params.reviewPeriodId });
    if (params.departmentId) query.set('departmentId', params.departmentId);
    if (params.cycleId) query.set('cycleId', params.cycleId);
    if (params.overrideExisting) query.set('overrideExisting', 'true');

    const res = await fetch(`${API_BASE}/reviews/generate-batch/preview?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to preview eligible employees' }));
      throw new Error(err.error || 'Failed to preview eligible employees');
    }
    return res.json();
  },

  async checkReviewEligibility(employeeId: string, reviewPeriodId: string): Promise<{
    eligible: boolean;
    canInitiateManually: boolean;
    requiresManualOverride: boolean;
    tenureDays: number;
    minTenureDays: number;
    reason?: string;
    checks: {
      statusActive: boolean;
      hasManager: boolean;
      hasKraTemplate: boolean;
      alreadyHasReview: boolean;
      periodActiveOrUpcoming: boolean;
      tenureMet: boolean;
    };
    employee: {
      id: string;
      name: string;
      employeeCode: string;
      status: string;
      joiningDate?: string;
      managerName?: string;
      departmentName?: string;
      designationName?: string;
    };
    period: {
      id: string;
      name: string;
      quarter: number;
      year: number;
      startDate: string;
      endDate: string;
      status: string;
    };
  }> {
    const res = await fetch(
      `${API_BASE}/reviews/check-eligibility?employeeId=${encodeURIComponent(employeeId)}&reviewPeriodId=${encodeURIComponent(reviewPeriodId)}`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to check eligibility' }));
      throw new Error(err.error || 'Failed to check eligibility');
    }
    return res.json();
  },

  async initiateSingleReview(data: {
    employeeId: string;
    reviewPeriodId: string;
    reason?: string;
  }): Promise<{ message: string; review: EmployeeReview }> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/reviews/initiate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to initiate review' }));
      throw new Error(err.error || 'Failed to initiate review');
    }
    return res.json();
  },

  async scoreReview(
    id: string,
    data: {
      kraSnapshot: ReviewKraSnapshot[];
      strengths?: string;
      improvements?: string;
      managerOverallComments?: string;
      returnResponses?: Record<string, { reply?: string; keepRating?: boolean; keepReason?: string }>;
      employeeComments?: string;
      hrComments?: string;
      isDraft?: boolean;
    }
  ): Promise<EmployeeReview> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/notifications');
    invalidateApiCache('/ess');
    const res = await fetch(`${API_BASE}/reviews/${id}/score`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(cleanSnapshotPayload(data)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit review scores' }));
      throw new Error(err.error || 'Failed to submit review scores');
    }
    return res.json();
  },

  async updateReviewStatus(
    id: string,
    data: {
      status: ReviewStatus;
      remarks?: string;
      /** Only meaningful when status === 'RETURNED' — who HR is returning the review to. Defaults to Manager. */
      target?: 'MANAGER' | 'HOD' | 'BOTH';
      /** Only meaningful when status === 'RETURNED' — KRAs to re-evaluate (empty = all). For 'BOTH', the Manager's. */
      kraIds?: string[];
      /** HOD's KRAs when target === 'BOTH'. */
      hodKraIds?: string[];
      kraComments?: Record<string, string>;
      reasonCodes?: string[];
    }
  ): Promise<EmployeeReview> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/notifications');
    invalidateApiCache('/ess');
    const res = await fetch(`${API_BASE}/reviews/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update review status' }));
      throw new Error(err.error || 'Failed to update review status');
    }
    return res.json();
  },

  async hodApproveReview(
    id: string,
    data?: {
      kraSnapshot?: ReviewKraSnapshot[];
      hodOverallComments?: string;
      hodComments?: string;
      isDraft?: boolean;
      returnResponses?: Record<string, { reply?: string; keepRating?: boolean; keepReason?: string }>;
    }
  ): Promise<EmployeeReview> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/reviews/${id}/hod-approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(cleanSnapshotPayload(data || {})),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to approve review' }));
      throw new Error(err.error || 'Failed to approve review');
    }
    return res.json();
  },

  async hodReturnReview(
    id: string,
    data: { reason: string; kraIds?: string[]; kraComments?: Record<string, string>; reasonCodes?: string[] }
  ): Promise<EmployeeReview> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/reviews/${id}/hod-return`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to return review' }));
      throw new Error(err.error || 'Failed to return review');
    }
    return res.json();
  },

  async getReturnPolicy(): Promise<ReturnPolicy> {
    const res = await fetch(`${API_BASE}/reviews/return-policy`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load return policy');
    return res.json();
  },

  async updateReturnPolicy(data: Partial<ReturnPolicy>): Promise<ReturnPolicy> {
    const res = await fetch(`${API_BASE}/reviews/return-policy`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update return policy' }));
      throw new Error(err.error || 'Failed to update return policy');
    }
    return res.json();
  },

  async getReturnDraft(reviewId: string): Promise<{ draft: ReviewReturnDraft | null; returnCount?: number }> {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/return-draft`, { headers: getAuthHeaders() });
    if (!res.ok) return { draft: null };
    return res.json();
  },

  async saveReturnDraft(reviewId: string, data: ReturnSelection): Promise<{ draft: ReviewReturnDraft }> {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/return-draft`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save return draft' }));
      throw new Error(err.error || 'Failed to save return draft');
    }
    return res.json();
  },

  async deleteReturnDraft(reviewId: string): Promise<void> {
    await fetch(`${API_BASE}/reviews/${reviewId}/return-draft`, { method: 'DELETE', headers: getAuthHeaders() });
  },

  async sendReviewerReminder(reviewerId: string, role: 'MANAGER' | 'HOD'): Promise<{ sentAt: string; pending: number; emailStatus: string }> {
    const res = await fetch(`${API_BASE}/dashboard/reviewer-reminder`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reviewerId, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send reminder' }));
      throw new Error(err.error || 'Failed to send reminder');
    }
    invalidateApiCache('/dashboard');
    return res.json();
  },

  async getReturnAnalyticsReport(params?: { periodId?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.periodId) q.append('periodId', params.periodId);
    const res = await fetch(`${API_BASE}/reports/return-analytics?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch return analytics report');
    return res.json();
  },

  // Annual Appraisal & Salary Increment API (Phase 5)
  async getAppraisals(params?: {
    cycleId?: string;
    year?: number;
    month?: number;
    departmentId?: string;
    status?: string;
    search?: string;
    onlyMine?: boolean;
    managerId?: string;
  }): Promise<Appraisal[]> {
    const query = new URLSearchParams();
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month.toString());
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.onlyMine) query.append('onlyMine', 'true');
    if (params?.managerId) query.append('managerId', params.managerId);

    return requestWithDedupeAndCache<Appraisal[]>(
      `${API_BASE}/appraisals?${query.toString()}`,
      { headers: getAuthHeaders() },
      0 // In-flight request deduplication
    );
  },

  async getAppraisal(id: string): Promise<Appraisal> {
    return requestWithDedupeAndCache<Appraisal>(
      `${API_BASE}/appraisals/${id}`,
      { headers: getAuthHeaders() },
      0
    );
  },

  async getAppraisalStats(params?: { cycleId?: string; year?: number; departmentId?: string }): Promise<AppraisalSummaryStats> {
    const query = new URLSearchParams();
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.year) query.append('year', params.year.toString());
    if (params?.departmentId) query.append('departmentId', params.departmentId);

    return requestWithDedupeAndCache<AppraisalSummaryStats>(
      `${API_BASE}/appraisals/stats?${query.toString()}`,
      { headers: getAuthHeaders() },
      0
    );
  },

  async initiateAppraisalCycle(data: {
    cycleId: string;
    appraisalYear?: number;
    overrideExisting?: boolean;
  }): Promise<{ message: string; cycleName: string; createdCount: number; updatedCount: number; totalEligible: number }> {
    invalidateApiCache('/appraisals');
    invalidateApiCache('/notifications');
    invalidateApiCache('/ess');
    const res = await fetch(`${API_BASE}/appraisals/initiate-cycle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to initiate appraisal cycle' }));
      throw new Error(err.error || 'Failed to initiate appraisal cycle');
    }
    return res.json();
  },

  async submitManagerRecommendation(
    id: string,
    data: {
      suggestedIncrementPercent: number;
      promotionRecommended: boolean;
      promotionDesignationId?: string;
      promotionDesignationName?: string;
      justification: string;
      strengthsSummary?: string;
    }
  ): Promise<Appraisal> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/manager-recommend`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit manager recommendation' }));
      throw new Error(err.error || 'Failed to submit manager recommendation');
    }
    return res.json();
  },

  async getAppraisalBudget(id: string): Promise<DepartmentBudgetSnapshot> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/budget`, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load department budget' }));
      throw new Error(err.error || 'Failed to load department budget');
    }
    return res.json();
  },

  async submitHodCalibration(
    id: string,
    data: {
      calibratedIncrementPercent: number;
      promotionApproved: boolean;
      calibratedRating?: string;
      notes?: string;
    }
  ): Promise<Appraisal> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/hod-calibrate`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit HOD calibration' }));
      const message =
        (Array.isArray(err.details) && err.details.length > 0)
          ? err.details.map((d: any) => d.message).join('; ')
          : (err.error || 'Failed to submit HOD calibration');
      throw new Error(message);
    }
    return res.json();
  },

  async returnAppraisalToManager(id: string, data: { reason: string }): Promise<Appraisal> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/hod-return`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to return appraisal to manager' }));
      const message =
        (Array.isArray(err.details) && err.details.length > 0)
          ? err.details.map((d: any) => d.message).join('; ')
          : (err.error || 'Failed to return appraisal to manager');
      throw new Error(message);
    }
    return res.json();
  },

  async submitHrApproval(
    id: string,
    data: {
      finalIncrementPercent: number;
      finalRating: string;
      revisedCtc?: number;
      effectiveDate: string;
      notes?: string;
    }
  ): Promise<Appraisal> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/hr-approve`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to approve appraisal' }));
      const message =
        (Array.isArray(err.details) && err.details.length > 0)
          ? err.details.map((d: any) => d.message).join('; ')
          : (err.error || 'Failed to approve appraisal');
      throw new Error(message);
    }
    return res.json();
  },

  async lockAppraisal(
    id: string,
    data?: {
      finalIncrementPercent?: number;
      finalRating?: string;
      revisedCtc?: number;
      effectiveDate?: string;
      promotionApproved?: boolean;
      promotionDesignationId?: string;
      promotionDesignationName?: string;
      notes?: string;
    }
  ): Promise<Appraisal> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/lock`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to lock appraisal' }));
      const message =
        (Array.isArray(err.details) && err.details.length > 0)
          ? err.details.map((d: any) => d.message).join('; ')
          : (err.error || 'Failed to lock appraisal');
      throw new Error(message);
    }
    return res.json();
  },

  async acknowledgeAppraisal(id: string, comments?: string): Promise<Appraisal> {
    invalidateApiCache('/appraisals');
    invalidateApiCache('/ess');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/appraisals/${id}/acknowledge`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to acknowledge appraisal' }));
      throw new Error(err.error || 'Failed to acknowledge appraisal');
    }
    return res.json();
  },

  async getAppraisalLetter(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/appraisals/${id}/letter`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to generate appraisal letter');
    return res.json();
  },

  // Employee Self-Service (ESS) & Quarterly Self-Assessment (Phase 3)
  async submitSelfAssessment(
    reviewId: string,
    data: {
      kraSnapshot: ReviewKraSnapshot[];
      selfStrengths?: string;
      selfImprovements?: string;
      selfObstacles?: string;
      isDraft?: boolean;
    }
  ): Promise<EmployeeReview> {
    invalidateApiCache('/reviews');
    invalidateApiCache('/ess');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/self-assess`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(cleanSnapshotPayload(data)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit self assessment' }));
      throw new Error(err.error || 'Failed to submit self assessment');
    }
    return res.json();
  },

  async getEssOverview(employeeId?: string): Promise<any> {
    const endpoint = employeeId ? `${API_BASE}/ess/overview/${employeeId}` : `${API_BASE}/ess/overview/me`;
    const res = await fetch(endpoint, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch ESS overview' }));
      throw new Error(err.error || 'Failed to fetch ESS overview');
    }
    return res.json();
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    return requestWithDedupeAndCache<DashboardSummary>(
      `${API_BASE}/dashboard/summary`,
      { headers: getAuthHeaders() },
      0
    );
  },

  // Executive Analytics, Bell Curve Normalization & Budget Pools (Phase 4)
  async getExecutiveAnalytics(params?: { cycleId?: string; year?: number }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.cycleId) query.append('cycleId', params.cycleId);
    if (params?.year) query.append('year', String(params.year));

    const res = await fetch(`${API_BASE}/appraisals/analytics/executive?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch executive analytics' }));
      throw new Error(err.error || 'Failed to fetch executive analytics');
    }
    return res.json();
  },

  // Automated Notifications & Workflow Hub (Phase 5)
  async getNotifications(): Promise<any[]> {
    // Fetches the full (up to 100-item) notification list — only the Notifications Center
    // page needs this; everywhere else that just needs a badge number should use
    // getUnreadNotificationCount() instead, which is far cheaper to poll.
    return requestWithDedupeAndCache<any[]>(
      `${API_BASE}/notifications`,
      { headers: getAuthHeaders() },
      5000 // 5s cache
    );
  },

  async getUnreadNotificationCount(): Promise<number> {
    // Lightweight badge-count endpoint, safe to poll frequently (e.g. the header bell) —
    // returns just a number instead of the full notification payload.
    const { unreadCount } = await requestWithDedupeAndCache<{ unreadCount: number }>(
      `${API_BASE}/notifications/unread-count`,
      { headers: getAuthHeaders() },
      5000 // 5s cache
    );
    return unreadCount;
  },

  async markNotificationRead(id: string): Promise<any> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
    const data = await res.json();
    invalidateApiCache('/notifications');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    return data;
  },

  async markAllNotificationsRead(): Promise<any> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all notifications as read');
    const data = await res.json();
    invalidateApiCache('/notifications');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    return data;
  },

  async deleteNotification(id: string): Promise<any> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete notification');
    const data = await res.json();
    invalidateApiCache('/notifications');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    return data;
  },

  async completeNotification(id: string): Promise<any> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/notifications/${id}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to complete notification');
    const data = await res.json();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    return data;
  },

  // Email Notification & Delivery Logs
  async getEmailLogs(limit: number = 50): Promise<{ logs: any[] }> {
    return requestWithDedupeAndCache<{ logs: any[] }>(
      `${API_BASE}/emails/logs?limit=${limit}`,
      { headers: getAuthHeaders() },
      5000 // 5s cache
    );
  },

  async sendTestEmail(email?: string, name?: string): Promise<any> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/emails/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) throw new Error('Failed to dispatch test email');
    return res.json();
  },

  // Dedicated Reports Center (Section 16 Specification)
  async getQuarterlyStatusReport(params?: { periodId?: string; departmentId?: string; cycleId?: string; status?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.periodId) q.append('periodId', params.periodId);
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    if (params?.cycleId) q.append('cycleId', params.cycleId);
    if (params?.status) q.append('status', params.status);
    const res = await fetch(`${API_BASE}/reports/quarterly-status?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch quarterly status report');
    return res.json();
  },

  async getPendingOverdueReport(params?: { departmentId?: string; cycleId?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    if (params?.cycleId) q.append('cycleId', params.cycleId);
    const res = await fetch(`${API_BASE}/reports/pending-overdue?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch pending/overdue report');
    return res.json();
  },

  async getEmployeeHistoryReport(params?: { departmentId?: string; cycleId?: string; search?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    if (params?.cycleId) q.append('cycleId', params.cycleId);
    if (params?.search) q.append('search', params.search);
    const res = await fetch(`${API_BASE}/reports/employee-history?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch employee history report');
    return res.json();
  },

  async getDepartmentPerformanceReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/department-performance`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch department performance report');
    return res.json();
  },

  async getManagerCompletionReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/manager-completion`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch manager completion report');
    return res.json();
  },

  async getAppraisalDueReport(params?: { cycleId?: string; year?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.cycleId) q.append('cycleId', params.cycleId);
    if (params?.year) q.append('year', String(params.year));
    const res = await fetch(`${API_BASE}/reports/appraisal-due?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch appraisal due report');
    return res.json();
  },

  async getRatingTrendReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/rating-trend`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch rating trend report');
    return res.json();
  },

  async getKraPerformanceReport(): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/kra-performance`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch KRA performance report');
    return res.json();
  },

  async getAuditTrailReport(params?: { module?: string; limit?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.module) q.append('module', params.module);
    if (params?.limit) q.append('limit', String(params.limit));
    const res = await fetch(`${API_BASE}/reports/audit-trail?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch audit trail report');
    return res.json();
  },

  // ==========================================
  // Bulk Excel/CSV Import & Export Engine (Phase 7)
  // ==========================================
  async getBulkTemplate(datasetType: string): Promise<{ datasetType: string; columns: any[]; sampleData: any[] }> {
    const res = await fetch(`${API_BASE}/bulk/templates/${datasetType}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bulk template schema');
    return res.json();
  },

  async validateBulkRows(datasetType: string, rows: any[], allowUpdateExisting = true): Promise<any> {
    const res = await fetch(`${API_BASE}/bulk/validate/${datasetType}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rows, allowUpdateExisting }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Validation failed' }));
      throw new Error(err.error || 'Failed to validate uploaded file data');
    }
    return res.json();
  },

  async executeBulkImport(
    datasetType: string,
    rows: any[],
    options?: { skipInvalid?: boolean; allowUpdateExisting?: boolean; fileName?: string }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/bulk/import/${datasetType}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        rows,
        skipInvalid: options?.skipInvalid ?? true,
        allowUpdateExisting: options?.allowUpdateExisting ?? true,
        fileName: options?.fileName || 'upload.xlsx',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(err.error || 'Failed to execute bulk import');
    }
    // A bulk import can touch employees, their KRA assignments, and the reviews that get
    // auto-generated once a KRA lands — invalidate every cache a subsequent fetch might read
    // stale data from, regardless of which dataset type was imported.
    invalidateApiCache('/employees');
    invalidateApiCache('/kra-templates');
    invalidateApiCache('/kras');
    invalidateApiCache('/departments');
    invalidateApiCache('/designations');
    invalidateApiCache('/reviews');
    invalidateApiCache('/appraisals');
    return res.json();
  },

  async getBulkExportData(datasetType: string, filters?: { cycleId?: string; departmentId?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (filters?.cycleId) q.append('cycleId', filters.cycleId);
    if (filters?.departmentId) q.append('departmentId', filters.departmentId);
    const res = await fetch(`${API_BASE}/bulk/export/${datasetType}?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to generate export dataset');
    return res.json();
  },

  async getBulkImportHistory(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bulk/history`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bulk import audit history');
    return res.json();
  },

  // ==========================================
  // PHASE 8: AUDIT TRAIL & COMPLIANCE TIMELINE API
  // ==========================================
  async getAuditLogs(params?: {
    searchTerm?: string;
    module?: string;
    actionType?: string;
    severity?: string;
    employeeId?: string;
    actorId?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    isFlaggedOnly?: boolean;
  }): Promise<{ success: boolean; totalCount: number; logs: any[] }> {
    const q = new URLSearchParams();
    if (params?.searchTerm) q.append('searchTerm', params.searchTerm);
    if (params?.module && params.module !== 'ALL') q.append('module', params.module);
    if (params?.actionType && params.actionType !== 'ALL') q.append('actionType', params.actionType);
    if (params?.severity && params.severity !== 'ALL') q.append('severity', params.severity);
    if (params?.employeeId) q.append('employeeId', params.employeeId);
    if (params?.actorId) q.append('actorId', params.actorId);
    if (params?.department && params.department !== 'ALL') q.append('department', params.department);
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    if (params?.isFlaggedOnly) q.append('isFlaggedOnly', 'true');

    const res = await fetch(`${API_BASE}/audit/logs?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  async getAuditSummary(): Promise<{ success: boolean; metrics: any }> {
    const res = await fetch(`${API_BASE}/audit/summary`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch audit summary metrics');
    return res.json();
  },

  async getEmployeeAuditTimeline(employeeId: string): Promise<{ success: boolean; employee: any; timeline: any[] }> {
    const res = await fetch(`${API_BASE}/audit/timeline/${employeeId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch employee audit timeline');
    return res.json();
  },

  async getComplianceHealthReport(): Promise<{ success: boolean; report: any }> {
    const res = await fetch(`${API_BASE}/audit/compliance-health`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch compliance health report');
    return res.json();
  },

  async resolveComplianceFlag(flagId: string, resolutionNote: string): Promise<{ success: boolean; flag: any }> {
    const res = await fetch(`${API_BASE}/audit/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resolutionNote }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to resolve flag' }));
      throw new Error(err.error || 'Failed to resolve compliance flag');
    }
    return res.json();
  },

  async recordAuditEvent(data: Record<string, any>): Promise<any> {
    const res = await fetch(`${API_BASE}/audit/log`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record audit event');
    return res.json();
  },

  async exportAuditReport(params?: { module?: string; format?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.module) q.append('module', params.module);
    if (params?.format) q.append('format', params.format);
    const res = await fetch(`${API_BASE}/audit/export?${q.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to export audit report');
    return res.json();
  },

  // ==========================================
  // PHASE 9: AI & CONTINUOUS 360 FEEDBACK API
  // ==========================================

  // 9-Box Talent Matrix
  async getTalentRecords(): Promise<TalentRecord[]> {
    const res = await fetch(`${API_BASE}/talent-records`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch 9-box talent records');
    return res.json();
  },

  async updateTalentRecord(id: string, data: Partial<TalentRecord>): Promise<TalentRecord> {
    const res = await fetch(`${API_BASE}/talent-records/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update talent record' }));
      throw new Error(err.error || 'Failed to update talent record');
    }
    return res.json();
  },

  // Gemini AI Operations
  async generateAiReviewSynthesis(payload: AiReviewSynthesisRequest): Promise<{ success: boolean; data: AiReviewSynthesisResult; engine: string }> {
    const res = await fetch(`${API_BASE}/gemini/generate-review-narrative`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      let errMessage = 'Failed to synthesize review';
      try {
        const errJson = JSON.parse(text);
        if (errJson.error) errMessage = errJson.error;
      } catch {
        if (text.includes('<!doctype') || text.includes('<html')) {
          errMessage = 'Server error or gateway timeout. Please check backend status.';
        } else if (text) {
          errMessage = text;
        }
      }
      throw new Error(errMessage);
    }
    try {
      if (text.trim().startsWith('<')) {
        throw new Error('Server returned HTML instead of JSON');
      }
      return JSON.parse(text);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to synthesize review', { cause: err });
    }
  },


  async generateAiTalentInsights(payload: AiTalentInsightsRequest): Promise<{ success: boolean; data: AiTalentInsightsResult; engine: string }> {
    const res = await fetch(`${API_BASE}/gemini/talent-insights-summary`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      let errMessage = 'Failed to generate talent insights';
      try {
        const errJson = JSON.parse(text);
        if (errJson.error) errMessage = errJson.error;
      } catch {
        if (text.includes('<!doctype') || text.includes('<html')) {
          errMessage = 'Server error or gateway timeout. Please check backend status.';
        } else if (text) {
          errMessage = text;
        }
      }
      throw new Error(errMessage);
    }
    try {
      if (text.trim().startsWith('<')) {
        throw new Error('Server returned HTML instead of JSON');
      }
      return JSON.parse(text);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to generate talent insights', { cause: err });
    }
  },

  // ==========================================
  // Management Role Endpoints
  // ==========================================

  async getManagementDashboard(params?: { periodId?: string; year?: number; quarter?: number }): Promise<ManagementDashboardData> {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.year) query.set('year', String(params.year));
    if (params?.quarter) query.set('quarter', String(params.quarter));
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/dashboard/management${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch management dashboard'));
    return res.json();
  },

  async getManagementDepartmentPerformance(params?: {
    periodId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ period: ReviewPeriod | null; departments: ManagementDepartmentPerformanceItem[] }> {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/departments/performance${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch department performance'));
    return res.json();
  },

  async getManagementPerformanceTrends(params?: { year?: number }): Promise<ManagementPerformanceTrendsData> {
    const query = new URLSearchParams();
    if (params?.year) query.set('year', String(params.year));
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/performance/trends${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch performance trends'));
    return res.json();
  },

  async getManagementHighPerformers(params?: {
    periodId?: string;
    threshold?: number;
    limit?: number;
  }): Promise<{ period: ReviewPeriod | null; threshold: number; count: number; performers: ManagementPerformerItem[] }> {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.threshold) query.set('threshold', String(params.threshold));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/high-performers${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch high performers'));
    return res.json();
  },

  async getManagementAttentionRequired(params?: {
    periodId?: string;
    threshold?: number;
    limit?: number;
  }): Promise<{ period: ReviewPeriod | null; threshold: number; count: number; attentionItems: ManagementAttentionItem[] }> {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.threshold) query.set('threshold', String(params.threshold));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/attention-required${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch attention required list'));
    return res.json();
  },

  async getManagementAppraisalsSummary(params?: {
    year?: number;
    cycleId?: string;
    departmentId?: string;
  }): Promise<ManagementAppraisalSummaryData> {
    const query = new URLSearchParams();
    if (params?.year) query.set('year', String(params.year));
    if (params?.cycleId) query.set('cycleId', params.cycleId);
    if (params?.departmentId) query.set('departmentId', params.departmentId);
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/appraisals/summary${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch appraisals summary'));
    return res.json();
  },

  async getManagementEmployeePerformance(employeeId: string): Promise<ManagementEmployeeDossier> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/employee/${employeeId}/performance`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch employee performance dossier'));
    return res.json();
  },

  async getManagementWorkforceRisk(params?: { year?: number }): Promise<ManagementWorkforceRiskData> {
    const query = new URLSearchParams();
    if (params?.year) query.set('year', String(params.year));
    const qs = query.toString();
    const res = await fetchWithAutoRefresh(`${API_BASE}/management/workforce-risk${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch workforce risk snapshot'));
    return res.json();
  },

  // ==========================================
  // Performance Improvement Plans (PIPs)
  // ==========================================

  async getPips(status?: string): Promise<PerformanceImprovementPlan[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetchWithAutoRefresh(`${API_BASE}/pips${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch performance improvement plans'));
    return res.json();
  },

  async getPip(id: string): Promise<PerformanceImprovementPlan> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/pips/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch performance improvement plan'));
    return res.json();
  },

  async getPipAnalytics(): Promise<{
    total: number;
    activeCount: number;
    byStatus: Record<string, number>;
    successRate: number | null;
    avgDurationDays: number | null;
    byDepartment: Record<string, number>;
  }> {
    const res = await fetchWithAutoRefresh(`${API_BASE}/pips/analytics`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to fetch performance improvement plan analytics'));
    return res.json();
  },

  async createPip(data: {
    employeeId: string;
    reason: string;
    category?: string;
    triggeredByReviewId?: string;
    startDate: string;
    durationDays: number;
    goals: Array<{ description: string; targetMetric?: string; dueDate?: string }>;
    publish?: boolean;
  }): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    const res = await fetch(`${API_BASE}/pips`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create performance improvement plan' }));
      throw new Error(err.error || 'Failed to create performance improvement plan');
    }
    return res.json();
  },

  async updatePip(id: string, data: Partial<{
    reason: string;
    category: string;
    startDate: string;
    durationDays: number;
    goals: Array<{ id?: string; description: string; targetMetric?: string; dueDate?: string; status?: string }>;
  }>): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    const res = await fetch(`${API_BASE}/pips/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update performance improvement plan' }));
      throw new Error(err.error || 'Failed to update performance improvement plan');
    }
    return res.json();
  },

  async publishPip(id: string): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/pips/${id}/publish`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to publish performance improvement plan' }));
      throw new Error(err.error || 'Failed to publish performance improvement plan');
    }
    return res.json();
  },

  async addPipCheckIn(
    id: string,
    notes: string,
    goalRatings?: Array<{ goalId: string; rating: number }>
  ): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/pips/${id}/checkins`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes, goalRatings }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add check-in' }));
      throw new Error(err.error || 'Failed to add check-in');
    }
    return res.json();
  },

  async acknowledgePip(id: string, comments?: string): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    invalidateApiCache('/notifications');
    const res = await fetch(`${API_BASE}/pips/${id}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to acknowledge performance improvement plan' }));
      throw new Error(err.error || 'Failed to acknowledge performance improvement plan');
    }
    return res.json();
  },

  async recordPipOutcome(id: string, data: { decision: 'SUCCEEDED' | 'FAILED' | 'EXTENDED'; notes?: string; additionalDays?: number }): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    invalidateApiCache('/notifications');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/pips/${id}/outcome`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to record outcome' }));
      throw new Error(err.error || 'Failed to record outcome');
    }
    return res.json();
  },

  async cancelPip(id: string, reason: string): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    invalidateApiCache('/appraisals');
    const res = await fetch(`${API_BASE}/pips/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel performance improvement plan' }));
      throw new Error(err.error || 'Failed to cancel performance improvement plan');
    }
    return res.json();
  },

  async resolvePipFailure(
    id: string,
    data: { action: string; notes?: string }
  ): Promise<PerformanceImprovementPlan> {
    invalidateApiCache('/pips');
    const res = await fetch(`${API_BASE}/pips/${id}/resolve-failure`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to record failure resolution' }));
      throw new Error(err.error || 'Failed to record failure resolution');
    }
    return res.json();
  },

  clearCache: invalidateApiCache,
};
