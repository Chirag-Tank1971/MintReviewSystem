import { UserRole } from './auth';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'NOTICE';

export interface Department {
  id: string;
  name: string;
  code: string;
  hodId?: string;
  hodName?: string;
  budgetCapPercent?: number;
  active: boolean;
  createdAt: string;
}

export interface Designation {
  id: string;
  name: string;
  departmentId: string;
  departmentName?: string;
  level: number;
  active: boolean;
}

export interface Cycle {
  id: string;
  code: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  name: string;
  appraisalMonth: number; // 1 - 12 (Jan - Dec)
  colorHex: string;
  description?: string;
  active: boolean;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  departmentId: string;
  departmentName?: string;
  designationId: string;
  designationName?: string;
  joiningDate: string;
  managerId?: string;
  managerName?: string;
  hodId?: string;
  hodName?: string;
  cycleId: string;
  cycleCode: string;
  cycleName?: string;
  cycleColor?: string;
  startingReviewPeriodId: string;
  startingReviewPeriodName?: string;
  currentKraTemplateId?: string;
  currentKraTemplateName?: string;
  status: EmployeeStatus;
  isPastEmployee?: boolean;
  pastEmployeeDate?: string;
  relievingDate?: string;
  currentCtc?: number;
  currency?: string;
  hasLoginAccount?: boolean;
  userActive?: boolean;
  systemRole?: UserRole;
  userId?: string;
  lastAppraisalDate?: string;
  confirmationDate?: string;
  gender?: 'Male' | 'Female' | 'Other' | string;
  employmentType?: 'Permanent' | 'Contract' | 'Intern' | string;
  probationPeriodDays?: number;
  companyName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEmployeePayload {
  employeeCode: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  departmentId: string;
  designationId: string;
  joiningDate: string;
  status: EmployeeStatus;
  cycleId: string;
  startingReviewPeriodId: string;
  managerId?: string;
  hodId?: string;
  currentKraTemplateId?: string;
  currentCtc?: number;
  relievingDate?: string;
  customKras?: Array<{
    title: string;
    weight: number | string;
    target?: string;
    description?: string;
    measurementCriteria?: string;
  }>;
  [key: string]: any;
}

export interface CreateEmployeeResponse {
  success: boolean;
  message?: string;
  data?: Employee;
  credentials?: {
    email: string;
    temporaryPassword?: string;
    generatedPassword?: string;
  };
  [key: string]: any;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;
