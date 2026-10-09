import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { Appraisal, DashboardSummary, DashboardTaskLink } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { EmptyState } from '../ui/EmptyState';
import { PageSkeletonLoader } from '../ui/PageSkeletonLoader';
import { AppraisalLetterModal } from '../AppraisalLetterModal';
import { CycleStrip } from './DashboardKit';
import { AdminDashboard, EmployeeDashboard, HodDashboard, HrDashboard, ManagerDashboard } from './RoleDashboards';
import { daysUntil, formatShortDate, greeting } from './format';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';

type Lens = 'admin' | 'hr' | 'hod' | 'team' | 'me';

const LENS_CTA: Partial<Record<Lens, { label: string; view: DashboardTaskLink['view'] }>> = {
  admin: { label: 'Manage directory', view: 'employees' },
  hr: { label: 'Review cycle', view: 'reviews' },
  hod: { label: 'HOD reviews', view: 'reviews' },
  team: { label: 'Score team reviews', view: 'reviews' },
};

interface DashboardViewProps {
  onNavigate: (view: DashboardTaskLink['view'], params?: DashboardTaskLink['params']) => void;
  initialConfig?: { openLetter?: boolean } | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, initialConfig }) => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens | null>(null);
  const [selectedAppraisalForLetter, setSelectedAppraisalForLetter] = useState<Appraisal | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await api.getDashboardSummary());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, user?.id, user?.role]);

  const handleOpenLetter = useCallback(async () => {
    const appraisalId = data?.me?.activeAppraisal?.id;
    if (!appraisalId) {
      toast.info('No active annual appraisal found for your account.');
      return;
    }
    try {
      const appraisal = await api.getAppraisal(appraisalId);
      if (appraisal) setSelectedAppraisalForLetter(appraisal);
      else toast.error('Could not load appraisal letter details.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to open appraisal letter.');
    }
  }, [data?.me?.activeAppraisal?.id]);

  useEffect(() => {
    if (initialConfig?.openLetter && data?.me?.activeAppraisal?.id) {
      handleOpenLetter();
    }
  }, [initialConfig, data?.me?.activeAppraisal?.id, handleOpenLetter]);

  if (isLoading && !data) return <PageSkeletonLoader variant="generic" />;

  if (error && !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load your dashboard"
        description={error}
        action={{ label: 'Try again', onClick: load, icon: RefreshCw }}
      />
    );
  }

  if (!data) return null;

  const hasAdmin = Boolean(data.admin);
  const hasHr = Boolean(data.hr);
  const hasHod = Boolean(data.hod);
  const hasTeam = Boolean(data.team);
  const hasMe = Boolean(data.me);

  // Default lens: the viewer's primary role, falling back to whatever data they have.
  const defaultLens: Lens =
    (user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT') && hasAdmin
      ? 'admin'
      : hasHr && user?.role === 'HR'
      ? 'hr'
      : hasHod
      ? 'hod'
      : hasAdmin
      ? 'admin'
      : hasHr
      ? 'hr'
      : hasTeam
      ? 'team'
      : 'me';
  const activeLens: Lens = lens || defaultLens;

  const availableLenses: { key: Lens; label: string }[] = [];
  if (hasAdmin) availableLenses.push({ key: 'admin', label: 'System' });
  if (hasHr) availableLenses.push({ key: 'hr', label: 'HR' });
  if (hasHod) availableLenses.push({ key: 'hod', label: 'Department' });
  if (hasTeam) availableLenses.push({ key: 'team', label: 'My team' });
  if (hasMe) availableLenses.push({ key: 'me', label: 'My review' });

  const firstName = (data.me?.employee.name || user?.name || '').split(' ')[0];
  const subtitle =
    activeLens === 'admin' && data.admin
      ? `${data.admin.totalEmployees} employees · ${data.admin.totalDepartments} departments · ${data.admin.totalUsers} users`
      : activeLens === 'hr' && data.hr
      ? `${data.hr.totalEmployees} employees across ${data.hr.totalDepartments} departments`
      : activeLens === 'hod' && data.hod
      ? `${data.hod.departmentName} · ${data.hod.totalEmployees} employees`
      : activeLens === 'team' && data.team
      ? `${data.team.size} direct report${data.team.size === 1 ? '' : 's'}`
      : [data.me?.employee.designationName, data.me?.employee.departmentName].filter(Boolean).join(' · ');

  // Cycle progress is shown for the viewer's own scope, not a global placeholder.
  const scopedProgress =
    activeLens === 'admin' || activeLens === 'hr'
      ? data.hr
        ? { label: 'of reviews completed', percent: data.hr.completionRate }
        : undefined
      : activeLens === 'hod' && data.hod
      ? { label: 'of department done', percent: data.hod.completionRate }
      : activeLens === 'team' && data.team && data.team.reviewsInPeriod > 0
      ? { label: 'of your reviews submitted', percent: (data.team.scoredByManager / data.team.reviewsInPeriod) * 100 }
      : undefined;

  const cta = LENS_CTA[activeLens];

  return (
    <div className="space-y-4 max-w-[1400px]">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={subtitle || undefined}
        actions={
          <>
            {availableLenses.length > 1 && (
              <SegmentedControl
                ariaLabel="Dashboard view"
                value={activeLens}
                onChange={setLens}
                options={availableLenses.map((l) => ({ value: l.key, label: l.label }))}
              />
            )}
            <Button variant="ghost" icon={RefreshCw} iconSpin={isLoading} onClick={load} disabled={isLoading} title="Refresh" aria-label="Refresh dashboard" />
            {cta && (
              <Button variant="primary" onClick={() => onNavigate(cta.view)}>
                {cta.label}
              </Button>
            )}
          </>
        }
      />

      {/* Cycle strip */}
      {data.period && (
        <CycleStrip
          name={data.period.name}
          dueDate={formatShortDate(data.period.dueDate)}
          daysLeft={data.period.dueDate ? daysUntil(data.period.dueDate) : undefined}
          progress={scopedProgress}
          onOpen={activeLens === 'me' ? undefined : () => onNavigate('reviews')}
        />
      )}

      {/* Role dashboard */}
      {activeLens === 'admin' && data.admin ? (
        <AdminDashboard data={data} admin={data.admin} onNavigate={onNavigate} />
      ) : activeLens === 'hr' && data.hr ? (
        <HrDashboard data={data} hr={data.hr} onNavigate={onNavigate} onRefresh={load} />
      ) : activeLens === 'hod' && data.hod ? (
        <HodDashboard data={data} hod={data.hod} onNavigate={onNavigate} />
      ) : activeLens === 'team' && data.team ? (
        <ManagerDashboard data={data} team={data.team} onNavigate={onNavigate} />
      ) : data.me ? (
        <EmployeeDashboard data={data} me={data.me} onNavigate={onNavigate} onOpenLetter={handleOpenLetter} />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your account isn't linked to an employee record, so there is no personal review to show.
        </p>
      )}

      {selectedAppraisalForLetter && (
        <AppraisalLetterModal
          appraisal={selectedAppraisalForLetter}
          onClose={() => {
            setSelectedAppraisalForLetter(null);
            load();
          }}
        />
      )}
    </div>
  );
};
