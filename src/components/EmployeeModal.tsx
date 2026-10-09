import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Employee, Department, Designation, Cycle, KraTemplate, ReviewPeriod, UserRole, CreateEmployeeResponse } from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CustomKraScorecardModal, CustomKraRow } from './CustomKraScorecardModal';
import { MasterDeleteModal, MasterDeleteTarget } from './MasterDeleteModal';
import { useModalAnimation } from '../hooks/useModalAnimation';

function defaultCustomKraRows(): CustomKraRow[] {
  return [
    { id: 'kra_1', title: '', weight: 25, target: '100% Target SLA', measurementCriteria: '' },
    { id: 'kra_2', title: '', weight: 25, target: '100% Target SLA', measurementCriteria: '' },
    { id: 'kra_3', title: '', weight: 25, target: '100% Target SLA', measurementCriteria: '' },
    { id: 'kra_4', title: '', weight: 25, target: '100% Target SLA', measurementCriteria: '' },
  ];
}
import {
  X,
  Building2,
  Briefcase,
  Calendar,
  Shield,
  Mail,
  Hash,
  AlertCircle,
  Phone,
  MapPin,
  DollarSign,
  Key,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Lock,
  User,
  Target,
  UserMinus,
  Clock,
  Edit2,
  UserCheck,
  RotateCcw,
  Layers,
  Loader2,
  Trash2,
  Search,
  ChevronDown,
  Plus,
} from 'lucide-react';

/**
 * Random, human-typable temporary password (12 chars, mixed case + digits) used to
 * pre-fill the initial-password field so it's never the same predictable default twice.
 * HR can still see it and freely edit it before saving.
 */
function generateDefaultTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (charset: string) => charset[Math.floor(Math.random() * charset.length)];

  const chars = [pick(upper), pick(lower), pick(digits), ...Array.from({ length: 9 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeToEdit?: Employee | null;
  initialRehire?: boolean;
  departments: Department[];
  designations: Designation[];
  cycles: Cycle[];
  reviewPeriods?: ReviewPeriod[];
  allEmployees: Employee[];
  kraTemplates?: KraTemplate[];
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  employeeToEdit,
  initialRehire = false,
  departments,
  designations,
  cycles,
  reviewPeriods = [],
  allEmployees,
  kraTemplates = [],
}) => {
  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen,
    onClose,
  });

  const [rehireTarget, setRehireTarget] = useState<Employee | null>(null);
  const isEditing = Boolean(employeeToEdit) || Boolean(rehireTarget);

  // Form Fields: Profile & Organization
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Delhi');
  const [locationOther, setLocationOther] = useState('');

  const { user } = useAuth();
  const isHRorAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  // Dynamic Location Picker State
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [dbLocations, setDbLocations] = useState<string[]>([]);
  const locationPickerRef = useRef<HTMLDivElement>(null);

  const loadAvailableLocations = useCallback(async () => {
    try {
      const list = await api.getLocations();
      if (list && list.length > 0) {
        setDbLocations(list.map((l) => l.name));
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAvailableLocations();
    }
  }, [isOpen, loadAvailableLocations]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationPickerRef.current && !locationPickerRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false);
      }
    };
    if (locationDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [locationDropdownOpen]);

  const getEmployeeCountForLocation = (locName: string) => {
    const assigned = (allEmployees || []).filter(
      (e) => (e.location || '').trim().toLowerCase() === locName.trim().toLowerCase() && e.status !== 'INACTIVE' && !e.isPastEmployee
    );
    return {
      count: assigned.length,
      names: assigned.map((e) => e.name || e.employeeCode),
    };
  };

  const [deletedLocationSet, setDeletedLocationSet] = useState<Set<string>>(new Set());

  const PRESET_DEFAULT_LOCATIONS = [
    'Corporate Office', 'Head Office', 'Mumbai Branch',
    'Delhi NCR Hub', 'Hyderabad Tech Center', 'Jaipur Office',
    'Delhi', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'West Bengal',
    'Patna', 'Jodhpur', 'Jaipur', 'Chennai', 'HYDERABAD', 'LUCKNOW',
    'Remote - India', 'Global Remote',
  ];

  // Primary source of truth is dbLocations from MongoDB; fallback to PRESET_DEFAULT_LOCATIONS only before DB finishes loading
  const baseLocations = dbLocations.length > 0 ? dbLocations : PRESET_DEFAULT_LOCATIONS;

  const allAvailableLocations = Array.from(
    new Set(baseLocations)
  ).filter((loc) => Boolean(loc) && !deletedLocationSet.has(loc.trim().toLowerCase()));

  const filteredLocations = allAvailableLocations
    .filter((l) => !locationSearch || l.toLowerCase().includes(locationSearch.toLowerCase()))
    .sort((a, b) => {
      const countA = getEmployeeCountForLocation(a).count;
      const countB = getEmployeeCountForLocation(b).count;
      return countB - countA || a.localeCompare(b);
    });

  // Location Custom Delete Modal State
  const [locationDeleteTarget, setLocationDeleteTarget] = useState<MasterDeleteTarget | null>(null);
  const [locationDeleteLoading, setLocationDeleteLoading] = useState(false);

  const handleDeleteLocationClick = (locName: string) => {
    const assigned = (allEmployees || []).filter(
      (e) => (e.location || '').trim().toLowerCase() === locName.trim().toLowerCase() && e.status !== 'INACTIVE' && !e.isPastEmployee
    );
    setLocationDeleteTarget({
      type: 'location',
      id: locName,
      name: locName,
      assignedEmployees: assigned,
    });
  };

  const handleConfirmDeleteLocation = async () => {
    if (!locationDeleteTarget) return;
    const locName = locationDeleteTarget.name;
    setLocationDeleteLoading(true);
    try {
      const res = await api.deleteLocation(locName);
      toast.success(res.message || `Location "${locName}" deleted successfully.`, 'Location Deleted');

      const lower = locName.trim().toLowerCase();
      // Instantly track in deletedLocationSet so it disappears immediately from dropdown
      setDeletedLocationSet((prev) => new Set([...prev, lower]));
      setDbLocations((prev) => prev.filter((l) => l.trim().toLowerCase() !== lower));

      // If the currently selected location was the one deleted, switch to the next available location
      if (location.trim().toLowerCase() === lower) {
        const remaining = allAvailableLocations.filter((l) => l.trim().toLowerCase() !== lower);
        const fallback = remaining[0] || 'Other';
        setLocation(fallback);
        if (fallback === 'Other') {
          setLocationOther('');
        }
      }

      setLocationDeleteTarget(null);
      // Re-fetch fresh data from server
      loadAvailableLocations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete location', 'Deletion Blocked');
    } finally {
      setLocationDeleteLoading(false);
    }
  };
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'NOTICE'>('ACTIVE');
  const [relievingDate, setRelievingDate] = useState('');

  // Additional Organization & Employment Details
  const [confirmationDate, setConfirmationDate] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | string>('Male');
  const [employmentType, setEmploymentType] = useState('Permanent');
  const [probationPeriodDays, setProbationPeriodDays] = useState<number | string>(90);
  const [companyName, setCompanyName] = useState('M INTERGRAPH SYSTEMS PRIVATE LIMITED');

  // Past / Inactive state helpers
  const wasPastEmployee = Boolean(employeeToEdit?.status === 'INACTIVE') || Boolean(employeeToEdit?.isPastEmployee) || Boolean(rehireTarget);
  const isInactive = status === 'INACTIVE';
  const isRehiring = wasPastEmployee && status !== 'INACTIVE';

  // Form Fields: Hierarchy & Performance
  const [cycleId, setCycleId] = useState('');
  const [hasUserManuallyChangedCycle, setHasUserManuallyChangedCycle] = useState(false);
  const [startingReviewPeriodId, setStartingReviewPeriodId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [hodId, setHodId] = useState('');
  const [currentKraTemplateId, setCurrentKraTemplateId] = useState('');
  const [availableTemplates, setAvailableTemplates] = useState<KraTemplate[]>(kraTemplates);
  const [kraAssignmentMode, setKraAssignmentMode] = useState<'TEMPLATE' | 'CUSTOM'>('CUSTOM');
  const [customKras, setCustomKras] = useState<CustomKraRow[]>(defaultCustomKraRows());
  const kraHydratedForRef = useRef<string | null>(null);

  const totalCustomWeight = customKras.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const [showCustomKraModal, setShowCustomKraModal] = useState(false);

  // Form Fields: Compensation
  const [currentCtc, setCurrentCtc] = useState<number | string>(1800000);
  const [currency, setCurrency] = useState('₹');

  // Form Fields: System Access & Login
  const [provisionLogin, setProvisionLogin] = useState(true);
  const [systemRole, setSystemRole] = useState<UserRole>('EMPLOYEE');
  const [hasUserManuallyChangedRole, setHasUserManuallyChangedRole] = useState(false);
  const [initialPassword, setInitialPassword] = useState(generateDefaultTempPassword);
  const [showPassword, setShowPassword] = useState(false);

  // UI States
  const [filteredDesignations, setFilteredDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success Onboarding Card State
  const [createdResponse, setCreatedResponse] = useState<CreateEmployeeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Load KRA templates if not provided via props
  useEffect(() => {
    if (kraTemplates && kraTemplates.length > 0) {
      setAvailableTemplates(kraTemplates);
    } else if (isOpen) {
      api
        .getKraTemplates()
        .then((res) => {
          if (res && res.length > 0) setAvailableTemplates(res);
        })
        .catch(() => {});
    }
  }, [isOpen, kraTemplates]);

  // Hydrate the KRA editor from the employee's actual assigned scorecard once per
  // modal-open session. Runs once availableTemplates has loaded; deliberately does
  // NOT re-run on every subsequent availableTemplates change, so it never clobbers
  // KRA rows HR is actively editing in the scorecard modal.
  useEffect(() => {
    if (!isOpen) {
      kraHydratedForRef.current = null;
      return;
    }

    const targetEmp = employeeToEdit || rehireTarget;
    const sessionKey = targetEmp?.id || 'NEW';
    if (kraHydratedForRef.current === sessionKey) return;

    if (!targetEmp) {
      setKraAssignmentMode('CUSTOM');
      setCustomKras(defaultCustomKraRows());
      kraHydratedForRef.current = sessionKey;
      return;
    }

    const tplId = targetEmp.currentKraTemplateId;
    if (!tplId) {
      setKraAssignmentMode('CUSTOM');
      setCustomKras(defaultCustomKraRows());
      kraHydratedForRef.current = sessionKey;
      return;
    }

    const tpl = availableTemplates.find((t) => t.id === tplId);
    if (!tpl) {
      // Templates haven't finished loading yet — try again next render.
      return;
    }

    const isOwnedByEmployee = tpl.employeeId === targetEmp.id || (Boolean(tpl.employeeCode) && tpl.employeeCode === targetEmp.employeeCode);
    if (isOwnedByEmployee) {
      setKraAssignmentMode('CUSTOM');
      setCustomKras(
        tpl.items && tpl.items.length > 0
          ? tpl.items.map((it, idx) => ({
              id: it.id || `kra_existing_${idx}`,
              title: it.title || '',
              weight: it.weight ?? 0,
              target: it.target || '100% Target SLA',
              description: it.description,
              measurementCriteria: it.measurementCriteria,
            }))
          : defaultCustomKraRows()
      );
    } else {
      setKraAssignmentMode('TEMPLATE');
    }
    kraHydratedForRef.current = sessionKey;
  }, [isOpen, employeeToEdit, rehireTarget, availableTemplates]);

  // Helper to check if an employee is an HOD
  const isEmployeeHod = (emp: Employee) => {
    if (emp.systemRole === 'HOD' || (emp as any).role === 'HOD') return true;
    if (departments.some((d) => d.hodId === emp.id)) return true;
    const empDes = designations.find((d) => d.id === emp.designationId);
    const desName = (emp.designationName || empDes?.name || '').toLowerCase();
    const empName = (emp.name || '').toLowerCase();
    if (
      desName.includes('hod') ||
      desName.includes('head of') ||
      desName.includes('director') ||
      desName.includes('vp') ||
      desName.includes('vice president') ||
      (empDes && empDes.level >= 4)
    ) {
      return true;
    }
    if (empName.includes('_hod') || empName.includes(' hod')) return true;
    return false;
  };

  // Auto infer default role based on designation
  const inferDefaultRole = (desigId: string): UserRole => {
    const des = designations.find((d) => d.id === desigId);
    if (!des) return 'EMPLOYEE';
    const lower = des.name.toLowerCase();
    if (lower.includes('hr manager') || lower.includes('hr lead') || lower.includes('people')) return 'HR';
    if (lower.includes('vp') || lower.includes('director') || lower.includes('hod') || des.level >= 4) return 'HOD';
    if (lower.includes('manager') || lower.includes('lead') || des.level >= 3) return 'MANAGER';
    return 'EMPLOYEE';
  };

  // Active cycles are the only ones assignable — cycle assignment is always an explicit HR choice
  const activeCycles = cycles.filter((c) => c.active !== false);

  // Auto-suggest June Cycle (Jan - Jul joiners) or September Cycle (Aug - Dec joiners)
  const getSuggestedCycle = (dateStr?: string, cycleList?: Cycle[]): Cycle | undefined => {
    if (!dateStr || !cycleList || cycleList.length === 0) return undefined;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return undefined;
    const month = parsed.getMonth() + 1; // 1 to 12
    if (month >= 1 && month <= 7) {
      return cycleList.find((c) => c.appraisalMonth === 6 || c.code === 'JUN' || c.id === 'cycle_d') || cycleList[0];
    } else {
      return cycleList.find((c) => c.appraisalMonth === 9 || c.code === 'SEP' || c.id === 'cycle_f') || cycleList[1] || cycleList[0];
    }
  };

  // Only ACTIVE/UPCOMING periods can be picked as a starting point; defaults to the current ACTIVE period
  const assignableReviewPeriods = reviewPeriods.filter((p) => p.status === 'ACTIVE' || p.status === 'UPCOMING');
  const defaultReviewPeriodId = reviewPeriods.find((p) => p.status === 'ACTIVE')?.id || '';

  // Initialize or reset form
  useEffect(() => {
    if (employeeToEdit) {
      setEmployeeCode(employeeToEdit.employeeCode || '');
      setName(employeeToEdit.name || '');
      setEmail(employeeToEdit.email || '');
      setPhone(employeeToEdit.phone || '');
      const empLoc = employeeToEdit.location || '';
      if (empLoc) {
        setLocation(empLoc);
        setLocationOther('');
      } else {
        setLocation(allAvailableLocations[0] || 'Delhi');
        setLocationOther('');
      }
      setDepartmentId(employeeToEdit.departmentId || '');
      setDesignationId(employeeToEdit.designationId || '');
      setJoiningDate(employeeToEdit.joiningDate ? employeeToEdit.joiningDate.split('T')[0] : '');
      const existingCycle = activeCycles.find((c) => c.id === employeeToEdit.cycleId);
      const fallbackCycle = getSuggestedCycle(employeeToEdit.joiningDate, activeCycles)?.id || activeCycles[0]?.id || '';
      setCycleId(existingCycle ? existingCycle.id : fallbackCycle);
      setHasUserManuallyChangedCycle(Boolean(existingCycle));
      setStartingReviewPeriodId(
        assignableReviewPeriods.some((p) => p.id === employeeToEdit.startingReviewPeriodId)
          ? employeeToEdit.startingReviewPeriodId
          : defaultReviewPeriodId
      );
      setManagerId(employeeToEdit.managerId || '');
      setHodId(employeeToEdit.hodId || '');
      setCurrentKraTemplateId(employeeToEdit.currentKraTemplateId || '');
      setCurrentCtc(employeeToEdit.currentCtc !== undefined ? employeeToEdit.currentCtc : 1800000);
      setCurrency(employeeToEdit.currency || '₹');
      setConfirmationDate(employeeToEdit.confirmationDate ? employeeToEdit.confirmationDate.split('T')[0] : '');
      setGender(employeeToEdit.gender || 'Male');
      setEmploymentType(employeeToEdit.employmentType || 'Permanent');
      setProbationPeriodDays(employeeToEdit.probationPeriodDays !== undefined ? employeeToEdit.probationPeriodDays : 90);
      setCompanyName(employeeToEdit.companyName || 'M INTERGRAPH SYSTEMS PRIVATE LIMITED');
      if (initialRehire) {
        setStatus('ACTIVE');
        const todayStr = new Date().toISOString().split('T')[0];
        setJoiningDate(todayStr);
        setRelievingDate('');
        setProvisionLogin(true);
        setInitialPassword(`Welcome@${new Date().getFullYear()}`);
        const rehireCycle = getSuggestedCycle(todayStr, activeCycles);
        setCycleId(rehireCycle?.id || activeCycles[0]?.id || '');
        setHasUserManuallyChangedCycle(false);
      } else {
        setStatus(employeeToEdit.status || 'ACTIVE');
        setJoiningDate(employeeToEdit.joiningDate ? employeeToEdit.joiningDate.split('T')[0] : '');
        setCycleId(existingCycle ? existingCycle.id : fallbackCycle);
        setRelievingDate(
          employeeToEdit.relievingDate
            ? employeeToEdit.relievingDate.split('T')[0]
            : employeeToEdit.pastEmployeeDate
            ? employeeToEdit.pastEmployeeDate.split('T')[0]
            : ''
        );
      }

      const initialHasAccount =
        employeeToEdit.hasLoginAccount !== undefined
          ? Boolean(employeeToEdit.hasLoginAccount)
          : employeeToEdit.userActive !== undefined
          ? Boolean(employeeToEdit.userActive)
          : true;

      setProvisionLogin(initialHasAccount);
      setSystemRole(employeeToEdit.systemRole || inferDefaultRole(employeeToEdit.designationId));
      setHasUserManuallyChangedRole(Boolean(employeeToEdit.systemRole));
      setInitialPassword(initialRehire ? `Welcome@${new Date().getFullYear()}` : '');

      // Fetch fresh record from server to ensure authoritative access status
      api
        .getEmployeeById(employeeToEdit.id)
        .then((freshEmp) => {
          if (freshEmp && freshEmp.id === employeeToEdit.id) {
            if (freshEmp.hasLoginAccount !== undefined) {
              setProvisionLogin(Boolean(freshEmp.hasLoginAccount));
            }
            if (freshEmp.systemRole) {
              setSystemRole(freshEmp.systemRole);
            }
            if (freshEmp.confirmationDate !== undefined) {
              setConfirmationDate(freshEmp.confirmationDate ? freshEmp.confirmationDate.split('T')[0] : '');
            }
            if (freshEmp.gender) setGender(freshEmp.gender);
            if (freshEmp.employmentType) setEmploymentType(freshEmp.employmentType);
            if (freshEmp.probationPeriodDays !== undefined) setProbationPeriodDays(freshEmp.probationPeriodDays);
            if (freshEmp.companyName) setCompanyName(freshEmp.companyName);
          }
        })
        .catch(() => {});
    } else {
      const maxNum = (allEmployees || []).reduce((max, emp) => {
        const match = emp.employeeCode?.match(/(?:MS|EMP-?)(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      const nextCode = `MS${String(maxNum + 1).padStart(4, '0')}`;
      const defaultDept = departments[0]?.id || '';
      const defaultDeptObj = departments.find((d) => d.id === defaultDept);

      const todayStr = new Date().toISOString().split('T')[0];
      setEmployeeCode(nextCode);
      setName('');
      setEmail('');
      setPhone('');
      setLocation(allAvailableLocations[0] || 'Delhi');
      setDepartmentId(defaultDept);
      setDesignationId('');
      setJoiningDate(todayStr);
      setConfirmationDate('');
      setGender('Male');
      setEmploymentType('Permanent');
      setProbationPeriodDays(90);
      setCompanyName('M INTERGRAPH SYSTEMS PRIVATE LIMITED');
      const suggestedCycle = getSuggestedCycle(todayStr, activeCycles);
      setCycleId(suggestedCycle?.id || activeCycles[0]?.id || '');
      setHasUserManuallyChangedCycle(false);
      setStartingReviewPeriodId(defaultReviewPeriodId);
      setManagerId('');
      setHodId(defaultDeptObj?.hodId || '');
      setCurrentKraTemplateId('');
      setCurrentCtc(1800000);
      setCurrency('₹');
      setStatus('ACTIVE');
      setRelievingDate('');
      setProvisionLogin(true);
      setInitialPassword(`Welcome@${new Date().getFullYear()}`);
      setSystemRole('EMPLOYEE');
      setHasUserManuallyChangedRole(false);
    }
    setRehireTarget(null);
    setError(null);
    setCreatedResponse(null);
  }, [employeeToEdit, initialRehire, isOpen, departments, cycles, reviewPeriods, allEmployees]);

  // Rehire handler to switch modal into rehire mode
  const handleStartRehire = (pastEmp: Employee) => {
    setRehireTarget(pastEmp);
    setName(pastEmp.name || '');
    setEmployeeCode(pastEmp.employeeCode || '');
    setEmail(pastEmp.email || '');
    setPhone(pastEmp.phone || '');
    const pastLoc = pastEmp.location || '';
    if (pastLoc) {
      setLocation(pastLoc);
      setLocationOther('');
    } else {
      setLocation(allAvailableLocations[0] || 'Delhi');
      setLocationOther('');
    }
    setDepartmentId(pastEmp.departmentId || departments[0]?.id || '');
    const todayStr = new Date().toISOString().split('T')[0];
    setDesignationId(pastEmp.designationId || '');
    setJoiningDate(todayStr);
    setConfirmationDate('');
    setGender(pastEmp.gender || 'Male');
    setEmploymentType(pastEmp.employmentType || 'Permanent');
    setProbationPeriodDays(pastEmp.probationPeriodDays !== undefined ? pastEmp.probationPeriodDays : 90);
    setCompanyName(pastEmp.companyName || 'M INTERGRAPH SYSTEMS PRIVATE LIMITED');
    const suggestedRehireCycle = getSuggestedCycle(todayStr, activeCycles);
    setCycleId(suggestedRehireCycle?.id || activeCycles[0]?.id || '');
    setHasUserManuallyChangedCycle(false);
    setStartingReviewPeriodId(defaultReviewPeriodId);
    setManagerId(pastEmp.managerId || '');
    setHodId(pastEmp.hodId || '');
    setCurrentKraTemplateId(pastEmp.currentKraTemplateId || '');
    setCurrentCtc(pastEmp.currentCtc !== undefined ? pastEmp.currentCtc : 1800000);
    setCurrency(pastEmp.currency || '₹');
    setStatus('ACTIVE');
    setRelievingDate('');
    setProvisionLogin(true);
    setInitialPassword(`Welcome@${new Date().getFullYear()}`);
    setSystemRole(pastEmp.systemRole || inferDefaultRole(pastEmp.designationId));
    setError(null);
    toast.info(`Loaded ${pastEmp.name}'s profile in Rehire mode. Update details and save to reactivate.`, 'Rehire Mode');
  };

  // Real-time email conflict detection for duplicate prevention and smart rehire
  const normalizedEmail = email.trim().toLowerCase();
  const emailConflict =
    normalizedEmail && !employeeToEdit && !rehireTarget
      ? (allEmployees || []).find((e) => (e.email || '').trim().toLowerCase() === normalizedEmail)
      : null;
  const isConflictPastEmployee = Boolean(emailConflict && (emailConflict.status === 'INACTIVE' || emailConflict.isPastEmployee));

  // Selected Department Details
  const selectedDeptObj = departments.find((d) => d.id === departmentId);

  // Filter designations by selected department
  useEffect(() => {
    if (departmentId) {
      const filtered = designations.filter((d) => d.departmentId === departmentId);
      setFilteredDesignations(filtered);
      if (!isEditing || !filtered.some((d) => d.id === designationId)) {
        if (filtered.length > 0) {
          const nextDesId = filtered[0].id;
          setDesignationId(nextDesId);
          if (!hasUserManuallyChangedRole) {
            setSystemRole(inferDefaultRole(nextDesId));
          }
        }
      }
    } else {
      setFilteredDesignations(designations);
    }
  }, [departmentId, designations]);

  // Helper to determine if target employee being edited/created is an HOD or Manager
  const currentDes = designations.find((d) => d.id === designationId);
  const isTargetHod =
    systemRole === 'HOD' ||
    Boolean(currentDes && (currentDes.level >= 4 || currentDes.name?.toLowerCase().includes('vp') || currentDes.name?.toLowerCase().includes('head')));

  // Reporting Managers from all departments + All HODs (strictly exclude regular employees)
  const departmentManagers = (() => {
    return allEmployees
      .filter((emp) => {
        // Exclude the employee themselves if editing
        if (employeeToEdit && emp.id === employeeToEdit.id) return false;
        // Exclude inactive / past employees (unless currently assigned as this employee's manager)
        if ((emp.status === 'INACTIVE' || emp.isPastEmployee) && (!employeeToEdit || emp.id !== employeeToEdit.managerId)) {
          return false;
        }
        // Always include currently assigned manager so data isn't lost on edit
        if (employeeToEdit && emp.id === employeeToEdit.managerId) {
          return true;
        }

        const empDes = designations.find((d) => d.id === emp.designationId);
        const desName = (emp.designationName || empDes?.name || '').toLowerCase();

        // 1. Check system role
        const isMgrOrHodRole =
          emp.systemRole === 'MANAGER' ||
          emp.systemRole === 'HOD' ||
          (emp as any).role === 'MANAGER' ||
          (emp as any).role === 'REPORTING_MANAGER' ||
          (emp as any).role === 'HOD';

        // 2. Check if HOD
        const isHod = isEmployeeHod(emp);

        // 3. Check designation keywords for manager, lead, supervisor, head, director, vp, hod
        const isMgrOrLeadTitle =
          desName.includes('manager') ||
          desName.includes('lead') ||
          desName.includes('head') ||
          desName.includes('supervisor') ||
          desName.includes('director') ||
          desName.includes('vp') ||
          desName.includes('vice president') ||
          desName.includes('hod');

        // 4. Check if actively assigned as manager of any active employee
        const isAlreadyManaging = allEmployees.some((other) => other.managerId === emp.id && other.status !== 'INACTIVE');

        return isMgrOrHodRole || isHod || isMgrOrLeadTitle || isAlreadyManaging;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

  // Head of Departments (HODs) from all departments (strictly HODs only)
  const departmentHods = (() => {
    return allEmployees
      .filter((emp) => {
        // Exclude the employee themselves if editing
        if (employeeToEdit && emp.id === employeeToEdit.id) return false;
        // Exclude inactive / past employees (unless currently assigned as this employee's HOD)
        if ((emp.status === 'INACTIVE' || emp.isPastEmployee) && (!employeeToEdit || emp.id !== employeeToEdit.hodId)) {
          return false;
        }
        // Always include currently assigned HOD so data isn't lost on edit
        if (employeeToEdit && emp.id === employeeToEdit.hodId) {
          return true;
        }

        const empDes = designations.find((d) => d.id === emp.designationId);
        const desName = (emp.designationName || empDes?.name || '').toLowerCase();

        const isOfficialDeptHod = departments.some((d) => d.hodId === emp.id || d.hodId === emp.employeeCode);
        const isOrgWideHod = emp.systemRole === 'HOD' || (emp as any).role === 'HOD' || emp.employeeCode === 'MS0016';
        const isHodTitle =
          desName.includes('hod') ||
          desName.includes('head of') ||
          desName.includes('head') ||
          desName.includes('director') ||
          desName.includes('vp') ||
          desName.includes('vice president');

        return isOfficialDeptHod || isOrgWideHod || isHodTitle || isEmployeeHod(emp);
      })
      .sort((a, b) => {
        const aIsOfficial = a.employeeCode === 'MS0016' || selectedDeptObj?.hodId === a.id;
        const bIsOfficial = b.employeeCode === 'MS0016' || selectedDeptObj?.hodId === b.id;
        if (aIsOfficial && !bIsOfficial) return -1;
        if (!aIsOfficial && bIsOfficial) return 1;

        return (a.name || '').localeCompare(b.name || '');
      });
  })();

  // Auto-select KRA template matching department or designation if not set
  useEffect(() => {
    if (!currentKraTemplateId && availableTemplates.length > 0) {
      const matching = availableTemplates.find(
        (t) => (designationId && t.designationId === designationId) || (departmentId && t.departmentId === departmentId)
      );
      if (matching) {
        setCurrentKraTemplateId(matching.id);
      }
    }
  }, [departmentId, designationId, availableTemplates, currentKraTemplateId]);

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createdResponse) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose, createdResponse]);

  if (!isMounted) return null;

  // Handle password auto-generation
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
    let pwd = 'Pass@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInitialPassword(pwd);
  };

  // Copy credentials helper
  const handleCopyCredentials = () => {
    if (!createdResponse || !createdResponse.provisionedUser) return;
    const text =
      `Appraisal Management System Credentials:\n` +
      `URL: ${window.location.origin}\n` +
      `Employee Code: ${createdResponse.employeeCode}\n` +
      `Name: ${createdResponse.name}\n` +
      `Corporate Email: ${createdResponse.provisionedUser.email}\n` +
      `Access Role: ${createdResponse.provisionedUser.role}\n` +
      `Temporary Password: ${createdResponse.provisionedUser.temporaryPassword}\n` +
      `Note: You will be asked to update your password on first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.info('Credentials copied to clipboard.', 'Copied');
    setTimeout(() => setCopied(false), 2500);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedCtc = Number(currentCtc);

    // Validation
    if (isInactive) {
      if (!relievingDate) {
        setError('Official Relieving / Exit Date is required for an inactive or past employee.');
        toast.warning('Please specify the official Relieving / Exit Date.', 'Validation Error');
        return;
      }
    } else {
      if (!employeeCode.trim()) {
        setError('Employee Code is required.');
        toast.warning('Employee Code is required.', 'Validation Error');
        return;
      }
      if (!name.trim()) {
        setError('Full Name is required.');
        toast.warning('Full Name is required.', 'Validation Error');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please provide a valid corporate email address.');
        toast.warning('Valid corporate email address required.', 'Validation Error');
        return;
      }
      if (!departmentId) {
        setError('Department is required.');
        toast.warning('Department is required.', 'Validation Error');
        return;
      }
      if (!designationId) {
        setError('Designation is required.');
        toast.warning('Designation is required.', 'Validation Error');
        return;
      }
      if (!joiningDate) {
        setError('Joining Date is required.');
        toast.warning('Joining Date is required.', 'Validation Error');
        return;
      }
      if (!managerId && !isTargetHod) {
        setError('Reporting Manager (L1) is required. Self-managed employees are not permitted.');
        toast.warning('Reporting Manager is required.', 'Validation Error');
        return;
      }
      if (!hodId && !isTargetHod) {
        setError('Head of Department (HOD) is required.');
        toast.warning('Head of Department is required.', 'Validation Error');
        return;
      }
      if (isNaN(parsedCtc) || parsedCtc <= 0) {
        setError('Annual CTC must be a positive number.');
        toast.warning('Annual CTC must be a positive number.', 'Validation Error');
        return;
      }
    }

    let validCustomKras: Array<{ title: string; weight: number; target: string; description?: string; measurementCriteria?: string }> | undefined = undefined;

    if (!isInactive && kraAssignmentMode === 'CUSTOM') {
      const filtered = customKras
        .map((k) => ({
          title: k.title.trim(),
          weight: Number(k.weight) || 0,
          target: k.target.trim() || '100% Target SLA',
          description: k.description?.trim(),
          measurementCriteria: k.measurementCriteria?.trim(),
        }))
        .filter((k) => k.title.length > 0);

      if (filtered.length === 0) {
        setError('Please provide at least one KRA for this employee.');
        toast.warning('Please provide at least one KRA.', 'Validation Error');
        return;
      }

      const sumWeight = filtered.reduce((s, k) => s + k.weight, 0);
      if (sumWeight !== 100) {
        setError(`Total KRA weightage must sum to exactly 100% (currently ${sumWeight}%).`);
        toast.warning(`Total KRA weightage is ${sumWeight}%. It must sum to 100%.`, 'Weightage Mismatch');
        return;
      }

      validCustomKras = filtered;
    }

    setLoading(true);

    try {
      const targetEmp = employeeToEdit || rehireTarget;
      if (targetEmp) {
        if (isInactive) {
          // When an employee is inactive / past employee, ONLY relieving date and inactive status can be modified
          await api.updateEmployee(targetEmp.id, {
            status: 'INACTIVE',
            relievingDate: new Date(relievingDate).toISOString(),
          });
          toast.success(`Relieving date saved for ${name.trim()} (${employeeCode.trim()}).`, 'Record Updated');
        } else {
          const parsedCtc = Number(currentCtc);
          await api.updateEmployee(targetEmp.id, {
            employeeCode: employeeCode.trim().toUpperCase(),
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            location: (location === 'Other' ? locationOther.trim() : location.trim()) || undefined,
            departmentId,
            designationId,
            joiningDate: new Date(joiningDate).toISOString(),
            confirmationDate: confirmationDate ? new Date(confirmationDate).toISOString() : undefined,
            gender: gender || undefined,
            employmentType: employmentType || undefined,
            probationPeriodDays: status === 'PROBATION' && probationPeriodDays !== '' ? Number(probationPeriodDays) : undefined,
            companyName: companyName.trim() || undefined,
            cycleId,
            startingReviewPeriodId,
            managerId: managerId || undefined,
            hodId: hodId || undefined,
            currentKraTemplateId: kraAssignmentMode === 'TEMPLATE' ? currentKraTemplateId || undefined : undefined,
            customKras: validCustomKras,
            currentCtc: parsedCtc,
            currency,
            status,
            systemRole,
            provisionLogin,
            initialPassword:
              provisionLogin && initialPassword && initialPassword.trim().length >= 6
                ? initialPassword.trim()
                : undefined,
          });
          if (wasPastEmployee) {
            toast.success(`${name.trim()} (${employeeCode.trim()}) successfully rehired and reactivated!`, 'Employee Rehired');
          } else {
            toast.success(`Profile updated for ${name.trim()} (${employeeCode.trim()}).`, 'Employee Saved');
          }
        }

        onSaved();
        handleClose();
      } else {
        const res = await api.createEmployee({
          employeeCode: employeeCode.trim().toUpperCase(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          location: (location === 'Other' ? locationOther.trim() : location.trim()) || undefined,
          departmentId,
          designationId,
          joiningDate: new Date(joiningDate).toISOString(),
          confirmationDate: confirmationDate ? new Date(confirmationDate).toISOString() : undefined,
          gender: gender || undefined,
          employmentType: employmentType || undefined,
          probationPeriodDays: status === 'PROBATION' && probationPeriodDays !== '' ? Number(probationPeriodDays) : undefined,
          companyName: companyName.trim() || undefined,
          cycleId,
          startingReviewPeriodId,
          managerId: managerId || undefined,
          hodId: hodId || undefined,
          currentKraTemplateId: kraAssignmentMode === 'TEMPLATE' ? currentKraTemplateId || undefined : undefined,
          customKras: validCustomKras,
          currentCtc: parsedCtc,
          currency,
          status,
          relievingDate:
            status === 'INACTIVE' && relievingDate
              ? new Date(relievingDate).toISOString()
              : undefined,
          provisionLogin,
          systemRole,
          initialPassword: provisionLogin ? initialPassword : undefined,
        });

        toast.success(`Employee ${name.trim()} (${employeeCode.trim()}) registered successfully!`, 'Employee Onboarded');
        if (res.provisionedUser) {
          setCreatedResponse(res);
          onSaved();
        } else {
          onSaved();
          handleClose();
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save employee profile';
      setError(errMsg);
      toast.error(errMsg, 'Save Error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${backdropClass}`}
    >
      {/* 1. ONBOARDING CREDENTIALS SUCCESS CARD */}
      {createdResponse && createdResponse.provisionedUser ? (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden p-6 sm:p-8 text-slate-800 dark:text-slate-200 ${cardClass}`}>
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Employee created & access provisioned!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              The employee profile and login account were created successfully. Share these initial credentials with the employee.
            </p>
          </div>

          <div className="mt-5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 space-y-2.5 tabular-nums text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 font-sans">Employee:</span>
              <span className="font-semibold text-slate-900 dark:text-white font-sans">
                {createdResponse.name} ({createdResponse.employeeCode})
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 font-sans">Corporate email:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{createdResponse.provisionedUser.email}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 font-sans">System access role:</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 font-sans text-[11px]">
                {createdResponse.provisionedUser.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-sans">Temporary password:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                {createdResponse.provisionedUser.temporaryPassword}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <Shield className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Employee will be prompted to set a permanent password upon their first login.</span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleCopyCredentials}
              className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Copy login details</span>
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="py-2.5 px-6 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        /* 2. SIMPLE ONE-PAGE EMPLOYEE FORM MODAL */
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200 flex flex-col max-h-[92vh] ${cardClass}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                {isRehiring ? <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : isEditing ? <Briefcase className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isRehiring ? 'Rehire Past Employee' : isEditing ? 'Edit Employee Profile' : 'Add New Employee'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRehiring ? 'Reactivate past employee profile with new tenure details, cycle, and portal access.' : 'Fill in employee details, department, cycle, compensation, and portal credentials in one place.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Single Unified Scrollable Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-slate-900">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
                {emailConflict && isConflictPastEmployee && (
                  <button
                    type="button"
                    onClick={() => handleStartRehire(emailConflict)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <UserCheck className="w-3 h-3" />
                    Rehire {emailConflict.name}
                  </button>
                )}
              </div>
            )}

            {/* Rehiring Mode Active Banner */}
            {isRehiring && (
              <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200 animate-in fade-in duration-150">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <span className="font-bold text-emerald-950 dark:text-emerald-100 block text-xs">
                    Rehiring mode active — reactivating employee record
                  </span>
                  <p className="text-emerald-800 dark:text-emerald-300/90 leading-relaxed text-[11px]">
                    You are rehiring <strong>{name}</strong> ({employeeCode}). Past appraisals and reviews remain securely preserved and immutable. A new employment tenure begins on <strong>{joiningDate || 'today'}</strong>. All profile, organization, compensation, and portal credential fields are now unlocked.
                  </p>
                </div>
              </div>
            )}

            {/* Inactive / Past Employee Audit Lock Notice */}
            {isInactive && (
              <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-950 dark:text-amber-100 block text-xs">
                      {wasPastEmployee ? 'Archived Past Employee — Profile Details Inactive' : 'Employee Marked as Inactive — Profile Details Locked'}
                    </span>
                    <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed text-[11px]">
                      This employee record is marked inactive / relieved. Only the official relieving / exit date can be updated, or you can rehire them to begin a new tenure.
                    </p>
                  </div>
                </div>
                {wasPastEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('ACTIVE');
                      setJoiningDate(new Date().toISOString().split('T')[0]);
                      setRelievingDate('');
                      setProvisionLogin(true);
                      setInitialPassword(`Welcome@${new Date().getFullYear()}`);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Rehire employee
                  </button>
                )}
              </div>
            )}

            {/* SECTION 1: Personal & Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    1. Personal & Contact Details
                  </h3>
                </div>
                {isInactive && (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employee code <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      disabled={isInactive}
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                      placeholder="MS0001"
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-xs tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isInactive}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                  />
                </div>

                {/* Corporate Email */}
                <div className={emailConflict ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Corporate email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      disabled={isInactive}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="rahul@company.com"
                      className={`w-full bg-white dark:bg-slate-800 border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60 ${
                        emailConflict
                          ? isConflictPastEmployee
                            ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-500/20'
                            : 'border-rose-400 dark:border-rose-500 ring-1 ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>

                  {/* Smart Rehire / Duplicate Email Assistant */}
                  {emailConflict && (
                    <div className="mt-2.5">
                      {isConflictPastEmployee ? (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-150">
                          <div className="flex items-start gap-2.5">
                            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-bold text-blue-950 dark:text-blue-100 block text-xs">
                                Past Employee Record Found: {emailConflict.name} ({emailConflict.employeeCode})
                              </span>
                              <p className="text-[11px] text-blue-800 dark:text-blue-300/90 leading-relaxed">
                                This email was used by an employee relieved on {emailConflict.relievingDate ? new Date(emailConflict.relievingDate).toLocaleDateString() : 'previous date'}. Production HRMS systems require rehiring their profile rather than creating a duplicate account.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartRehire(emailConflict)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Rehire this employee
                          </button>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in duration-150">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>This corporate email is actively in use by <strong>{emailConflict.name}</strong> ({emailConflict.employeeCode}). Please enter a unique corporate email.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official mobile / contact
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      disabled={isInactive}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      disabled={isInactive}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Base Office / Work Location */}
                <div className="relative" ref={locationPickerRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Base office / work location
                    </label>
                    {location && location !== 'Other' && (
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {getEmployeeCountForLocation(location).count} active emp(s)
                      </span>
                    )}
                  </div>

                  {/* Trigger Button */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={isInactive}
                      onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-left text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">
                          {location === 'Other'
                            ? (locationOther ? `Other: ${locationOther}` : 'Other (specify below)')
                            : (location || 'Select Location')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {location && location !== 'Other' && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                            {getEmployeeCountForLocation(location).count} emps
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${locationDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  </div>

                  {/* Dropdown Menu Popover */}
                  {locationDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      {/* Search Bar */}
                      <div className="p-2 border-b border-slate-100 dark:border-slate-750 bg-slate-50/80 dark:bg-slate-800/80">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={locationSearch}
                            onChange={(e) => setLocationSearch(e.target.value)}
                            placeholder="Search locations..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Locations List */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/80">
                        {filteredLocations.map((locName) => {
                          const { count } = getEmployeeCountForLocation(locName);
                          const isSelected = location === locName;
                          return (
                            <div
                              key={locName}
                              onClick={() => {
                                setLocation(locName);
                                setLocationOther('');
                                setLocationDropdownOpen(false);
                              }}
                              className={`px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                <span className="truncate">{locName}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Employee Count Badge */}
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                                    count > 0
                                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                  }`}
                                  title={`${count} active employee(s) assigned`}
                                >
                                  {count} {count === 1 ? 'emp' : 'emps'}
                                </span>

                                {/* Delete Location Icon (HR / Super Admin only) */}
                                {isHRorAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLocationClick(locName);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors cursor-pointer"
                                    title={count > 0 ? `Cannot delete: ${count} employee(s) assigned` : `Delete location "${locName}"`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {filteredLocations.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No locations matched your search.
                          </div>
                        )}

                        {/* Other Option */}
                        <div
                          onClick={() => {
                            setLocation('Other');
                            setLocationDropdownOpen(false);
                          }}
                          className={`px-3 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-t border-slate-100 dark:border-slate-800 ${
                            location === 'Other'
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Other (specify custom location)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {location === 'Other' && (
                    <div className="relative mt-2">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        disabled={isInactive}
                        placeholder="Enter custom location..."
                        value={locationOther}
                        onChange={(e) => setLocationOther(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-indigo-400 dark:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>

                {/* Joining Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Joining date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      required
                      disabled={isInactive}
                      value={joiningDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setJoiningDate(newDate);
                        if (!hasUserManuallyChangedCycle && newDate) {
                          const suggested = getSuggestedCycle(newDate, activeCycles);
                          if (suggested) {
                            setCycleId(suggested.id);
                          }
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>

                {/* Confirmation Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirmation date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      disabled={isInactive}
                      value={confirmationDate}
                      onChange={(e) => setConfirmationDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Organization & Job Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    2. Department & Employment Role
                  </h3>
                </div>
                {isInactive && (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      required
                      disabled={isInactive}
                      value={departmentId}
                      onChange={(e) => {
                        const newDeptId = e.target.value;
                        const targetDept = departments.find((d) => d.id === newDeptId);
                        setDepartmentId(newDeptId);
                        setManagerId('');
                        setHodId(targetDept?.hodId || '');
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="" disabled>
                        Select department
                      </option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Designation <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      required
                      disabled={isInactive}
                      value={designationId}
                      onChange={(e) => {
                        const newDesId = e.target.value;
                        setDesignationId(newDesId);
                        if (!hasUserManuallyChangedRole) {
                          setSystemRole(inferDefaultRole(newDesId));
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="" disabled>
                        Select designation
                      </option>
                      {filteredDesignations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} (Level {d.level})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Appraisal Cycle Assignment */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Appraisal cycle <span className="text-rose-500">*</span>
                    </label>
                    {joiningDate && (
                      <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-900/50">
                        {new Date(joiningDate).getMonth() + 1 >= 1 && new Date(joiningDate).getMonth() + 1 <= 7
                          ? 'Jan–Jul: June Cycle'
                          : 'Aug–Dec: Sept Cycle'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      required
                      disabled={isInactive}
                      value={cycleId}
                      onChange={(e) => {
                        setCycleId(e.target.value);
                        setHasUserManuallyChangedCycle(true);
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="" disabled>
                        Select appraisal cycle *
                      </option>
                      {activeCycles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.appraisalMonth === 6 ? 'Jan–Jul' : 'Aug–Dec'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Starting Review Period Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Starting review period <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      required
                      disabled={isInactive}
                      value={startingReviewPeriodId}
                      onChange={(e) => setStartingReviewPeriodId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="" disabled>
                        Select starting review period *
                      </option>
                      {assignableReviewPeriods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Quarterly reviews will only be generated from this period onward.
                  </p>
                </div>

                {/* Employment Type */}
                <div className={status === 'PROBATION' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employment type
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <select
                      disabled={isInactive}
                      value={employmentType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmploymentType(val);
                        if (val === 'Probationary' && status !== 'PROBATION') {
                          setStatus('PROBATION');
                          if (!probationPeriodDays) setProbationPeriodDays(90);
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="Intern">Intern</option>
                      <option value="Probationary">Probationary</option>
                    </select>
                  </div>
                </div>

                {/* Probation Period In Days (Shown only when Employment Status is PROBATION) */}
                {status === 'PROBATION' && (
                  <div className="animate-in fade-in duration-200">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Probation period (days)
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min="0"
                        disabled={isInactive}
                        value={probationPeriodDays}
                        onChange={(e) => setProbationPeriodDays(e.target.value)}
                        placeholder="e.g. 90 or 120"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                      />
                    </div>
                  </div>
                )}

                {/* Company / Legal Entity */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / legal entity
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      disabled={isInactive}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="M INTERGRAPH SYSTEMS PRIVATE LIMITED"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>

                {/* Employment Status Selector (Spans Full Width across sm:col-span-3) */}
                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Employment status
                    </label>
                    {wasPastEmployee && (
                      <span className={`text-[11px] font-bold flex items-center gap-1 ${
                        isRehiring ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {isRehiring ? (
                          <>
                            <UserCheck className="w-2.5 h-2.5" /> Rehire active
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5" /> Inactive record
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'ACTIVE', label: 'Active', icon: CheckCircle2, activeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-500/20' },
                      { key: 'PROBATION', label: 'Probation', icon: Clock, activeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 ring-1 ring-amber-500/20' },
                      { key: 'NOTICE', label: 'Notice Period', icon: AlertCircle, activeClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 ring-1 ring-orange-500/20' },
                      { key: 'INACTIVE', label: 'Inactive / Relieved', icon: UserMinus, activeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 ring-1 ring-rose-500/20' },
                    ].map(({ key, label, icon: Icon, activeClass }) => {
                      const isSelected = status === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setStatus(key as any);
                            if (key === 'PROBATION') {
                              if (!probationPeriodDays) {
                                setProbationPeriodDays(90);
                              }
                            }
                            if (key === 'INACTIVE') {
                              if (!relievingDate) {
                                setRelievingDate(new Date().toISOString().split('T')[0]);
                              }
                            } else if (wasPastEmployee) {
                              setRelievingDate('');
                              setJoiningDate(new Date().toISOString().split('T')[0]);
                              setProvisionLogin(true);
                              setInitialPassword(`Welcome@${new Date().getFullYear()}`);
                            }
                          }}
                          className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? activeClass
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Relieving / Exit Date Field */}
                {isInactive && (
                  <div className="sm:col-span-3 bg-rose-50/70 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-800/80 rounded-xl p-4 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        Official relieving / exit date <span className="text-rose-600">*</span>
                      </label>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200">
                        <Edit2 className="w-2.5 h-2.5" /> Editable field
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-rose-500 pointer-events-none" />
                        <input
                          type="date"
                          required
                          value={relievingDate}
                          onChange={(e) => setRelievingDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border-2 border-rose-300 dark:border-rose-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 font-semibold"
                        />
                      </div>
                      <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                        This employee is marked as inactive / relieved. All other profile details are locked; only this relieving date can be adjusted.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: Reporting Hierarchy & Goals */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    3. Hierarchy & Performance Alignment
                  </h3>
                </div>
                {isInactive && (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Reporting Manager (L1) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reporting Manager {isTargetHod ? '(Optional for HOD)' : '(L1)'}{' '}
                    {!isTargetHod && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    required={!isTargetHod}
                    disabled={isInactive}
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                  >
                    <option value="" disabled={!isTargetHod}>
                      {isTargetHod ? 'Direct Department Head / No L1 Manager' : 'Select Reporting Manager *'}
                    </option>
                    {departmentManagers.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designationName || emp.systemRole || 'Manager'}{emp.departmentName ? ` • ${emp.departmentName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Head of Department (HOD) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Head of Dept (HOD) {isTargetHod ? '(Optional for HOD)' : <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    required={!isTargetHod}
                    disabled={isInactive}
                    value={hodId}
                    onChange={(e) => setHodId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                  >
                    <option value="" disabled={!isTargetHod}>
                      {isTargetHod ? 'Self / Executive Head of Department' : 'Select Head of Department (HOD) *'}
                    </option>
                    {departmentHods.map((emp) => {
                      const isOfficial = emp.id === selectedDeptObj?.hodId || emp.employeeCode === 'MS0016';
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.designationName || 'HOD'}{emp.departmentName ? ` • ${emp.departmentName}` : ''}){isOfficial ? ' (official HOD)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* KRA / Performance Scorecard Section */}
              <div className="bg-slate-50/80 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-750 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Key result areas (KRAs)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Assign custom individual KRAs for this employee or select from the standard template library.
                    </p>
                  </div>

                  <div className="inline-flex p-0.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={isInactive}
                      onClick={() => {
                        setKraAssignmentMode('CUSTOM');
                        setShowCustomKraModal(true);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        kraAssignmentMode === 'CUSTOM'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5" />
                      Custom scorecard
                    </button>
                    <button
                      type="button"
                      disabled={isInactive}
                      onClick={() => setKraAssignmentMode('TEMPLATE')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        kraAssignmentMode === 'TEMPLATE'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Template library
                    </button>
                  </div>
                </div>

                {kraAssignmentMode === 'TEMPLATE' ? (
                  <div className="py-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Choose standard KRA template
                    </label>
                    <select
                      disabled={isInactive}
                      value={currentKraTemplateId}
                      onChange={(e) => setCurrentKraTemplateId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="">Auto-assign / default template</option>
                      {availableTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title || t.name} ({t.departmentName || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-800 px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const filledCount = customKras.filter((k) => k.title.trim().length > 0).length;
                        return filledCount > 0 ? (
                          <>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {filledCount} KRA{filledCount === 1 ? '' : 's'} filled • Total Weightage:
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                totalCustomWeight === 100
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                              }`}
                            >
                              {totalCustomWeight}% / 100% {totalCustomWeight === 100 ? '✓ Balanced' : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            No custom KRAs added yet. Build the employee's scorecard to continue.
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      disabled={isInactive}
                      onClick={() => setShowCustomKraModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <Target className="w-3.5 h-3.5" />
                      {customKras.some((k) => k.title.trim().length > 0) ? 'Edit Scorecard' : 'Build Scorecard'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 4: Compensation & Portal Login */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    4. Compensation & Portal Access
                  </h3>
                </div>
                {isInactive && (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Starting Annual CTC */}
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Starting annual CTC <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <select
                      disabled={isInactive}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="absolute left-2 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 pr-1.5 py-1 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="₹">₹ INR</option>
                      <option value="$">$ USD</option>
                      <option value="€">€ EUR</option>
                      <option value="£">£ GBP</option>
                      <option value="AED">AED</option>
                      <option value="SGD">SGD</option>
                    </select>
                    <input
                      type="number"
                      required
                      min="0"
                      step="10000"
                      disabled={isInactive}
                      value={currentCtc}
                      onChange={(e) => setCurrentCtc(e.target.value)}
                      placeholder="1800000"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-16 pr-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                </div>

                {/* Provision Login Toggle Card */}
                <div className="sm:col-span-2 flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Enable portal login access</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Create user account with corporate email credentials
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                    <input
                      type="checkbox"
                      disabled={isInactive}
                      checked={provisionLogin}
                      onChange={(e) => setProvisionLogin(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                  </label>
                </div>
              </div>

              {/* Login Credentials Inputs (Visible when login enabled) */}
              {provisionLogin && (
                <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-in fade-in duration-150">
                  {/* System Access Role */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      System access role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      disabled={isInactive}
                      value={systemRole}
                      onChange={(e) => {
                        setSystemRole(e.target.value as UserRole);
                        setHasUserManuallyChangedRole(true);
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                    >
                      <option value="EMPLOYEE">EMPLOYEE (self-assessment & KRA tracker)</option>
                      <option value="MANAGER">MANAGER (reviewer & scoring)</option>
                      <option value="HOD">HOD (department secondary calibration)</option>
                      <option value="HR">HR (people operations & approvals)</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (system administrator)</option>
                    </select>
                  </div>

                  {/* Initial Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isEditing ? 'Reset Password (Optional)' : 'Initial Password'}
                      </label>
                      <button
                        type="button"
                        disabled={isInactive}
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Sparkles className="w-3 h-3" />
                        Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        disabled={isInactive}
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        placeholder={isEditing ? 'Leave blank to keep current' : 'Min 6 characters'}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                      />
                      <button
                        type="button"
                        disabled={isInactive}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Form Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {isInactive ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Profile locked for past employee • relieving date editable
                  </span>
                ) : (
                  <>
                    Fields marked with <span className="text-rose-500">*</span> are mandatory
                  </>
                )}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : isRehiring ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      Save & rehire employee
                    </>
                  ) : isInactive ? (
                    wasPastEmployee ? (
                      'Update Relieving Date'
                    ) : (
                      'Save & Relieve Employee'
                    )
                  ) : isEditing ? (
                    'Update Employee'
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Save & provision employee
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <CustomKraScorecardModal
        isOpen={showCustomKraModal}
        onClose={() => setShowCustomKraModal(false)}
        onDone={(rows) => {
          setCustomKras(rows);
          setShowCustomKraModal(false);
        }}
        initialKras={customKras}
        employeeCode={employeeCode}
        name={name}
        designationName={currentDes?.name}
        departmentName={selectedDeptObj?.name}
        managerName={allEmployees.find((e) => e.id === managerId)?.name}
        hodName={allEmployees.find((e) => e.id === hodId)?.name}
        cycleName={cycles.find((c) => c.id === cycleId)?.name}
        templates={kraTemplates}
      />

      {/* Reusable Custom Location Deletion Confirmation Modal */}
      <MasterDeleteModal
        deleteTarget={locationDeleteTarget}
        onClose={() => setLocationDeleteTarget(null)}
        onConfirm={handleConfirmDeleteLocation}
        loading={locationDeleteLoading}
      />
    </div>,
    document.body
  );
};
