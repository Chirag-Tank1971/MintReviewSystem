import React, { useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { Employee, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import { useHasSalesChamps } from '../hooks/useHasSalesChamps';
import { useHasAchievement } from '../hooks/useHasAchievement';
import { SegmentedControl } from './ui/SegmentedControl';
import { SalesChampsView } from './SalesChampsView';
import { AchievementView } from './AchievementView';

interface Props {
  employees: Employee[];
  departments?: Department[];
}

type SalesTab = 'champs' | 'achievement';

/**
 * One "Sales" page with a tab per section. HR and Super Admin get every tab; an employee only
 * gets the tabs they have something to look at in (a locked scheme, or a locked achievement report).
 */
export const SalesHub: React.FC<Props> = ({ employees, departments }) => {
  const { user } = useAuth();
  const hasChamps = useHasSalesChamps(user?.role, user?.employeeId);
  const hasAchievement = useHasAchievement(user?.role, user?.employeeId);

  const tabs = [
    hasChamps && { value: 'champs' as const, label: 'Champs scheme', icon: Trophy },
    hasAchievement && { value: 'achievement' as const, label: 'Achievement', icon: TrendingUp },
  ].filter(Boolean) as { value: SalesTab; label: string; icon: typeof Trophy }[];

  const [picked, setPicked] = useState<SalesTab>('champs');
  // Fall back to the first tab that exists if the picked one isn't available (yet)
  const tab = tabs.some((t) => t.value === picked) ? picked : tabs[0]?.value ?? 'champs';

  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <SegmentedControl ariaLabel="Sales section" strong options={tabs} value={tab} onChange={setPicked} />
      )}
      {tab === 'achievement'
        ? <AchievementView employees={employees} departments={departments} />
        : <SalesChampsView employees={employees} departments={departments} />}
    </div>
  );
};
