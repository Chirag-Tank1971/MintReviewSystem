import React from 'react';
import {
  DonutChart,
  HorizontalBarChart,
  RatingTierChart,
  TrendLineChart,
} from './ReportCharts';

interface ReportVisualSectionProps {
  activeReport: string;
  data: any;
  departments?: any[];
  cycles?: any[];
}

export const ReportVisualSection: React.FC<ReportVisualSectionProps> = ({
  activeReport,
  data,
}) => {
  if (!data) return null;

  // =========================================================================
  // 1. QUARTERLY REVIEW STATUS
  // =========================================================================
  if (activeReport === 'quarterly-status') {
    const summary = data.summary || {
      total: 0,
      completed: 0,
      managerPending: 0,
      hrPending: 0,
      returned: 0,
      averageScore: 0,
    };

    const statusSegments = [
      { id: 'completed', label: 'Completed', value: summary.completed || 0, color: '#10b981' },
      { id: 'mgrPending', label: 'Manager Pending', value: summary.managerPending || 0, color: '#f59e0b' },
      { id: 'hrPending', label: 'HR Pending', value: summary.hrPending || 0, color: '#a855f7' },
      { id: 'returned', label: 'Returned', value: summary.returned || 0, color: '#f43f5e' },
    ];

    // Compute department review counts from reportData
    const deptMap = new Map<string, { total: number; completed: number }>();
    let outstanding = 0;
    let exceeds = 0;
    let meets = 0;
    let needsImp = 0;

    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        const dName = row.departmentName || 'General';
        const current = deptMap.get(dName) || { total: 0, completed: 0 };
        current.total += 1;
        if (row.status === 'CLOSED') {
          current.completed += 1;
        }
        deptMap.set(dName, current);

        const score = Number(row.finalScore);
        if (score && score > 0) {
          if (score >= 4.5) outstanding++;
          else if (score >= 3.8) exceeds++;
          else if (score >= 2.8) meets++;
          else needsImp++;
        }
      });
    }

    const deptItems = Array.from(deptMap.entries())
      .map(([name, stat]) => ({
        id: name,
        label: name,
        value: stat.total,
        secondaryValue: `${stat.completed} completed`,
        color: '#3b82f6',
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <DonutChart
          title="Review Pipeline Breakdown"
          subtitle="Proportion of completed vs pending review stages"
          segments={statusSegments}
          totalLabel="Reviews"
        />

        <RatingTierChart
          outstanding={outstanding}
          exceeds={exceeds}
          meets={meets}
          needsImprovement={needsImp}
          total={outstanding + exceeds + meets + needsImp}
        />

        <div className="md:col-span-2 xl:col-span-1 min-w-0">
          <HorizontalBarChart
            title="Department Review Volume"
            subtitle="Top departments by total review count and completion"
            items={deptItems}
            valueUnit=" reviews"
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. PENDING & OVERDUE REVIEWS
  // =========================================================================
  if (activeReport === 'pending-overdue') {
    const summary = data.summary || {};
    const bottleneckSegments = [
      { id: 'mgr', label: 'With Manager', value: summary.managerPendingCount || 0, color: '#f59e0b' },
      { id: 'hr', label: 'With HR Sign-off', value: summary.hrPendingCount || 0, color: '#a855f7' },
      { id: 'overdue', label: 'Critical Overdue (>30d)', value: summary.criticalOverdueCount || 0, color: '#f43f5e' },
    ];

    // Compute aging by department
    const deptPendingMap = new Map<string, number>();
    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        const dName = row.departmentName || 'General';
        deptPendingMap.set(dName, (deptPendingMap.get(dName) || 0) + 1);
      });
    }

    const deptPendingItems = Array.from(deptPendingMap.entries())
      .map(([name, count]) => ({
        id: name,
        label: name,
        value: count,
        color: '#f59e0b',
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DonutChart
          title="Bottleneck Distribution"
          subtitle="Where pending reviews are currently awaiting action"
          segments={bottleneckSegments}
          totalLabel="Pending"
        />

        <HorizontalBarChart
          title="Pending Reviews by Department"
          subtitle="Departments with highest volume of awaiting evaluations"
          items={deptPendingItems}
          valueUnit=" pending"
        />
      </div>
    );
  }

  // =========================================================================
  // 3. DEPARTMENT PERFORMANCE REPORT
  // =========================================================================
  if (activeReport === 'department-performance') {
    let outstanding = 0;
    let exceeds = 0;
    let meets = 0;
    let needsImp = 0;

    const deptScores: any[] = [];
    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        outstanding += row.outstandingCount || 0;
        exceeds += row.exceedsCount || 0;
        meets += row.meetsCount || 0;
        needsImp += row.needsImpCount || 0;

        deptScores.push({
          id: row.departmentId || row.departmentName,
          label: row.departmentName,
          value: Number(row.averageScore) || 0,
          secondaryValue: `${row.completionRate}% completed`,
          maxValue: 5.0,
          color: (row.averageScore || 0) >= 4.0 ? '#10b981' : (row.averageScore || 0) >= 3.0 ? '#3b82f6' : '#f59e0b',
        });
      });
    }

    deptScores.sort((a, b) => b.value - a.value);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HorizontalBarChart
          title="Department Score Leaderboard"
          subtitle="Average score out of 5.0 across organizational departments"
          items={deptScores}
          valueUnit=" / 5.0"
        />

        <RatingTierChart
          outstanding={outstanding}
          exceeds={exceeds}
          meets={meets}
          needsImprovement={needsImp}
          total={outstanding + exceeds + meets + needsImp}
        />
      </div>
    );
  }

  // =========================================================================
  // 4. MANAGER COMPLETION REPORT
  // =========================================================================
  if (activeReport === 'manager-completion') {
    let totalSubmitted = 0;
    let totalClosed = 0;
    let totalReturned = 0;
    let totalOverdue = 0;

    const managerBars: any[] = [];

    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        totalSubmitted += row.submittedCount || 0;
        totalClosed += row.closedCount || 0;
        totalReturned += row.returnedCount || 0;
        totalOverdue += row.overdueCount || 0;

        managerBars.push({
          id: row.managerId || row.managerName,
          label: row.managerName,
          value: row.completionRate || 0,
          secondaryValue: `${row.closedCount}/${row.totalAssigned} closed`,
          maxValue: 100,
          color: (row.completionRate || 0) >= 80 ? '#10b981' : (row.completionRate || 0) >= 50 ? '#f59e0b' : '#f43f5e',
        });
      });
    }

    managerBars.sort((a, b) => b.value - a.value);

    const completionSegments = [
      { id: 'closed', label: 'Closed & Finalized', value: totalClosed, color: '#10b981' },
      { id: 'submitted', label: 'Submitted to HR', value: totalSubmitted, color: '#3b82f6' },
      { id: 'overdue', label: 'Overdue Reviews', value: totalOverdue, color: '#f59e0b' },
      { id: 'returned', label: 'Returned for Revision', value: totalReturned, color: '#f43f5e' },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HorizontalBarChart
          title="Manager Completion Leaderboard"
          subtitle="Managers ranked by overall review completion percentage"
          items={managerBars}
          valueUnit="%"
        />

        <DonutChart
          title="Review Submission Status"
          subtitle="Cumulative review states across all assigned managers"
          segments={completionSegments}
          totalLabel="Total"
        />
      </div>
    );
  }

  // =========================================================================
  // 5. APPRAISAL DUE REPORT
  // =========================================================================
  if (activeReport === 'appraisal-due') {
    const cycleMap = new Map<string, number>();
    let bracket0to5 = 0;
    let bracket6to10 = 0;
    let bracket11to15 = 0;
    let bracketAbove15 = 0;

    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        const cName = row.cycleName || `Cycle ${row.cycleCode || '?'}`;
        cycleMap.set(cName, (cycleMap.get(cName) || 0) + 1);

        const inc = Number(row.proposedIncrement) || 0;
        if (inc <= 5) bracket0to5++;
        else if (inc <= 10) bracket6to10++;
        else if (inc <= 15) bracket11to15++;
        else bracketAbove15++;
      });
    }

    const incrementSegments = [
      { id: '0-5', label: '0% - 5% Increment', value: bracket0to5, color: '#6366f1' },
      { id: '6-10', label: '6% - 10% Increment', value: bracket6to10, color: '#3b82f6' },
      { id: '11-15', label: '11% - 15% Increment', value: bracket11to15, color: '#10b981' },
      { id: 'above15', label: '> 15% Increment', value: bracketAbove15, color: '#f59e0b' },
    ];

    const cycleItems = Array.from(cycleMap.entries())
      .map(([name, count]) => ({
        id: name,
        label: name,
        value: count,
        color: '#3b82f6',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DonutChart
          title="Proposed Increment Brackets"
          subtitle="Distribution of recommended salary adjustments"
          segments={incrementSegments}
          totalLabel="Employees"
        />

        <HorizontalBarChart
          title="Cohort Size per Appraisal Cycle"
          subtitle="Number of employees due for annual appraisal per cycle"
          items={cycleItems}
          valueUnit=" employees"
        />
      </div>
    );
  }

  // =========================================================================
  // 6. QUARTERLY RATING TRENDS REPORT
  // =========================================================================
  if (activeReport === 'rating-trend') {
    const trends = Array.isArray(data.trends) ? data.trends : [];
    const trendPoints = trends.map((t: any) => ({
      label: t.quarter,
      value: Number(t.averageScore) || 0,
    }));

    let outstanding = 0;
    let exceeds = 0;
    let meets = 0;
    let needsImp = 0;

    trends.forEach((t: any) => {
      if (t.distribution) {
        outstanding += t.distribution.outstanding || 0;
        exceeds += t.distribution.exceeds || 0;
        meets += t.distribution.meets || 0;
        needsImp += t.distribution.needsImp || 0;
      }
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <TrendLineChart
          title="Organizational Score Progression"
          subtitle="Average performance rating score across evaluated quarters"
          points={trendPoints}
          yMin={0}
          yMax={5.0}
        />

        <RatingTierChart
          outstanding={outstanding}
          exceeds={exceeds}
          meets={meets}
          needsImprovement={needsImp}
          total={outstanding + exceeds + meets + needsImp}
        />
      </div>
    );
  }

  // =========================================================================
  // 7. KRA COMPETENCY REPORT
  // =========================================================================
  if (activeReport === 'kra-performance') {
    const kraScores: any[] = [];
    if (Array.isArray(data.reportData)) {
      data.reportData.forEach((row: any) => {
        kraScores.push({
          id: row.kraName,
          label: row.kraName,
          value: Number(row.averageRating) || 0,
          secondaryValue: `${row.occurrencesCount} reviews`,
          maxValue: 5.0,
          color: (row.averageRating || 0) >= 4.0 ? '#10b981' : (row.averageRating || 0) >= 3.0 ? '#3b82f6' : '#f59e0b',
        });
      });
    }

    kraScores.sort((a, b) => b.value - a.value);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <HorizontalBarChart
          title="KRA Competency Leaderboard"
          subtitle="Competency metrics evaluated across all employee reviews"
          items={kraScores}
          valueUnit=" / 5.0"
          maxItems={8}
        />

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Competency evaluation insights
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4">
              Observations based on {kraScores.length} unique organizational KRA metrics
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                Top performing competency
              </span>
              <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                {kraScores[0] ? `${kraScores[0].label} (${kraScores[0].value.toFixed(2)} / 5.0)` : 'N/A'}
              </p>
            </div>

            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs">
              <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                Area with development opportunity
              </span>
              <p className="text-amber-700 dark:text-amber-400 text-[11px]">
                {kraScores.length > 1
                  ? `${kraScores[kraScores.length - 1].label} (${kraScores[kraScores.length - 1].value.toFixed(2)} / 5.0)`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
