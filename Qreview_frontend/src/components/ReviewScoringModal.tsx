import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  EmployeeReview,
  KraReturnFlag,
  ReturnSelection,
  ReviewKraSnapshot,
  ReviewStatus,
  User,
} from '../types';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import { EmployeeStatusBadge } from './ui/StatusBadge';
import {
  X,
  Printer,
  Sparkles,
  Lock,
  AlertCircle,
  RotateCcw,
  Check,
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Save,
  UserCheck,
  Send,
  AlertTriangle,
  Award,
  Loader2,
} from 'lucide-react';
import {
  Step1SelfSection,
  Step2ManagerSection,
  Step3HodScoringSection,
  Step4FinalReviewSection,
  ManagerFeedbackSection,
  ScoreSummaryBar,
  StatusRemarksModal,
  AuditTrailDrawer,
  ReturnReviewModal,
  getOpenReturn,
  getReturnCount,
  getReturnDueInfo,
  getQueuedHodLeg,
  isReturnedKraAddressed,
  buildReturnResponses,
} from './reviews/ReviewScoringModal';
import { ReviewLetterModal } from './ReviewLetterModal';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { m, AnimatePresence, accordionVariants } from '../animations';

interface ReviewScoringModalProps {
  review: EmployeeReview | null;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ReviewScoringModal: React.FC<ReviewScoringModalProps> = ({
  review,
  currentUser,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  // Previous step, so a step change can slide in from the direction of travel
  const prevStepRef = React.useRef(wizardStep);
  const stepDirection = wizardStep >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = wizardStep;
  }, [wizardStep]);
  const [snapshots, setSnapshots] = useState<ReviewKraSnapshot[]>([]);
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [managerComments, setManagerComments] = useState('');
  const [hrComments, setHrComments] = useState('');
  const [employeeComments, setEmployeeComments] = useState('');
  const [statusModalRemarks, setStatusModalRemarks] = useState('');
  const [showStatusModal, setShowStatusModal] = useState<ReviewStatus | null>(null);
  const [returnModalMode, setReturnModalMode] = useState<'HOD' | 'HR' | null>(null);
  const [returnBannerExpanded, setReturnBannerExpanded] = useState(false);
  const [returnPreselect, setReturnPreselect] = useState<string[] | undefined>(undefined);
  const [hodOverallComments, setHodOverallComments] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessNote, setAiSuccessNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);

  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen,
    onClose,
  });

  // Forward declaration ref for handleAttemptClose
  const handleAttemptCloseRef = React.useRef<() => void>(() => {});

  // Scroll lock and Escape dismissal
  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedAlert) {
          setShowUnsavedAlert(false);
        } else if (returnModalMode) {
          // ReturnReviewModal handles its own Escape
        } else if (showStatusModal) {
          setShowStatusModal(null);
        } else if (showAuditModal) {
          setShowAuditModal(false);
        } else {
          handleAttemptCloseRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showStatusModal, showAuditModal, showUnsavedAlert, returnModalMode]);

  // Sync state when review prop changes
  useEffect(() => {
    if (review) {
      setSnapshots(
        review.kraSnapshot.map((s) => ({
          ...s,
          rating: s.rating || 0,
          achievement: s.achievement || '',
          comments: s.comments || '',
          ratingJustification: s.ratingJustification || '',
          hodRating: s.hodRating || 0,
          hodAchievement: s.hodAchievement || '',
          hodComments: s.hodComments || '',
          hodJustification: s.hodJustification || '',
          selfJustification: s.selfJustification || '',
        }))
      );
      setStrengths(review.strengths || '');
      setImprovements(review.improvements || '');
      setManagerComments(review.managerOverallComments || '');
      setHodOverallComments(review.hodOverallComments || '');
      setHrComments(review.hrComments || '');
      setEmployeeComments(review.employeeComments || '');
      setReturnModalMode(null);
      setReturnBannerExpanded(false);
      setErrorMessage('');
      setSuccessMessage('');
      setAiSuccessNote('');

      // Determine initial wizard step:
      if (getOpenReturn(review, 'MANAGER')) {
        setWizardStep(2);
      } else if (review.status === 'HOD_PENDING') {
        setWizardStep(3);
      } else if (
        review.status === 'HR_PENDING' ||
        review.status === 'HR_COMPLETED' ||
        review.status === 'CLOSED' ||
        review.status === 'MANAGER_COMPLETED'
      ) {
        setWizardStep(4);
      } else if (review.selfSubmittedAt) {
        setWizardStep(1);
      } else {
        setWizardStep(2);
      }
    }
  }, [review]);

  // Real-time calculated live weighted score
  const computedScore = useMemo(() => {
    let sum = 0;
    snapshots.forEach((item) => {
      const r = item.rating || 0;
      const w = item.weight || 0;
      sum += (r * w) / 100;
    });
    return Number(sum.toFixed(2));
  }, [snapshots]);

  // Score tier label & color
  const scoreTier = useMemo(() => {
    if (computedScore === 0) return { label: 'Unscored', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
    if (computedScore >= 4.5) return { label: 'Outstanding (5/5 Tier)', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' };
    if (computedScore >= 3.5) return { label: 'Exceeds Expectations', color: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' };
    if (computedScore >= 2.5) return { label: 'Meets Expectations', color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800' };
    return { label: 'Needs Improvement', color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' };
  }, [computedScore]);

  const unratedCount = useMemo(() => {
    return snapshots.filter((s) => !s.rating || s.rating === 0).length;
  }, [snapshots]);

  // HOD's own live weighted score, tier, and unrated count — fully independent of the Manager's.
  const computedHodScore = useMemo(() => {
    let sum = 0;
    snapshots.forEach((item) => {
      const r = item.hodRating || 0;
      const w = item.weight || 0;
      sum += (r * w) / 100;
    });
    return Number(sum.toFixed(2));
  }, [snapshots]);

  const hodScoreTier = useMemo(() => {
    if (computedHodScore === 0) return { label: 'Unscored', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
    if (computedHodScore >= 4.5) return { label: 'Outstanding (5/5 Tier)', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' };
    if (computedHodScore >= 3.5) return { label: 'Exceeds Expectations', color: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' };
    if (computedHodScore >= 2.5) return { label: 'Meets Expectations', color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800' };
    return { label: 'Needs Improvement', color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' };
  }, [computedHodScore]);

  const unratedHodCount = useMemo(() => {
    return snapshots.filter((s) => !s.hodRating || s.hodRating === 0).length;
  }, [snapshots]);

  // Track missing justifications for extreme ratings (1, 2, 5) with minimum 15 chars
  const missingManagerJustifications = useMemo(() => {
    return snapshots.filter(
      (s) => [1, 2, 5].includes(s.rating || 0) && (!s.ratingJustification || s.ratingJustification.trim().length < 15)
    ).length;
  }, [snapshots]);

  const missingHodJustifications = useMemo(() => {
    return snapshots.filter(
      (s) => [1, 2, 5].includes(s.hodRating || 0) && (!s.hodJustification || s.hodJustification.trim().length < 15)
    ).length;
  }, [snapshots]);

  const firstInvalidManagerKra = useMemo(() => {
    return snapshots.find(
      (s) => [1, 2, 5].includes(s.rating || 0) && (!s.ratingJustification || s.ratingJustification.trim().length < 15)
    );
  }, [snapshots]);

  const firstInvalidHodKra = useMemo(() => {
    return snapshots.find(
      (s) => [1, 2, 5].includes(s.hodRating || 0) && (!s.hodJustification || s.hodJustification.trim().length < 15)
    );
  }, [snapshots]);

  // KRA-level return progress for whoever currently holds the return.
  const unaddressedManagerKras = useMemo(
    () => snapshots.filter((k) => k.returnFlag?.target === 'MANAGER' && !isReturnedKraAddressed(k, 'MANAGER')),
    [snapshots]
  );
  const unaddressedHodKras = useMemo(
    () => snapshots.filter((k) => k.returnFlag?.target === 'HOD' && !isReturnedKraAddressed(k, 'HOD')),
    [snapshots]
  );

  const scrollToKraCard = (cardPrefix: 'mgr' | 'hod', kraId: string) => {
    const el = document.getElementById(`${cardPrefix}-kra-card-${kraId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!isMounted || !review) return null;

  // Permissions: Only the assigned Reporting Manager or HR / Super Admin can score and edit
  // KRA ratings. A plain HOD never edits Manager ratings — HOD instead reviews the submitted
  // assessment and approves/returns it via canHodAct below. These are checked against the
  // actual manager/HOD relationship on the review, not the caller's stored account-level role
  // label, so a person who holds both capacities for this employee (e.g. is both their
  // reporting manager and their HOD) gets both abilities.
  const isHrOrAdmin = currentUser?.role === 'HR' || currentUser?.role === 'SUPER_ADMIN';
  const canActInElevatedCapacity = currentUser?.role !== 'EMPLOYEE';
  const isManager =
    canActInElevatedCapacity &&
    (review.managerId === currentUser?.employeeId || review.managerId === currentUser?.id);
  const canEdit = !review.isClosed && (isHrOrAdmin || isManager);
  const isHod = canActInElevatedCapacity && review.hodId === currentUser?.employeeId;
  const canHodAct = isHod && review.status === 'HOD_PENDING' && !review.isClosed;
  const managerCanSubmit =
    canEdit && !isHrOrAdmin && ['DRAFT', 'ASSIGNED', 'MANAGER_PENDING', 'RETURNED'].includes(review.status);

  // Detect if user has entered unsaved scores, notes, or commentary. Plain computation (not a
  // hook) because it runs after the early return above.
  const hasUnsavedChanges = (() => {
    if (!review || (!canEdit && !canHodAct)) return false;
    if (canEdit) {
      if (strengths !== (review.strengths || '')) return true;
      if (improvements !== (review.improvements || '')) return true;
      if (managerComments !== (review.managerOverallComments || '')) return true;
      if (hrComments !== (review.hrComments || '')) return true;
      if (employeeComments !== (review.employeeComments || '')) return true;
    }
    if (canHodAct && hodOverallComments !== (review.hodOverallComments || '')) return true;

    const origMap = new Map((review.kraSnapshot || []).map((k) => [k.id, k]));
    for (const s of snapshots) {
      const orig = origMap.get(s.id) as any;
      if (!orig) return true;
      if (canEdit) {
        if ((s.rating || 0) !== (orig.rating || 0)) return true;
        if ((s.achievement || '') !== (orig.achievement || '')) return true;
        if ((s.comments || '') !== (orig.comments || '')) return true;
      }
      if (canHodAct) {
        if ((s.hodRating || 0) !== (orig.hodRating || 0)) return true;
        if ((s.hodAchievement || '') !== (orig.hodAchievement || '')) return true;
        if ((s.hodComments || '') !== (orig.hodComments || '')) return true;
      }
      if (s.returnFlag) {
        if ((s.returnFlag.reply || '') !== (orig.returnFlag?.reply || '')) return true;
        if (Boolean(s.returnFlag.keepRating) !== Boolean(orig.returnFlag?.keepRating)) return true;
        if ((s.returnFlag.keepReason || '') !== (orig.returnFlag?.keepReason || '')) return true;
      }
    }
    return false;
  })();

  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedAlert(true);
    } else {
      handleClose();
    }
  };

  handleAttemptCloseRef.current = handleAttemptClose;

  const handleKraChange = (index: number, field: keyof ReviewKraSnapshot, value: any) => {
    setSnapshots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleReturnFlagChange = (index: number, patch: Partial<KraReturnFlag>) => {
    setSnapshots((prev) => {
      const updated = [...prev];
      const flag = updated[index].returnFlag;
      if (!flag) return prev;
      updated[index] = { ...updated[index], returnFlag: { ...flag, ...patch } };
      return updated;
    });
  };

  /** Blocks submission while a returned KRA hasn't been changed or explicitly kept. */
  const guardUnaddressedReturn = (target: 'MANAGER' | 'HOD'): boolean => {
    const pending = target === 'MANAGER' ? unaddressedManagerKras : unaddressedHodKras;
    if (pending.length === 0) return false;
    const first = pending[0];
    const msg = `${pending.length} returned KRA${pending.length === 1 ? '' : 's'} still need${pending.length === 1 ? 's' : ''} your attention — update the rating/justification or tick "Keep current rating" with a reason (first: "${first.kraName || first.title}").`;
    setErrorMessage(msg);
    toast.warning(msg, 'Returned KRAs pending');
    setWizardStep(target === 'MANAGER' ? 2 : 3);
    setTimeout(() => scrollToKraCard(target === 'MANAGER' ? 'mgr' : 'hod', first.id), 100);
    return true;
  };

  // AI Assist Draft Generator
  const handleAiDraftSummary = async () => {
    try {
      setAiLoading(true);
      setErrorMessage('');
      setAiSuccessNote('');

      const kraSummary = snapshots.map((s) => ({
        title: s.kraName || s.title || 'Key Deliverable',
        weightage: s.weight || 0,
        target: s.targetSnapshot || 'Quality delivery within SLA',
      }));

      const res = await api.generateAiReviewSynthesis({
        employeeName: review.employeeName,
        designation: review.designationName,
        department: review.departmentName,
        quarterlyScores: [
          {
            quarter: review.reviewPeriodName || 'Current Quarter',
            score: computedScore || 4.0,
            reviewNotes: snapshots.map((s) => s.achievement).filter(Boolean).join('; '),
          },
        ],
        annualScore: computedScore || 4.0,
        kraSummary,
        perspective: 'manager',
      });

      if (res?.data) {
        if (res.data.suggestedManagerNarrative || res.data.executiveSummary) {
          setManagerComments(res.data.suggestedManagerNarrative || res.data.executiveSummary);
        }
        if (res.data.topStrengths && res.data.topStrengths.length > 0) {
          setStrengths(res.data.topStrengths.map((s) => `• ${s}`).join('\n'));
        }
        if (res.data.growthAreas && res.data.growthAreas.length > 0) {
          setImprovements(res.data.growthAreas.map((g) => `• ${g}`).join('\n'));
        }
        setAiSuccessNote('Draft summary written with Gemini. Read it through and edit it before you submit.');
      }
    } catch (err: any) {
      console.warn('AI synthesis fallback:', err);
      const highRatedKras = snapshots.filter((s) => (s.rating || 0) >= 3.5);
      const lowRatedKras = snapshots.filter((s) => (s.rating || 0) > 0 && (s.rating || 0) < 3.5);

      const fallbackStrengths =
        highRatedKras.length > 0
          ? highRatedKras.map((k) => `• Exceptional ownership and execution on ${k.kraName || k.title || 'deliverables'}.`).join('\n')
          : `• Consistently demonstrated dependable execution on core technical deliverables.\n• Proactive team collaboration and consistent attendance in sprint milestones.`;

      const fallbackGrowth =
        lowRatedKras.length > 0
          ? lowRatedKras.map((k) => `• Target deeper consistency and stretch SLA benchmarks for ${k.kraName || k.title || 'targeted deliverables'}.`).join('\n')
          : `• Further enhance autonomous system design and technical documentation.\n• Expand cross-departmental impact and domain knowledge sharing.`;

      setStrengths(fallbackStrengths);
      setImprovements(fallbackGrowth);
      setManagerComments(
        `${review.employeeName} demonstrated dependable ownership and disciplined execution throughout ${review.reviewPeriodName}. Core deliverables align well with department milestones, achieving a weighted rating of ${computedScore > 0 ? computedScore.toFixed(2) : '3.50'}/5.00.`
      );
      setAiSuccessNote('Draft summary written from the current KRA ratings. Read it through and edit it before you submit.');
    } finally {
      setAiLoading(false);
    }
  };

  // Save draft or submit scores
  const handleSaveScores = async (isDraft: boolean) => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (review?.employeeStatus === 'INACTIVE') {
      const msg = 'Cannot submit evaluation for an inactive/offboarded employee.';
      setErrorMessage(msg);
      toast.error(msg, 'Action restricted');
      setSaving(false);
      return;
    }

    if (!isDraft && guardUnaddressedReturn('MANAGER')) {
      setSaving(false);
      return;
    }

    if (!isDraft) {
      const unrated = snapshots.some((s) => !s.rating || s.rating === 0);
      if (unrated) {
        const msg = 'All KRA items must be assigned a rating (1-5) before submitting the evaluation.';
        setErrorMessage(msg);
        toast.warning(msg, 'Incomplete ratings');
        setSaving(false);
        setWizardStep(2);
        return;
      }

      const invalidJustification = snapshots.find(
        (s) => [1, 2, 5].includes(s.rating || 0) && (!s.ratingJustification || s.ratingJustification.trim().length < 15)
      );
      if (invalidJustification) {
        const targetId = invalidJustification.id || (invalidJustification as any).kraId || '';
        const msg = `KRA "${invalidJustification.kraName || invalidJustification.title}" is rated ${invalidJustification.rating}, which needs a justification of at least 15 characters.`;
        setErrorMessage(msg);
        toast.warning(msg, 'Mandatory justification required');
        setSaving(false);
        setWizardStep(2);
        setTimeout(() => {
          const el = document.getElementById(`mgr-kra-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
    }

    try {
      await api.scoreReview(review.id, {
        kraSnapshot: snapshots,
        strengths,
        improvements,
        managerOverallComments: managerComments,
        employeeComments,
        hrComments,
        isDraft,
        returnResponses: buildReturnResponses(snapshots.filter((k) => k.returnFlag?.target === 'MANAGER')),
      });

      const succMsg = isDraft
        ? 'Review draft saved successfully.'
        : review.reviewType === 'PIP_WEEKLY'
        ? `Weekly PIP review completed for ${review.employeeName}!`
        : review.reviewType === 'PIP_FINAL'
        ? `Final PIP review submitted for ${review.employeeName}!`
        : openManagerReturn
        ? `Re-evaluated KRAs resubmitted for ${review.employeeName}.`
        : `Quarterly review submitted for ${review.employeeName}!`;
      setSuccessMessage(succMsg);
      if (isDraft) {
        toast.info(succMsg, 'Draft saved');
      } else {
        toast.success(succMsg, 'Review submitted');
      }
      setTimeout(() => {
        onSaved();
      }, 700);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save review scoring.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Submission error');
    } finally {
      setSaving(false);
    }
  };

  // Transition Review Status
  const handleStatusTransition = async (newStatus: ReviewStatus) => {
    setSaving(true);
    setErrorMessage('');
    try {
      if (canEdit && snapshots.length > 0) {
        await api.scoreReview(review.id, {
          kraSnapshot: snapshots,
          strengths,
          improvements,
          managerOverallComments: managerComments,
          employeeComments,
          hrComments,
          isDraft: true,
        });
      }

      const defaultRemarks =
        newStatus === 'CLOSED'
          ? 'Final review signed off, locked, and closed by HR'
          : newStatus === 'HR_COMPLETED'
          ? 'Review approved by HR Calibration'
          : `Transitioned review status to ${newStatus}`;

      await api.updateReviewStatus(review.id, {
        status: newStatus,
        remarks: statusModalRemarks || defaultRemarks,
      });

      setShowStatusModal(null);
      setStatusModalRemarks('');
      const succMsg =
        newStatus === 'CLOSED'
          ? 'Review successfully finalized, locked, and closed!'
          : newStatus === 'HR_COMPLETED'
          ? 'Review successfully approved by HR!'
          : `Review status updated to ${newStatus}`;
      setSuccessMessage(succMsg);
      toast.success(succMsg, 'Workflow updated');
      setTimeout(() => {
        onSaved();
      }, 600);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update review status.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Status update error');
    } finally {
      setSaving(false);
    }
  };

  // HOD saves or submits their own independent KRA-by-KRA scoring.
  // On submit, transitions: HOD_PENDING -> HR_PENDING (finalScore becomes the average of
  // the Manager's and HOD's own scores; the Manager's score/fields are never touched).
  const handleSaveHodScores = async (isDraft: boolean) => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (review?.employeeStatus === 'INACTIVE') {
      const msg = 'Cannot submit evaluation for an inactive/offboarded employee.';
      setErrorMessage(msg);
      toast.error(msg, 'Action restricted');
      setSaving(false);
      return;
    }

    if (!isDraft && guardUnaddressedReturn('HOD')) {
      setSaving(false);
      return;
    }

    if (!isDraft) {
      const unrated = snapshots.some((s) => !s.hodRating || s.hodRating === 0);
      if (unrated) {
        const msg = 'All KRA items must be assigned an HOD rating (1-5) before submitting to HR.';
        setErrorMessage(msg);
        toast.warning(msg, 'Incomplete ratings');
        setSaving(false);
        return;
      }

      const invalidHodJustification = snapshots.find(
        (s) => [1, 2, 5].includes(s.hodRating || 0) && (!s.hodJustification || s.hodJustification.trim().length < 15)
      );
      if (invalidHodJustification) {
        const targetId = invalidHodJustification.id || (invalidHodJustification as any).kraId || '';
        const msg = `KRA "${invalidHodJustification.kraName || invalidHodJustification.title}" is rated ${invalidHodJustification.hodRating}, which needs an HOD justification of at least 15 characters.`;
        setErrorMessage(msg);
        toast.warning(msg, 'Mandatory justification required');
        setSaving(false);
        setWizardStep(3);
        setTimeout(() => {
          const el = document.getElementById(`hod-kra-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
    }

    try {
      await api.hodApproveReview(review.id, {
        kraSnapshot: snapshots,
        hodOverallComments,
        isDraft,
        returnResponses: buildReturnResponses(snapshots.filter((k) => k.returnFlag?.target === 'HOD')),
      });
      const succMsg = isDraft
        ? 'HOD scoring draft saved successfully.'
        : `Independent HOD scoring submitted and forwarded to HR for ${review.employeeName}.`;
      setSuccessMessage(succMsg);
      if (isDraft) {
        toast.info(succMsg, 'Draft saved');
      } else {
        toast.success(succMsg, 'Review approved');
      }
      setTimeout(() => {
        onSaved();
      }, 600);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save HOD scoring.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Approval error');
    } finally {
      setSaving(false);
    }
  };

  // Sends the selected KRAs (or the full review) back. HOD -> Manager (MANAGER_PENDING);
  // HR -> Manager (RETURNED) or HR -> HOD (HOD_PENDING).
  const handleReturnConfirm = async (selection: ReturnSelection) => {
    const mode = returnModalMode;
    if (!mode) return;
    setSaving(true);
    setErrorMessage('');
    try {
      if (mode === 'HOD') {
        // Keep the HOD's own in-progress scoring before handing the review back.
        await api.hodApproveReview(review.id, { kraSnapshot: snapshots, hodOverallComments, isDraft: true });
        await api.hodReturnReview(review.id, {
          reason: selection.reason,
          kraIds: selection.kraIds,
          kraComments: selection.kraComments,
          reasonCodes: selection.reasonCodes,
        });
      } else {
        if (canEdit && snapshots.length > 0) {
          await api.scoreReview(review.id, {
            kraSnapshot: snapshots,
            strengths,
            improvements,
            managerOverallComments: managerComments,
            employeeComments,
            hrComments,
            isDraft: true,
          });
        }
        await api.updateReviewStatus(review.id, {
          status: 'RETURNED',
          remarks: selection.reason,
          target: selection.target,
          kraIds: selection.kraIds,
          hodKraIds: selection.hodKraIds,
          kraComments: selection.kraComments,
          reasonCodes: selection.reasonCodes,
        });
      }

      setReturnModalMode(null);
      setReturnPreselect(undefined);
      const recipient = selection.target === 'HOD' ? review.hodName || 'HOD' : review.managerName;
      const kraCount = (n: number) => `${n} KRA${n === 1 ? '' : 's'}`;
      const scope =
        selection.kraIds.length === snapshots.length ? 'Full review' : kraCount(selection.kraIds.length);
      const succMsg =
        selection.target === 'BOTH'
          ? `${kraCount(selection.kraIds.length)} returned to ${review.managerName}; ${kraCount(selection.hodKraIds?.length || 0)} will go to ${review.hodName || 'the HOD'} after that.`
          : `${scope} returned to ${recipient} for re-evaluation.`;
      setSuccessMessage(succMsg);
      toast.success(succMsg, 'Review returned');
      setTimeout(() => {
        onSaved();
      }, 600);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to return review.';
      setErrorMessage(errMsg);
      toast.error(errMsg, 'Return error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Derive which "returned" banner (if any) applies to the current state — status alone is
  // ambiguous for MANAGER_PENDING (fresh vs. HOD-returned) and HOD_PENDING (fresh vs.
  // HR-returned-to-HOD), so the last relevant action in the audit trail disambiguates.
  const openManagerReturn = getOpenReturn(review, 'MANAGER');
  const openHodReturn = getOpenReturn(review, 'HOD');
  const openReturn = openManagerReturn || openHodReturn;
  const returnCount = getReturnCount(review);
  const lastAction = [...(review.actionHistory || [])].reverse().find((a) => a.action !== 'DRAFT_SAVED');
  const returnBadge: { by: 'HOD' | 'HR'; recipient: string; message: string } | null =
    review.status === 'RETURNED'
      ? {
          by: 'HR',
          recipient: review.managerName,
          message: `This evaluation was sent back by HR for the Manager to adjust. Please check the feedback remarks in the Audit Trail, revise scoring on Step 2, and resubmit — it will go straight back to HR without another HOD pass.`,
        }
      : review.status === 'MANAGER_PENDING' && lastAction?.action === 'HOD_RETURNED'
      ? {
          by: 'HOD',
          recipient: review.managerName,
          message: `This evaluation was sent back by the HOD for the Manager to adjust. Please check the feedback remarks in the Audit Trail, revise scoring on Step 2, and resubmit — it will go back to the HOD as usual.`,
        }
      : review.status === 'HOD_PENDING' && lastAction?.action === 'RETURNED' && lastAction?.returnTarget === 'HOD'
      ? {
          by: 'HR',
          recipient: review.hodName || 'HOD',
          message: `This evaluation was sent back by HR for the HOD to recalibrate their own scoring. Once submitted, it will go straight back to HR without another Manager pass.`,
        }
      : null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl my-6 flex flex-col max-h-[92vh] overflow-clip text-slate-900 dark:text-white ${cardClass}`}>
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center space-x-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white"
              style={{ backgroundColor: review.cycleColor || '#1e3a8a' }}
            >
              {review.cycleCode}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{review.employeeName}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full tabular-nums font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {review.employeeCode}
                </span>
                <EmployeeStatusBadge status={review.employeeStatus} />
                {review.isAppraisalMonthDue && (
                  <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Appraisal Due (Cycle {review.cycleCode})</span>
                  </span>
                )}
                {review.reviewType === 'PIP_WEEKLY' && (
                  <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    <span>PIP Week {review.pipCycleNumber || 1} Review (2-Step Fast Flow)</span>
                  </span>
                )}
                {review.reviewType === 'PIP_FINAL' && (
                  <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-100 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
                    <span>PIP Final Evaluation</span>
                  </span>
                )}
                {review.isClosed && (
                  <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <Lock className="w-3 h-3" />
                    <span>Closed & locked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {review.designationName} • {review.departmentName} • Period: <span className="font-semibold text-slate-700 dark:text-slate-200">{review.reviewPeriodName}</span> • Manager: <span className="font-semibold text-slate-700 dark:text-slate-200">{review.managerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {review.isClosed && (
              <button
                onClick={() => setShowLetterModal(true)}
                title="View Quarterly Review Letter"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>View letter</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              title="Print Review Sheet"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleAttemptClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* INACTIVE EMPLOYEE SAFEGUARD BANNER */}
        {review.employeeStatus === 'INACTIVE' && (
          <div className="mx-6 mt-3 px-4 py-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Employment record inactive (offboarded / exited)</p>
              <p className="text-rose-700 dark:text-rose-300 text-[11px] mt-0.5">
                This employee has been marked inactive in the system. Performance review scoring and evaluation submission are disabled to safeguard evaluation integrity. Historical review records remain available for reference.
              </p>
            </div>
          </div>
        )}

        {/* REVIEW RETURNED BANNER */}
        {openReturn ? (
          (() => {
            const due = getReturnDueInfo(openReturn);
            const recipient = openReturn.target === 'HOD' ? review.hodName || 'HOD' : review.managerName;
            const target = openReturn.target;
            const pendingCount = target === 'MANAGER' ? unaddressedManagerKras.length : unaddressedHodKras.length;
            const doneCount = openReturn.kraIds.length - pendingCount;
            const queuedHodLeg = getQueuedHodLeg(review, openReturn);
            const nextStep = queuedHodLeg
              ? `it will then go to the HOD to re-evaluate ${queuedHodLeg.kraIds.length} KRA${queuedHodLeg.kraIds.length === 1 ? '' : 's'}, then back to HR.`
              : openReturn.returnedByRole === 'HOD'
                ? 'it will go back to the HOD, who will re-score only these KRAs.'
                : target === 'HOD'
                ? 'it will go straight back to HR.'
                : 'it will go straight back to HR without another HOD pass.';
            return (
              <div className="mx-6 mt-2 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-100 text-xs rounded-xl">
                {/* Compact one-line summary — keeps the KRA scoring area roomy */}
                <button
                  type="button"
                  onClick={() => setReturnBannerExpanded((v) => !v)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
                  <span className="font-bold truncate">
                    Returned by {openReturn.returnedByRole} ({openReturn.returnedByName}) ·{' '}
                    {openReturn.isFullReturn ? 'full review' : `${openReturn.kraIds.length} of ${snapshots.length} KRAs`} to re-evaluate
                    {queuedHodLeg && <span className="font-normal"> · then HOD ({queuedHodLeg.kraIds.length})</span>}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-800">
                      {doneCount}/{openReturn.kraIds.length} done
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                        due.overdue
                          ? 'bg-rose-600 text-white'
                          : due.soon
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {due.label}
                    </span>
                    {returnCount > 1 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                        Returned {returnCount}×
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                      {returnBannerExpanded ? 'Hide' : 'Details'}
                      {returnBannerExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                {returnBannerExpanded && (
                  <m.div
                    key="return-details"
                    variants={accordionVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="px-3 pb-2.5 pl-8 space-y-1.5 border-t border-amber-200/70 dark:border-amber-800/60 pt-2"
                  >
                    <p className="leading-relaxed">
                      <span className="font-semibold">Reason:</span> {openReturn.reason}
                    </p>
                    {!openReturn.isFullReturn && (
                      <div className="flex flex-wrap gap-1">
                        {openReturn.kraIds.map((id, i) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setWizardStep(target === 'MANAGER' ? 2 : 3);
                              setTimeout(() => scrollToKraCard(target === 'MANAGER' ? 'mgr' : 'hod', id), 100);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                          >
                            {openReturn.kraTitles[i] || id}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                      Returned on {new Date(openReturn.createdAt).toLocaleDateString()} to {recipient}. Only the returned KRAs are editable — update each one (or keep its
                      rating with a reason) and resubmit; {nextStep}
                    </p>
                  </m.div>
                )}
                </AnimatePresence>
              </div>
            );
          })()
        ) : returnBadge ? (
          <div className="mx-6 mt-3 px-4 py-3 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 text-xs rounded-xl flex items-start gap-3">
            <RotateCcw className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-xs">Returned by {returnBadge.by} — Awaiting {returnBadge.recipient}</span>
                <span className="text-[11px] bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md font-medium">
                  Needs revision
                </span>
              </div>
              <p className="text-rose-800 dark:text-rose-300 text-[11px] mt-0.5 leading-relaxed">
                {returnBadge.message}
              </p>
            </div>
          </div>
        ) : null}

        {/* ALERTS & ERROR MESSAGES */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEPPER WIZARD TABS */}
        <div className="px-6 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                wizardStep === 1
                  ? 'bg-white dark:bg-slate-750 text-indigo-950 dark:text-white font-bold border border-slate-200 dark:border-slate-700 ring-1 ring-black/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                wizardStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                1
              </span>
              <span>Employee input</span>
              {review.selfSubmittedAt ? (
                <span title="Self-Review Completed">
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </span>
              ) : (
                <span title="Self-Review Pending">
                  <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                </span>
              )}
            </button>

            <span className="text-slate-300 dark:text-slate-600">➔</span>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                wizardStep === 2
                  ? 'bg-white dark:bg-slate-750 text-indigo-950 dark:text-white font-bold border border-slate-200 dark:border-slate-700 ring-1 ring-black/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                wizardStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                2
              </span>
              <span>Manager scoring</span>
              <span className="text-[11px] tabular-nums font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded-md border border-indigo-200 dark:border-indigo-800">
                {computedScore.toFixed(2)}
              </span>
              {missingManagerJustifications > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <span>{missingManagerJustifications} justification{missingManagerJustifications > 1 ? 's' : ''} needed</span>
                </span>
              )}
            </button>

            {review.reviewType === 'PIP_WEEKLY' ? (
              <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                2-Step Fast Flow (Closes on manager submit)
              </span>
            ) : (
              <>
                <span className="text-slate-300 dark:text-slate-600">➔</span>

                {/* Step 3: HOD Scoring */}
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    wizardStep === 3
                      ? 'bg-white dark:bg-slate-750 text-indigo-950 dark:text-white font-bold border border-slate-200 dark:border-slate-700 ring-1 ring-black/5'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    wizardStep === 3 ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    3
                  </span>
                  <span>HOD scoring</span>
                  <span className="text-[11px] tabular-nums font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.2 rounded-md border border-violet-200 dark:border-violet-800">
                    {computedHodScore.toFixed(2)}
                  </span>
                  {missingHodJustifications > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-300 dark:border-violet-800 flex items-center gap-1">
                      <span>{missingHodJustifications} justification{missingHodJustifications > 1 ? 's' : ''} needed</span>
                    </span>
                  )}
                </button>

                <span className="text-slate-300 dark:text-slate-600">➔</span>

                {/* Step 4 */}
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    wizardStep === 4
                      ? 'bg-white dark:bg-slate-750 text-indigo-950 dark:text-white font-bold border border-slate-200 dark:border-slate-700 ring-1 ring-black/5'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    wizardStep === 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    4
                  </span>
                  <span>Final review</span>
                </button>
              </>
            )}
          </div>

          {/* Audit trail trigger */}
          <button
            type="button"
            onClick={() => setShowAuditModal(!showAuditModal)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showAuditModal
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Audit trail</span>
            <span className="tabular-nums text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">
              {review.actionHistory?.length || 0}
            </span>
          </button>
        </div>

        {/* LIVE SCORE BANNER */}
        {wizardStep === 2 && (
          <ScoreSummaryBar
            computedScore={computedScore}
            scoreTier={scoreTier}
            unratedCount={unratedCount}
          />
        )}
        {wizardStep === 3 && (
          <ScoreSummaryBar
            computedScore={computedHodScore}
            scoreTier={hodScoreTier}
            unratedCount={unratedHodCount}
          />
        )}
        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Enter-only slide: the new step mounts at once, so "Jump to KRA" scrolling still finds its card */}
          <m.div
            key={wizardStep}
            initial={{ opacity: 0, x: stepDirection * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
          {wizardStep === 1 && (
            <Step1SelfSection review={review} snapshots={snapshots} />
          )}

          {wizardStep === 2 && (
            <>
              <Step2ManagerSection
                snapshots={snapshots}
                canEdit={canEdit}
                onKraChange={handleKraChange}
                onReturnFlagChange={handleReturnFlagChange}
              />
              <ManagerFeedbackSection
                strengths={strengths}
                setStrengths={setStrengths}
                improvements={improvements}
                setImprovements={setImprovements}
                managerComments={managerComments}
                setManagerComments={setManagerComments}
                canEdit={canEdit}
                aiLoading={aiLoading}
                aiSuccessNote={aiSuccessNote}
                onAiDraftSummary={handleAiDraftSummary}
              />
            </>
          )}

          {wizardStep === 3 && (
            <Step3HodScoringSection
              snapshots={snapshots}
              canHodScore={canHodAct}
              onKraChange={handleKraChange}
              hodOverallComments={hodOverallComments}
              setHodOverallComments={setHodOverallComments}
              onReturnFlagChange={handleReturnFlagChange}
            />
          )}

          {wizardStep === 4 && (
            <Step4FinalReviewSection
              review={review}
              snapshots={snapshots}
              managerScore={computedScore}
              hodScore={computedHodScore}
              strengths={strengths}
              improvements={improvements}
              managerComments={managerComments}
              hrComments={hrComments}
              setHrComments={setHrComments}
              isHrOrAdmin={isHrOrAdmin}
              saving={saving}
              onOpenStatusModal={(status) => setShowStatusModal(status)}
              onReturnSelected={(kraIds) => {
                setReturnPreselect(kraIds);
                setReturnModalMode('HR');
              }}
            />
          )}
          </m.div>
        </div>

        {/* Sticky Inline In-Modal Warning Banner pinned right above the footer */}
        {(errorMessage ||
          (wizardStep === 2 && canEdit && missingManagerJustifications > 0) ||
          (wizardStep === 3 && canHodAct && missingHodJustifications > 0)) && (
          <div
            className={`px-6 py-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 shrink-0 ${
              errorMessage
                ? 'bg-rose-50 dark:bg-rose-950/95 border-rose-200 dark:border-rose-900/80 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/95 border-amber-200 dark:border-amber-900/80 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  errorMessage ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              />
              <span className="font-semibold">
                {errorMessage ||
                  (wizardStep === 2
                    ? `${missingManagerJustifications} KRA${
                        missingManagerJustifications > 1 ? 's' : ''
                      } rated 1, 2 or 5 need a justification of at least 15 characters before you submit.`
                    : `${missingHodJustifications} KRA${
                        missingHodJustifications > 1 ? 's' : ''
                      } rated 1, 2 or 5 need an HOD justification of at least 15 characters before you submit.`)}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {wizardStep === 2 && firstInvalidManagerKra && (
                <button
                  type="button"
                  onClick={() =>
                    scrollToKraCard(
                      'mgr',
                      firstInvalidManagerKra.id || (firstInvalidManagerKra as any).kraId || ''
                    )
                  }
                  className={`text-xs font-bold underline cursor-pointer shrink-0 ${
                    errorMessage
                      ? 'text-rose-700 hover:text-rose-900 dark:text-rose-300'
                      : 'text-amber-800 hover:text-amber-950 dark:text-amber-300'
                  }`}
                >
                  Jump to KRA →
                </button>
              )}
              {wizardStep === 3 && firstInvalidHodKra && (
                <button
                  type="button"
                  onClick={() =>
                    scrollToKraCard(
                      'hod',
                      firstInvalidHodKra.id || (firstInvalidHodKra as any).kraId || ''
                    )
                  }
                  className={`text-xs font-bold underline cursor-pointer shrink-0 ${
                    errorMessage
                      ? 'text-rose-700 hover:text-rose-900 dark:text-rose-300'
                      : 'text-amber-800 hover:text-amber-950 dark:text-amber-300'
                  }`}
                >
                  Jump to KRA →
                </button>
              )}
              {errorMessage && (
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  aria-label="Dismiss this message"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-950/60 text-xs font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODAL FOOTER WITH GUIDED STEPPER NAVIGATION */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          {/* Status Transitions for HR / Admin */}
          <div className="flex items-center space-x-2">
            {isHrOrAdmin && !review.isClosed && review.status === 'HR_PENDING' && (
              <button
                type="button"
                onClick={() => setReturnModalMode('HR')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center space-x-1 cursor-pointer"
                title="Return review to the Manager or HOD for recalibration"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return for recalibration</span>
              </button>
            )}
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {wizardStep > 1 && (
              <button
                type="button"
                onClick={() => setWizardStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {wizardStep === 3 && canHodAct ? (
              review.employeeStatus === 'INACTIVE' ? (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
                  Can't submit: the employee is inactive
                </div>
              ) : (
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveHodScores(true)}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setReturnModalMode('HOD')}
                    className="px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Return to manager</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveHodScores(false)}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>
                      {openHodReturn
                        ? `Resubmit to HR (${openHodReturn.kraIds.length - unaddressedHodKras.length}/${openHodReturn.kraIds.length})`
                        : 'Submit to HR'}
                    </span>
                  </button>
                </div>
              )
            ) : wizardStep === 2 && managerCanSubmit ? (
              review.employeeStatus === 'INACTIVE' ? (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
                  Can't submit: the employee is inactive
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveScores(true)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveScores(false)}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>
                      {openManagerReturn
                        ? `Resubmit (${openManagerReturn.kraIds.length - unaddressedManagerKras.length}/${openManagerReturn.kraIds.length} addressed)`
                        : review.reviewType === 'PIP_WEEKLY'
                        ? 'Submit & Complete Weekly Check-in'
                        : 'Submit Evaluation'}
                    </span>
                  </button>
                </>
              )
            ) : wizardStep === 4 && isHrOrAdmin && canEdit ? (
              review.employeeStatus === 'INACTIVE' ? (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
                  Can't submit: the employee is inactive
                </div>
              ) : (
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveScores(true)}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save draft</span>
                  </button>

                  {review.status !== 'HR_COMPLETED' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setShowStatusModal('HR_COMPLETED')}
                      className="px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>Approve (HR)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowStatusModal('CLOSED')}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>Final lock & close</span>
                  </button>
                </div>
              )
            ) : wizardStep < 4 ? (
              <button
                type="button"
                onClick={() => setWizardStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Continue to Step {wizardStep + 1}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* STATUS REMARKS MODAL OVERLAY */}
        <StatusRemarksModal
          isOpen={!!showStatusModal}
          status={showStatusModal}
          review={review}
          remarks={statusModalRemarks}
          setRemarks={setStatusModalRemarks}
          onClose={() => setShowStatusModal(null)}
          onConfirm={(st) => handleStatusTransition(st)}
          saving={saving}
        />

        {/* KRA-LEVEL RETURN DIALOG (HOD -> Manager, HR -> Manager/HOD) */}
        <ReturnReviewModal
          isOpen={!!returnModalMode}
          review={review}
          snapshots={snapshots}
          mode={returnModalMode || 'HR'}
          isPrivileged={isHrOrAdmin}
          saving={saving}
          onClose={() => {
            setReturnModalMode(null);
            setReturnPreselect(undefined);
          }}
          onConfirm={handleReturnConfirm}
          initialKraIds={returnModalMode === 'HR' ? returnPreselect : undefined}
        />

        {/* AUDIT TRAIL DRAWER OVERLAY */}
        <AuditTrailDrawer
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          review={review}
        />

        {/* QUARTERLY REVIEW LETTER OVERLAY */}
        {review.isClosed && (
          <ReviewLetterModal
            isOpen={showLetterModal}
            onClose={() => setShowLetterModal(false)}
            review={review}
          />
        )}

        {/* UNSAVED CHANGES CONFIRMATION ALERT */}
        {showUnsavedAlert && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 modal-backdrop-enter"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-slate-900 dark:text-white modal-card-enter">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Unsaved review progress
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    You have unsaved changes in this evaluation. If you exit now without saving, your entered scores and feedback will be lost.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUnsavedAlert(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedAlert(false);
                    handleClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-colors cursor-pointer"
                >
                  Discard & exit
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setShowUnsavedAlert(false);
                    if (canHodAct) {
                      await handleSaveHodScores(true);
                    } else {
                      await handleSaveScores(true);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save draft & exit</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
