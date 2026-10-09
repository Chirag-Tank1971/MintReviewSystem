import React, { createContext, useState, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Must match the CSS animation-duration of .animate-toast-out in index.css — the toast is
// only actually removed from state once its slide-out animation has finished playing.
const EXIT_ANIMATION_MS = 200;

// Standalone global dispatcher so toasts can be triggered even outside React component trees
let globalToastDispatcher: ToastContextType | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    globalToastDispatcher?.success(message, title, duration),
  error: (message: string, title?: string, duration?: number) =>
    globalToastDispatcher?.error(message, title, duration),
  warning: (message: string, title?: string, duration?: number) =>
    globalToastDispatcher?.warning(message, title, duration),
  info: (message: string, title?: string, duration?: number) =>
    globalToastDispatcher?.info(message, title, duration),
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Toasts currently mid slide-out — still rendered (so the exit animation can play) but
  // no longer "live" (their auto-dismiss timer has already fired or been cancelled).
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const exitTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }

    // Already leaving (e.g. close button double-clicked) — don't restart the exit animation.
    if (exitTimersRef.current.has(id)) return;

    setLeavingIds((prev) => new Set(prev).add(id));
    const exitTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setLeavingIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      exitTimersRef.current.delete(id);
    }, EXIT_ANIMATION_MS);
    exitTimersRef.current.set(id, exitTimer);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration?: number) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timeoutDuration = duration ?? (type === 'error' ? 5000 : 4000);

      const newToast: ToastItem = {
        id,
        type,
        message,
        title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Notice' : 'Information'),
        duration: timeoutDuration,
      };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep up to 5 concurrent toasts

      if (timeoutDuration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, timeoutDuration);
        timersRef.current.set(id, timer);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string, dur?: number) => showToast('success', msg, title, dur), [showToast]);
  const error = useCallback((msg: string, title?: string, dur?: number) => showToast('error', msg, title, dur), [showToast]);
  const warning = useCallback((msg: string, title?: string, dur?: number) => showToast('warning', msg, title, dur), [showToast]);
  const info = useCallback((msg: string, title?: string, dur?: number) => showToast('info', msg, title, dur), [showToast]);

  // Register singleton dispatcher
  globalToastDispatcher = {
    showToast,
    success,
    error,
    warning,
    info,
    removeToast,
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-emerald-500 border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95';
      case 'error':
        return 'border-l-4 border-l-rose-500 border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95';
      case 'warning':
        return 'border-l-4 border-l-amber-500 border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95';
      case 'info':
      default:
        return 'border-l-4 border-l-indigo-500 border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div
        aria-live="assertive"
        className="fixed top-3 inset-x-3 sm:top-5 sm:right-5 sm:left-auto sm:inset-x-auto z-[99999] flex flex-col gap-2 sm:gap-2.5 sm:max-w-sm sm:w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto border rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3 backdrop-blur-md ${
              leavingIds.has(t.id) ? 'animate-toast-out' : 'animate-toast-in'
            } ${getBorderColor(t.type)}`}
          >
            {getIcon(t.type)}
            <div className="flex-1 min-w-0 pr-1">
              {t.title && (
                <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  {t.title}
                </div>
              )}
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 break-words leading-relaxed">
                {t.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
