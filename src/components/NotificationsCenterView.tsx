import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Building2,
  Award,
  DollarSign,
  FileText,
  Search,
  CheckCheck,
  RefreshCw,
  Filter,
  Trash2,
  Mail,
  Send,
  ExternalLink,
  Sparkles,
  X,
  RotateCcw,
} from 'lucide-react';
import { Notification, User } from '../types';
import { api } from '../services/api';
import { PageSkeletonLoader } from './ui/PageSkeletonLoader';
import { EmptyState } from './ui/EmptyState';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { PageHeader } from './ui/PageHeader';

interface NotificationsCenterViewProps {
  currentUser: User | null;
  onNavigate: (tab: string, options?: any) => void;
}

type MainTab = 'all' | 'unread' | 'reviews' | 'appraisals' | 'emails';

export const NotificationsCenterView: React.FC<NotificationsCenterViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // Email Logs State (for Admins / HR)
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(currentUser?.email || '');
  const [testEmailName, setTestEmailName] = useState(currentUser?.name || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  const isAdminOrHr = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR' || currentUser?.role === 'MANAGEMENT';

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailLogs = async () => {
    if (!isAdminOrHr) return;
    setLoadingEmails(true);
    try {
      const res = await api.getEmailLogs(50);
      setEmailLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (isAdminOrHr) {
      fetchEmailLogs();
    }
  }, [currentUser]);

  // Keep this page's own list in sync in real time: new notifications can arrive from
  // background jobs (reminders, escalations, etc.) with no local action to trigger a refresh,
  // so on top of the 'notifications-updated' event fired by this tab's own mutations, poll
  // periodically while the page is visible — otherwise the header bell (which has its own
  // poller) drifts ahead of whatever this page fetched once on mount.
  useEffect(() => {
    const POLL_INTERVAL_MS = 15000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleNotificationsUpdated = () => fetchNotifications();
    window.addEventListener('notifications-updated', handleNotificationsUpdated);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('notifications-updated', handleNotificationsUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id || (n as any)._id === id ? { ...n, isRead: true } : n))
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Pending Deletion with 3s Undo State
  interface PendingDeletion {
    notification: Notification;
    index: number;
    timeoutId: ReturnType<typeof setTimeout>;
    intervalId: ReturnType<typeof setInterval>;
    secondsRemaining: number;
  }

  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const pendingRef = useRef<PendingDeletion | null>(null);
  pendingRef.current = pendingDeletion;

  const isDeletingRef = useRef(false);
  const isUndoingRef = useRef(false);

  // Cleanup on unmount - commit any pending deletion
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timeoutId);
        clearInterval(pendingRef.current.intervalId);
        api.deleteNotification(pendingRef.current.notification.id).catch(console.error);
      }
    };
  }, []);

  const handleRemoveNotification = (id: string, e?: React.SyntheticEvent | MouseEvent) => {
    if (e) e.stopPropagation();

    // Prevent rapid double-tap from wiping out pending deletion
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    setTimeout(() => {
      isDeletingRef.current = false;
    }, 400);

    // If there is an existing pending deletion, commit it immediately before starting a new one
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timeoutId);
      clearInterval(pendingRef.current.intervalId);
      api.deleteNotification(pendingRef.current.notification.id).catch(console.error);
    }

    const notifIndex = notifications.findIndex((n) => n.id === id);
    const targetNotif = notifications[notifIndex];
    if (!targetNotif) return;

    // Optimistically remove from visible list
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    // Start 3-second countdown
    let secondsLeft = 3;

    const intervalId = setInterval(() => {
      secondsLeft -= 1;
      setPendingDeletion((prev) => {
        if (!prev) return null;
        return { ...prev, secondsRemaining: Math.max(0, secondsLeft) };
      });
    }, 1000);

    const timeoutId = setTimeout(async () => {
      clearInterval(intervalId);
      try {
        await api.deleteNotification(targetNotif.id);
      } catch (err) {
        console.error('Failed to commit deletion on server:', err);
      }
      setPendingDeletion(null);
    }, 3000);

    setPendingDeletion({
      notification: targetNotif,
      index: notifIndex,
      timeoutId,
      intervalId,
      secondsRemaining: 3,
    });
  };

  const handleUndoDelete = (e?: React.SyntheticEvent | MouseEvent | TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (isUndoingRef.current) return;
    isUndoingRef.current = true;
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 400);

    const currentPending = pendingRef.current || pendingDeletion;
    if (!currentPending) return;

    // Clear timers immediately
    clearTimeout(currentPending.timeoutId);
    clearInterval(currentPending.intervalId);

    // Restore notification back into list at its previous position
    const restored = currentPending.notification;
    const originalIdx = currentPending.index;

    setNotifications((prev) => {
      // Avoid duplicate restoration if tapped multiple times
      if (prev.some((n) => n.id === restored.id)) return prev;
      const next = [...prev];
      if (originalIdx >= 0 && originalIdx <= next.length) {
        next.splice(originalIdx, 0, restored);
      } else {
        next.unshift(restored);
      }
      return next;
    });

    pendingRef.current = null;
    setPendingDeletion(null);
  };

  const handleDismissUndoToast = (e?: React.SyntheticEvent | MouseEvent | TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const currentPending = pendingRef.current || pendingDeletion;
    if (!currentPending) return;

    // Commit deletion immediately without waiting for remainder of 3s
    clearTimeout(currentPending.timeoutId);
    clearInterval(currentPending.intervalId);
    api.deleteNotification(currentPending.notification.id).catch(console.error);
    pendingRef.current = null;
    setPendingDeletion(null);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendTestEmail(testEmailAddress, testEmailName);
      setTestEmailResult(res.message || 'Test email dispatched successfully.');
      fetchEmailLogs();
    } catch (err: any) {
      setTestEmailResult(`Error: ${err.message || 'Failed to dispatch test email.'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Workflow Target Resolver
  const getWorkflowTarget = (notif: Notification) => {
    const meta = notif.metadata || {};
    switch (notif.type) {
      case 'BUDGET_ALERT':
        return {
          tab: 'calibration',
          label: 'Department Budget Pool Tracking',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
          config: { cycleId: meta.cycleId || 'cycle_f', ...meta },
        };
      case 'CALIBRATION_WARNING':
        return {
          tab: 'calibration',
          label: 'Bell Curve Normalization',
          badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
          config: { departmentId: meta.departmentId || 'dept_sales', ...meta },
        };
      case 'HOD_ACTION_REQUIRED':
        return {
          tab: 'appraisals',
          label: 'HOD Department Calibration',
          badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
          config: { activeSection: 'appraisals', openDetail: true, ...meta },
        };
      case 'LETTER_RELEASED':
        if (currentUser?.role === 'EMPLOYEE') {
          return {
            tab: 'dashboard',
            label: 'Employee Appraisal Letter',
            badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800',
            config: { openLetter: true, ...meta },
          };
        }
        return {
          tab: 'appraisals',
          label: 'Appraisal Letters Release',
          badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800',
          config: { activeSection: 'appraisals', openDetail: true, ...meta, ...(meta.appraisalId ? { status: 'ALL' } : { status: 'HR_APPROVED' }) },
        };
      case 'APPRAISAL_DUE':
        return {
          tab: currentUser?.role === 'EMPLOYEE' ? 'dashboard' : 'appraisals',
          label: 'Annual Appraisal Rollup',
          badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800',
          config: { openLetter: true, ...meta },
        };
      case 'REVIEW_ASSIGNED':
      case 'DUE_SOON':
      case 'OVERDUE':
        return {
          tab: 'reviews',
          label: 'Quarterly Review & Scoring',
          badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800',
          config: { ...meta, ...(meta.reviewId ? { status: 'ALL' } : {}) },
        };
      case 'MANAGER_SUBMITTED':
      case 'RETURNED':
      case 'HR_COMPLETED':
        return {
          tab: 'reviews',
          label: 'Quarterly Review Action',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
          config: { ...meta, ...(meta.reviewId ? { status: 'ALL' } : {}) },
        };
      case 'HOD_PENDING':
        return {
          tab: 'reviews',
          label: 'HOD Review Pending',
          badgeColor: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800',
          config: { subTab: 'reviews', ...meta, ...(meta.reviewId ? { status: 'ALL' } : { status: 'HOD_PENDING' }) },
        };
      case 'HOD_APPROVED':
        return {
          tab: 'reviews',
          label: 'HOD Approved — HR Review',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
          config: { subTab: 'reviews', ...meta, ...(meta.reviewId ? { status: 'ALL' } : {}) },
        };
      case 'HOD_MISSING_EXCEPTION':
        return {
          tab: 'reviews',
          label: 'Review Blocked: No HOD Configured',
          badgeColor: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800',
          config: { subTab: 'reviews', ...meta, ...(meta.reviewId ? { status: 'ALL' } : { status: 'HOD_PENDING' }) },
        };
      case 'PIP_ASSIGNED':
      case 'PIP_CHECKIN':
      case 'PIP_ACKNOWLEDGED':
      case 'PIP_SUCCEEDED':
      case 'PIP_FAILED':
      case 'PIP_EXTENDED':
        return {
          tab: 'pip',
          label: 'Performance Improvement Plan',
          badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
          config: { pipId: meta.pipId },
        };
      default:
        return {
          tab: 'dashboard',
          label: 'Dashboard',
          badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          config: {},
        };
    }
  };

  const handleOpenWorkflow = (notif: Notification) => {
    const target = getWorkflowTarget(notif);
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    onNavigate(target.tab, target.config);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'HOD_ACTION_REQUIRED':
        return <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'HOD_PENDING':
      case 'HOD_APPROVED':
        return <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />;
      case 'HOD_MISSING_EXCEPTION':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'BUDGET_ALERT':
        return <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'CALIBRATION_WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'APPRAISAL_DUE':
        return <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'LETTER_ACKNOWLEDGED':
      case 'LETTER_RELEASED':
        return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;
    const urgent = notifications.filter((n) => n.priority === 'HIGH').length;
    const reviews = notifications.filter((n) =>
      ['REVIEW_ASSIGNED', 'DUE_SOON', 'OVERDUE', 'MANAGER_SUBMITTED', 'RETURNED', 'HR_COMPLETED', 'HOD_PENDING', 'HOD_APPROVED', 'HOD_MISSING_EXCEPTION'].includes(n.type)
    ).length;
    const appraisals = notifications.filter((n) =>
      ['BUDGET_ALERT', 'CALIBRATION_WARNING', 'HOD_ACTION_REQUIRED', 'APPRAISAL_DUE', 'LETTER_RELEASED', 'LETTER_ACKNOWLEDGED'].includes(n.type)
    ).length;

    return { total, unread, urgent, reviews, appraisals };
  }, [notifications]);

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Tab filter
      if (activeTab === 'unread' && (notif.isRead === true || String(notif.isRead) === 'true')) return false;
      if (activeTab === 'reviews') {
        const reviewTypes = ['REVIEW_ASSIGNED', 'DUE_SOON', 'OVERDUE', 'MANAGER_SUBMITTED', 'RETURNED', 'HR_COMPLETED', 'HOD_PENDING', 'HOD_APPROVED', 'HOD_MISSING_EXCEPTION'];
        if (!reviewTypes.includes(notif.type)) return false;
      }
      if (activeTab === 'appraisals') {
        const appraisalTypes = ['BUDGET_ALERT', 'CALIBRATION_WARNING', 'HOD_ACTION_REQUIRED', 'APPRAISAL_DUE', 'LETTER_RELEASED', 'LETTER_ACKNOWLEDGED'];
        if (!appraisalTypes.includes(notif.type)) return false;
      }

      // Priority dropdown filter
      if (priorityFilter !== 'ALL' && notif.priority !== priorityFilter) return false;

      // Keyword Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = notif.title.toLowerCase().includes(q);
        const matchesMsg = notif.message.toLowerCase().includes(q);
        const matchesType = notif.type.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg && !matchesType) return false;
      }

      return true;
    });
  }, [notifications, activeTab, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Tasks waiting for you, updates on reviews and appraisals, and the emails MintReview has sent."
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total alerts</span>
            <Bell className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <span className="text-[11px] text-slate-400 mt-1">Active stream items</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
            <span className="text-xs font-semibold">Unread</span>
            <Sparkles className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.unread}</div>
          <span className="text-[11px] text-slate-400 mt-1">Requires your attention</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold">Urgent action</span>
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.urgent}</div>
          <span className="text-[11px] text-slate-400 mt-1">High priority tasks</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
            <span className="text-xs font-semibold">Reviews</span>
            <Award className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.reviews}</div>
          <span className="text-[11px] text-slate-400 mt-1">Quarterly evaluations</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold">Appraisals</span>
            <DollarSign className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.appraisals}</div>
          <span className="text-[11px] text-slate-400 mt-1">Compensation & letters</span>
        </div>
      </div>

      {/* Main Workspace Tabs & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-50/60 dark:bg-slate-950/40">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>All alerts</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {stats.total}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('unread')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'unread'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Unread</span>
              {stats.unread > 0 && (
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'unread' ? 'bg-rose-500 text-white' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'}`}>
                  {stats.unread}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'reviews'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Reviews</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'reviews' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {stats.reviews}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('appraisals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'appraisals'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Appraisals</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'appraisals' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {stats.appraisals}
              </span>
            </button>

            {isAdminOrHr && (
              <button
                onClick={() => setActiveTab('emails')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'emails'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email audit logs</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'emails' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {emailLogs.length}
                </span>
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
            {stats.unread > 0 && activeTab !== 'emails' && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-bold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100/80 rounded-xl border border-indigo-200/80 dark:border-indigo-800 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}

            {isAdminOrHr && (
              <button
                onClick={() => setIsTestEmailModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Test email dispatch</span>
              </button>
            )}

            <button
              onClick={() => {
                fetchNotifications();
                if (isAdminOrHr) fetchEmailLogs();
              }}
              disabled={loading || loadingEmails}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Refresh Stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingEmails ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub Toolbar: Search & Filters (Shown for notifications tabs) */}
        {activeTab !== 'emails' && (
          <div className="p-3 sm:px-5 py-3 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts by title, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Priority:
              </span>
              <select
                value={priorityFilter}
                onChange={(e: any) => setPriorityFilter(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All priorities</option>
                <option value="HIGH">Action required (high)</option>
                <option value="MEDIUM">Alerts (medium)</option>
                <option value="LOW">Information (low)</option>
              </select>
            </div>
          </div>
        )}

        {/* Content Body */}
        {activeTab === 'emails' ? (
          /* Email Audit Logs View */
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Database email transmission logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Audit trail of all transactional emails dispatched via SMTP / ethereal email
                </p>
              </div>
              <span className="text-xs tabular-nums px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200/80 dark:border-indigo-800">
                {emailLogs.length} Records Logged
              </span>
            </div>

            {loadingEmails ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs">Loading email delivery audit logs from database...</p>
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No email logs recorded yet</h4>
                <p className="text-xs text-slate-400">Dispatch a test email using the button above to test the SMTP relay.</p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-bold">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Subject & type</th>
                      <th className="px-4 py-3">Date & time</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {emailLogs.map((log: any) => (
                      <tr key={log.id || log._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 shrink-0">
                          {log.status === 'SENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              SENT
                            </span>
                          ) : log.status === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              FAILED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {log.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <div>{log.recipientName || 'Employee'}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">{log.recipientEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{log.subject}</div>
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">{log.templateType}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.previewUrl && (
                            <a
                              href={log.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              <span>Preview</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Notifications Feed View */
          <div className="p-4 sm:p-6 space-y-3">
            {loading && notifications.length === 0 ? (
              <PageSkeletonLoader variant="generic" />
            ) : filteredNotifications.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                tone="success"
                title="No alerts found"
                description={
                  searchQuery
                    ? `No notifications found matching "${searchQuery}".`
                    : activeTab !== 'all'
                    ? `You have zero items in the "${activeTab}" view.`
                    : 'All caught up! There are currently no pending workflow tasks for your account.'
                }
                secondaryAction={searchQuery ? { label: 'Clear search filter', onClick: () => setSearchQuery('') } : undefined}
              />
            ) : (
              filteredNotifications.map((notif, idx) => {
              const target = getWorkflowTarget(notif);
              return (
                <div
                  key={`${notif.id || (notif as any)._id || 'notif'}_${idx}`}
                    className={`p-4 sm:p-5 rounded-xl transition-all border ${
                      notif.isRead
                        ? 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        : 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-900/60 text-slate-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      {/* Main Notification Details */}
                      <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                        <div className="relative shrink-0 mt-0.5">
                          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {getIconForType(notif.type)}
                          </div>
                          {!notif.isRead && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full ring-2 ring-white dark:ring-slate-900" />
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight break-words">
                              {notif.title}
                            </h4>
                            {notif.priority === 'HIGH' && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                                Action required
                              </span>
                            )}
                            {notif.priority === 'MEDIUM' && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                Alert
                              </span>
                            )}
                            {!notif.isRead && (
                              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                • NEW
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl break-words">
                            {notif.message}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            <span className="flex items-center gap-1 tabular-nums shrink-0">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(notif.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              at{' '}
                              {new Date(notif.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                            <span className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-full">
                              Target: <strong className="text-slate-700 dark:text-slate-300">{target.label}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Responsive row on mobile with divider, top-right row on desktop */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 shrink-0 w-full sm:w-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!notif.isRead && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer transition-colors"
                              title="Mark as read"
                            >
                              Mark read
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenWorkflow(notif)}
                            className="inline-flex items-center gap-1 text-xs text-white font-bold px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all shrink-0 cursor-pointer"
                          >
                            <span>Take action</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          onClick={(e) => handleRemoveNotification(notif.id, e)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200/60 dark:border-rose-800/60 transition-colors cursor-pointer shrink-0"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Test Email Dispatch Modal */}
      <TestEmailModal
        isOpen={isTestEmailModalOpen}
        onClose={() => setIsTestEmailModalOpen(false)}
        testEmailName={testEmailName}
        setTestEmailName={setTestEmailName}
        testEmailAddress={testEmailAddress}
        setTestEmailAddress={setTestEmailAddress}
        testEmailResult={testEmailResult}
        isSendingTest={isSendingTest}
        handleSendTestEmail={handleSendTestEmail}
      />

      {/* Floating 3-Second Undo Notification Snackbar */}
      {pendingDeletion && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-auto"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '12px',
            right: '12px',
            maxWidth: '460px',
            marginLeft: 'auto',
            marginRight: 'auto',
            zIndex: 9999999,
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-700/80 backdrop-blur-md flex items-center justify-between gap-3 ring-2 ring-indigo-500/40">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Trash2 className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />

              <div className="flex flex-col min-w-0 flex-1 pr-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    Notification removed
                  </span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-bold bg-slate-800 text-indigo-400 border border-slate-700 shrink-0">
                    {pendingDeletion.secondsRemaining}s
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate">
                  "{pendingDeletion.notification.title}"
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleUndoDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer transform touch-manipulation select-none"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleDismissUndoToast}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer touch-manipulation"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  testEmailName: string;
  setTestEmailName: (val: string) => void;
  testEmailAddress: string;
  setTestEmailAddress: (val: string) => void;
  testEmailResult: string | null;
  isSendingTest: boolean;
  handleSendTestEmail: (e: React.FormEvent) => Promise<void>;
}

const TestEmailModal: React.FC<TestEmailModalProps> = ({
  isOpen,
  onClose,
  testEmailName,
  setTestEmailName,
  testEmailAddress,
  setTestEmailAddress,
  testEmailResult,
  isSendingTest,
  handleSendTestEmail,
}) => {
  const { isMounted, handleClose, backdropClass, cardClass } = useModalAnimation({
    isOpen,
    onClose,
  });

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 ${cardClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Send className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Send SMTP verification email</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Triggers a test email through nodemailer. If no custom SMTP credentials exist in .env, it outputs an ethereal sandbox link.
        </p>

        <form onSubmit={handleSendTestEmail} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient name
            </label>
            <input
              type="text"
              value={testEmailName}
              onChange={(e) => setTestEmailName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient email
            </label>
            <input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {testEmailResult && (
            <div className={`p-3 rounded-xl text-xs ${testEmailResult.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {testEmailResult}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSendingTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
            >
              {isSendingTest && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSendingTest ? 'Sending...' : 'Dispatch Email'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
