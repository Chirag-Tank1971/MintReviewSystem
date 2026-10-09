import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { Eye, EyeOff, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';

import { AppLogo } from './ui/AppLogo';
import { INPUT_CLASS, LABEL_CLASS } from './ui/formStyles';

interface QuickRole {
  role: UserRole;
  title: string;
  shortLabel: string;
  email: string;
  name: string;
}

const QUICK_ROLES: QuickRole[] = [
  { role: 'SUPER_ADMIN', title: 'Super Admin', shortLabel: 'Admin', email: 'admin@company.com', name: 'System Admin' },
  { role: 'HR', title: 'HR Manager', shortLabel: 'HR', email: 'frank.mgr@company.com', name: 'Frank HR' },
  { role: 'MANAGER', title: 'Reporting Manager', shortLabel: 'Manager', email: 'dave.mgr@company.com', name: 'Dave Eng Manager' },
  { role: 'HOD', title: 'Head of Department', shortLabel: 'HOD', email: 'nikhilesh.hod@company.com', name: 'Nikhilesh Srivastava' },
  { role: 'MANAGEMENT', title: 'Executive Management', shortLabel: 'Executive', email: 'executive@company.com', name: 'Executive Management' },
  { role: 'EMPLOYEE', title: 'Employee', shortLabel: 'Employee', email: 'grace@company.com', name: 'Grace Engineer' },
];

/** The stages a quarterly review moves through, in order. */
const REVIEW_PATH = ['Self-assessment', 'Manager', 'HOD', 'HR approval'];

const SAMPLE_SCALE = ['Needs improvement', 'Developing', 'Meets', 'Exceeds', 'Outstanding'];
const SAMPLE_RATING = 3;
const SAMPLE_SELF_RATING = 4;

/**
 * Illustration for the brand panel: one KRA scored on the app's real 1–5 scale. It is
 * decorative (aria-hidden) and labelled as an example, never presented as live data.
 */
const ExampleKraCard: React.FC = () => (
  <div aria-hidden="true" className="rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3.5 xl:p-4 shadow-xl shadow-black/20">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Example KRA</div>
        <div className="mt-0.5 text-xs xl:text-sm font-semibold truncate">Customer onboarding within SLA</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs xl:text-sm font-semibold tabular-nums">+0.90 pts</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">30% weight</div>
      </div>
    </div>

    <div className="mt-2.5 grid grid-cols-5 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden divide-x divide-slate-300 dark:divide-slate-700">
      {SAMPLE_SCALE.map((label, i) => {
        const value = i + 1;
        const isSelected = value === SAMPLE_RATING;
        const isFilled = value < SAMPLE_RATING;
        return (
          <div key={value} className="relative px-2 py-1.5">
            {(isSelected || isFilled) && (
              <span
                className={`login-fill absolute inset-0 ${isSelected ? 'bg-indigo-600' : 'bg-indigo-50 dark:bg-indigo-950/70'}`}
                style={{ animationDelay: `${300 + i * 140}ms` }}
              />
            )}
            <div className={`relative ${isSelected ? 'text-white' : isFilled ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
              <div className="text-sm font-bold leading-none tabular-nums">{value}</div>
              <div className="mt-0.5 text-[11px] leading-tight truncate">{label}</div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="grid grid-cols-5 mt-1 animate-fadeIn" style={{ animationDelay: '900ms' }}>
      <div className="flex flex-col items-start pl-1.5" style={{ gridColumnStart: SAMPLE_SELF_RATING }}>
        <span className="ml-2.5 w-0 h-0 border-x-[4px] border-x-transparent border-b-[4px] border-b-slate-400" />
        <span className="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden divide-x divide-slate-300 dark:divide-slate-600 text-[11px] font-semibold leading-tight whitespace-nowrap">
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">Employee</span>
          <span className="px-1.5 py-0.5 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300">rated {SAMPLE_SELF_RATING}</span>
        </span>
      </div>
    </div>

    <figure className="mt-2 text-[11px] xl:text-xs animate-fadeIn" style={{ animationDelay: '1100ms' }}>
      <figcaption className="font-semibold text-slate-700 dark:text-slate-300">Manager's reason</figcaption>
      <blockquote className="mt-0.5 border-l-2 border-indigo-500 pl-2 text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
        Onboarding averaged 6 days against the 5-day target. Quality was strong, so this meets expectations.
      </blockquote>
    </figure>
  </div>
);

export const LoginPage: React.FC = () => {
  const { login, switchRole, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<QuickRole | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your employee ID or email, and your password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Check your ID and password, then try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (quickRole: QuickRole) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await switchRole(quickRole.role);
    } catch {
      try {
        await login(quickRole.email, 'password123');
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || 'Demo sign-in failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPersona = (qr: QuickRole) => {
    setSelectedPersona(qr);
    setEmail(qr.email);
    setPassword('password123');
    setError(null);
  };

  const isActionLocked = isLoading || isSubmitting;

  return (
    <div className="h-screen max-h-screen w-full overflow-hidden flex bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Brand panel (large screens): what MintReview does, shown with the app's own rating scale */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between h-full max-h-screen overflow-hidden bg-indigo-900 dark:bg-indigo-950 text-white px-8 xl:px-14 py-6 xl:py-8 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <AppLogo className="w-7 h-7" />
          <span className="text-base font-semibold tracking-tight">MintReview</span>
        </div>

        <div className="max-w-md my-auto py-2">
          <h2 className="text-2xl xl:text-3xl 2xl:text-4xl font-semibold leading-tight tracking-tight">
            Every rating comes with its reason.
          </h2>
          <p className="mt-2 text-xs xl:text-sm text-indigo-100/85 leading-relaxed">
            Self-assessments, manager and HOD scoring, and HR approval, all on one scale everyone can read.
          </p>
          <div className="mt-4 xl:mt-6">
            <ExampleKraCard />
          </div>
        </div>

        <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-indigo-100/85 shrink-0" aria-label="How a review moves">
          {REVIEW_PATH.map((stage, i) => (
            <li key={stage} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full border border-indigo-300/60 text-[11px] font-semibold flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                {stage}
              </span>
              {i < REVIEW_PATH.length - 1 && <span className="w-4 h-px bg-indigo-300/50" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </aside>

      {/* Sign-in */}
      <div className="flex-1 flex flex-col justify-between h-full max-h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 lg:bg-white lg:dark:bg-slate-950">
        <header className="px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between lg:justify-end shrink-0">
          <div className="flex items-center gap-2 lg:hidden">
            <AppLogo className="w-7 h-7" />
            <span className="text-base font-semibold text-slate-900 dark:text-white">MintReview</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            id="login-theme-toggle-btn"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 w-full px-4 sm:px-8 flex items-center justify-center my-auto min-h-0">
          <div className="w-full max-w-sm py-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Welcome back</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Sign in with your employee ID or work email.
            </p>

            <div className="mt-3 sm:mt-4">
              {/* Demo users: development builds only */}
              {import.meta.env.DEV && (
                <div className="mb-2.5 sm:mb-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-2 sm:p-2.5 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Demo users</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Dev only</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {QUICK_ROLES.map((qr) => {
                      const isSelected = selectedPersona?.role === qr.role;
                      return (
                        <button
                          key={qr.role}
                          type="button"
                          onClick={() => handleSelectPersona(qr)}
                          aria-pressed={isSelected}
                          title={`Use the ${qr.title} demo user`}
                          className={`px-1.5 py-1 rounded-md border text-[11px] font-medium truncate transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {qr.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPersona && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 dark:bg-slate-850 px-2 py-1.5 animate-fadeIn">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 dark:text-white truncate">{selectedPersona.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{selectedPersona.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin(selectedPersona)}
                        disabled={isActionLocked}
                        className="shrink-0 px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
                      >
                        {isActionLocked && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                        Sign in as {selectedPersona.shortLabel}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-2.5 p-2 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-1.5 animate-fadeIn"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
                <div className="space-y-1">
                  <label htmlFor="login-email" className={LABEL_CLASS}>
                    Employee ID or work email
                  </label>
                  <input
                    id="login-email"
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com or MS0001"
                    disabled={isActionLocked}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="login-password" className={LABEL_CLASS}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotInfo(!showForgotInfo)}
                      aria-expanded={showForgotInfo}
                      aria-controls="login-forgot-help"
                      className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isActionLocked}
                      className={`${INPUT_CLASS} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {showForgotInfo && (
                  <p
                    id="login-forgot-help"
                    className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed rounded-md bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 animate-fadeIn"
                  >
                    Ask your HR administrator to set a temporary password for you. They can do this from the employees page.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isActionLocked}
                  className="w-full py-2 sm:py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-950 mt-1"
                >
                  {isActionLocked && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {isActionLocked ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>
        </main>

        <footer className="px-4 sm:px-8 py-2 text-xs text-slate-500 shrink-0 text-center sm:text-left">
          © {new Date().getFullYear()} MintReview
        </footer>
      </div>
    </div>
  );
};
