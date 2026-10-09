import { Employee } from './organization';
import { ReviewPeriod } from './review';

export interface DepartmentBellCurveBucket {
  ratingBand: string;
  label: string;
  minScore: number;
  maxScore: number;
  targetPercent: number;
  actualPercent: number;
  actualCount: number;
  color: string;
  variance?: number;
  [key: string]: any;
}

export interface DepartmentBellCurve {
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  totalEmployees: number;
  /** Appraisals with a rating band — the distribution percentages are out of this. */
  ratedEmployees?: number;
  /** Appraisals with no evaluated quarters yet, excluded from the distribution. */
  unratedEmployees?: number;
  skewAlert?: string;
  skewSeverity?: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  averageScore?: number;
  buckets: DepartmentBellCurveBucket[];
  [key: string]: any;
}

export interface DepartmentBudgetPool {
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  allocatedBudgetAmount: number;
  actualSpentAmount: number;
  totalCurrentCtc?: number;
  totalRevisedCtc?: number;
  budgetCapPercent?: number;
  averageIncrementPercent?: number;
  employeeCount?: number;
  isOverBudget?: boolean;
  variance?: number;
  [key: string]: any;
}

/** Department increment budget pool as seen from one appraisal (GET /appraisals/:id/budget). */
export interface DepartmentBudgetSnapshot {
  departmentId?: string;
  departmentName: string;
  appraisalYear: number;
  budgetCapPercent: number;
  poolCtc: number;
  allocatedAmount: number;
  spentByOthers: number;
  currentIncrementAmount: number;
  maxAllowedIncrementPercent: number;
}

export interface ExecutiveAnalyticsData {
  bellCurveDistribution: {
    target: {
      outstanding: number;
      exceeds: number;
      meets: number;
      needsImprovement: number;
    };
    actual: {
      outstanding: number;
      exceeds: number;
      meets: number;
      needsImprovement: number;
    };
    actualCount: {
      outstanding: number;
      exceeds: number;
      meets: number;
      needsImprovement: number;
      unrated?: number;
    };
  };
  cohortSummary: {
    ratedAppraisals?: number;
    unratedAppraisals?: number;
    totalBudgetCap: number;
    totalBudgetSpent: number;
    averageIncrementPercent: number;
    totalEmployees?: number;
    [key: string]: any;
  };
  departmentBellCurves: DepartmentBellCurve[];
  departmentBudgets: DepartmentBudgetPool[];
  retentionRisks?: any[];
  cycleBreakdowns?: any[];
  [key: string]: any;
}

export interface ManagementOrganizationSummary {
  totalActiveEmployees: number;
  totalDepartments: number;
  currentQuarter: string;
  totalQuarterlyReviews: number;
  completedReviews: number;
  pendingManagerReviews: number;
  pendingHodReviews: number;
  pendingHrReviews: number;
  returnedReviews: number;
  overdueReviews: number;
  reviewCompletionRate: number;
  employeesDueForAppraisal: number;
}

export interface ManagementDepartmentBrief {
  id: string;
  name: string;
  averageScore: number;
  completionRate: number;
  totalReviews: number;
  pendingCount: number;
}

export interface ManagementOrganizationPerformance {
  overallAverageScore: number;
  currentQuarterAverageScore: number;
  previousQuarterAverageScore: number;
  scoreDelta: number;
  trendDirection: 'UP' | 'DOWN' | 'FLAT';
  highestPerformingDepartments: ManagementDepartmentBrief[];
  departmentsRequiringAttention: ManagementDepartmentBrief[];
  ratingDistribution?: {
    exceptional: number;
    proficient: number;
    needsFocus: number;
    inEvaluation: number;
  };
}

export interface ManagementDashboardData {
  period: ReviewPeriod | null;
  organizationSummary: ManagementOrganizationSummary;
  organizationPerformance: ManagementOrganizationPerformance;
  appraisalSummary: {
    currentYear: number;
    currentMonth: number;
    totalDue: number;
    totalInitiated: number;
    totalLocked: number;
    averageIncrementPercent: number;
  };
}

export interface ManagementDepartmentPerformanceItem {
  departmentId: string;
  departmentName: string;
  headcount: number;
  totalReviews: number;
  completedReviews: number;
  completionRate: number;
  managerPending: number;
  hodPending: number;
  hrPending: number;
  returnedCount: number;
  overdueCount: number;
  averageScore: number;
  previousQuarterScore: number;
  scoreDelta: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  appraisalDueCount: number;
}

export interface ManagementPerformanceTrendsData {
  year: number;
  quarters: Array<{
    quarter: number;
    label: string;
    periodId: string | null;
    periodStatus: string | null;
    averageScore: number;
    completedReviewsCount: number;
    totalReviewsCount: number;
    completionRate: number;
  }>;
  departmentAverages: Array<{
    departmentId: string;
    departmentName: string;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    overallAvg: number;
  }>;
}

export interface ManagementPerformerItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  managerName: string;
  finalScore: number;
  ratingLabel?: string;
  reviewStatus: string;
  reviewPeriodName: string;
}

export interface ManagementAttentionItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  managerName: string;
  score: number;
  status: string;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM';
  dueDate?: string;
  reviewPeriodName: string;
}

export interface ManagementAppraisalSummaryData {
  year: number;
  summary: {
    totalEligible: number;
    totalInitiated: number;
    totalLocked: number;
    pendingManager: number;
    pendingHod: number;
    pendingHr: number;
    averageIncrementPercent: number;
    totalPayrollImpact: number;
    completionRate: number;
  };
  cycleBreakdowns: Array<{
    cycleId: string;
    cycleName: string;
    appraisalMonth: number;
    eligibleCount: number;
    initiatedCount: number;
    lockedCount: number;
    averageIncrementPercent: number;
  }>;
  departmentBreakdowns: Array<{
    departmentId: string;
    departmentName: string;
    headcount: number;
    appraisalCount: number;
    lockedCount: number;
    averageIncrementPercent: number;
    payrollImpact: number;
  }>;
}

export interface ManagementEmployeeDossier {
  employee: Employee;
  historicalReviews: Array<{
    id: string;
    reviewPeriodId: string;
    periodName: string;
    quarter: number;
    year: number;
    finalScore: number;
    status: string;
    isClosed: boolean;
    submittedAt?: string;
    closedAt?: string;
    managerFeedback?: string;
    hrFeedback?: string;
    selfComments?: string;
    kras: any[];
  }>;
  scoreTrends: Array<{
    periodName: string;
    year: number;
    quarter: number;
    score: number;
  }>;
  appraisalHistory: Array<{
    id: string;
    cycleName?: string;
    appraisalYear: number;
    proposedIncrementPercentage?: number;
    approvedIncrementPercentage?: number;
    finalRating?: number;
    status: string;
    isLocked: boolean;
    effectiveDate?: string;
  }>;
}

export interface ManagementAtRiskEmployee {
  pipId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  designationName?: string;
  managerName?: string;
  hodName?: string;
  status: 'ACTIVE' | 'EXTENDED';
  startDate: string;
  endDate: string;
  daysSinceLastCheckIn: number;
  isOverdueCheckIn: boolean;
  isPastEndDate: boolean;
}

export interface ManagementPipOutcome {
  pipId: string;
  employeeName: string;
  departmentName?: string;
  decision: 'SUCCEEDED' | 'FAILED' | 'EXTENDED';
  decidedAt: string;
  decidedByName: string;
}

export interface ManagementWorkforceRiskData {
  year: number;
  summary: {
    activePipCount: number;
    extendedPipCount: number;
    overdueCheckInCount: number;
    pastEndDateNoOutcomeCount: number;
    succeeded: number;
    failed: number;
    extended: number;
  };
  atRiskEmployees: ManagementAtRiskEmployee[];
  recentOutcomes: ManagementPipOutcome[];
  alerts: {
    overdueReviewsCount: number;
    reviewDeadlinePassed: boolean;
    activePeriodName: string | null;
    activePeriodDueDate: string | null;
  };
}
