import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from './ToastContext';

interface NotificationsContextType {
  /** Count of unread notifications visible to the current user — kept fresh by a single shared poller. */
  unreadCount: number;
  /** Force an immediate refresh (e.g. after an action outside the normal mutation helpers). */
  refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Single source of truth for "how often do we check for new notifications" — every consumer
// (header badge, any future widget) reads from this one poller instead of running its own.
const POLL_INTERVAL_MS = 8000;

/**
 * Owns the app-wide unread-notification badge count: one lightweight poll instead of every
 * component that needs the count running its own independent fetch loop. Polling pauses
 * while the tab is hidden and catches up immediately on refocus. Mutating actions
 * (mark read/unread, delete, mark all read) already dispatch a `notifications-updated`
 * DOM event from services/api.ts — this provider listens for it to refresh instantly instead
 * of waiting for the next poll tick.
 */
export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks which HIGH-priority unread notification IDs we've already surfaced this session.
  // null means "not yet seeded" — the first successful poll after (re)login populates it with
  // whatever's already unread so we never toast-escalate a backlog right after signing in;
  // only items that newly appear *during* the session trigger the real-time toast below.
  const seenHighPriorityIdsRef = useRef<Set<string> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await api.getUnreadNotificationCount();
      setUnreadCount(count);

      if (count > 0) {
        const list = await api.getNotifications();
        const highPriorityUnread = list.filter((n: any) => n.priority === 'HIGH' && !n.isRead);
        if (seenHighPriorityIdsRef.current === null) {
          seenHighPriorityIdsRef.current = new Set(highPriorityUnread.map((n: any) => n.id));
        } else {
          for (const n of highPriorityUnread) {
            if (!seenHighPriorityIdsRef.current.has(n.id)) {
              seenHighPriorityIdsRef.current.add(n.id);
              toast.warning(n.message, n.title, 7000);
            }
          }
        }
      }
    } catch {
      // Quiet fallback — keep the last known count rather than flashing to 0 on a transient error.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      seenHighPriorityIdsRef.current = null;
      return;
    }

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    };

    refreshUnreadCount();
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleNotificationsUpdated = () => refreshUnreadCount();
    window.addEventListener('notifications-updated', handleNotificationsUpdated);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('notifications-updated', handleNotificationsUpdated);
    };
  }, [isAuthenticated, refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
};
