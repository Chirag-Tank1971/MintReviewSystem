import React, { useState, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart2,
} from 'lucide-react';

// =========================================================================
// 1. Interactive Animated SVG Donut Chart
// =========================================================================
interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}

export const DonutChart: React.FC<{
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  totalLabel?: string;
  size?: number;
}> = ({ title, subtitle, segments, totalLabel = 'Total', size = 180 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div
      className={`p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-col justify-between transition-all duration-700 ease-out hover:border-slate-300 dark:hover:border-slate-700 ${
        isAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <PieChartIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            {title}
          </h3>
          <span className="text-[11px] tabular-nums font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {total} {total === 1 ? 'item' : 'items'}
          </span>
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4">{subtitle}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto pt-2">
        {/* SVG Circle */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-slate-100 dark:text-slate-800/80"
            />
            {total > 0 &&
              segments.map((seg, idx) => {
                if (seg.value <= 0) return null;
                const percent = seg.value / total;
                const targetDash = percent * circumference;
                const dashArray = isAnimated ? targetDash : 0;
                const offset = currentOffset;
                currentOffset += targetDash;

                const isHovered = hoveredIndex === idx;

                return (
                  <circle
                    key={seg.id}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                    strokeDashoffset={-offset}
                    fill="transparent"
                    strokeLinecap="butt"
                    style={{
                      transition: `stroke-dasharray 1000ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms, stroke-width 200ms ease`,
                    }}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
          </svg>

          {/* Center text */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center transition-all duration-700 delay-200 ${
              isAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
          >
            {hoveredIndex !== null && segments[hoveredIndex] ? (
              <>
                <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                  {segments[hoveredIndex].value}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[100px] truncate px-1">
                  {segments[hoveredIndex].label}
                </span>
                <span className="text-[11px] tabular-nums text-blue-600 dark:text-blue-400 font-bold">
                  {total > 0 ? Math.round((segments[hoveredIndex].value / total) * 100) : 0}%
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight leading-none">
                  {total}
                </span>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                  {totalLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend with staggered entrance */}
        <div className="flex-1 w-full space-y-2">
          {segments.map((seg, idx) => {
            const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0';
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  transitionDelay: `${120 + idx * 70}ms`,
                }}
                className={`p-1.5 rounded-lg transition-all duration-500 flex items-center justify-between text-xs cursor-pointer ${
                  isAnimated ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'
                } ${
                  isHovered
                    ? 'bg-slate-100 dark:bg-slate-800 scale-[1.02]'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-300"
                    style={{
                      backgroundColor: seg.color,
                      transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                    {seg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums text-[11px]">
                  <span className="font-bold text-slate-900 dark:text-white">{seg.value}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] w-9 text-right">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. Horizontal Ranked Bar Chart with Smooth Load Animation
// =========================================================================
interface HorizontalBarItem {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number | string;
  maxValue?: number;
  color?: string;
  meta?: string;
}

export const HorizontalBarChart: React.FC<{
  title: string;
  subtitle?: string;
  items: HorizontalBarItem[];
  valueUnit?: string;
  emptyText?: string;
  maxItems?: number;
}> = ({ title, subtitle, items, valueUnit = '', emptyText = 'No data available', maxItems = 6 }) => {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const displayItems = items.slice(0, maxItems);
  const highestValue = Math.max(...displayItems.map((i) => i.value), 1);

  return (
    <div
      className={`p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-col justify-between transition-all duration-700 ease-out hover:border-slate-300 dark:hover:border-slate-700 ${
        isAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            {title}
          </h3>
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            Top {displayItems.length}
          </span>
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4">{subtitle}</p>}
      </div>

      {displayItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">{emptyText}</div>
      ) : (
        <div className="space-y-3 pt-2">
          {displayItems.map((item, idx) => {
            const widthPct = Math.min(100, Math.max(8, (item.value / (item.maxValue || highestValue)) * 100));
            const barColor = item.color || '#3b82f6';

            return (
              <div
                key={item.id}
                style={{
                  transitionDelay: `${idx * 60}ms`,
                }}
                className={`space-y-1 text-xs group transition-all duration-500 ${
                  isAnimated ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[190px]">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 tabular-nums text-[11px]">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {typeof item.value === 'number' && item.value % 1 !== 0 ? item.value.toFixed(2) : item.value}
                      {valueUnit}
                    </span>
                    {item.secondaryValue !== undefined && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">({item.secondaryValue})</span>
                    )}
                  </div>
                </div>

                {/* Bar Track */}
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full group-hover:brightness-110"
                    style={{
                      width: isAnimated ? `${widthPct}%` : '0%',
                      backgroundColor: barColor,
                      transition: `width 900ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 3. Performance Rating Tier Distribution (Animated Histogram)
// =========================================================================
interface RatingDistributionProps {
  outstanding: number;
  exceeds: number;
  meets: number;
  needsImprovement: number;
  total?: number;
}

export const RatingTierChart: React.FC<RatingDistributionProps> = ({
  outstanding,
  exceeds,
  meets,
  needsImprovement,
  total,
}) => {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const calculatedTotal = total ?? outstanding + exceeds + meets + needsImprovement;
  const tiers = [
    {
      id: 'outstanding',
      label: 'Outstanding',
      shortLabel: 'Outstanding',
      range: '4.5 - 5.0',
      count: outstanding,
      color: '#10b981', // emerald
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'exceeds',
      label: 'Exceeds Expectations',
      shortLabel: 'Exceeds',
      range: '3.8 - 4.49',
      count: exceeds,
      color: '#3b82f6', // blue
      badgeClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    {
      id: 'meets',
      label: 'Meets Expectations',
      shortLabel: 'Meets',
      range: '2.8 - 3.79',
      count: meets,
      color: '#6366f1', // indigo
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
      id: 'needsImp',
      label: 'Needs Improvement',
      shortLabel: 'Needs Imp.',
      range: '< 2.8',
      count: needsImprovement,
      color: '#f59e0b', // amber
      badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
  ];

  const maxCount = Math.max(...tiers.map((t) => t.count), 1);

  return (
    <div
      className={`p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-col justify-between transition-all duration-700 ease-out hover:border-slate-300 dark:hover:border-slate-700 min-w-0 ${
        isAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">Rating distribution curve</span>
          </h3>
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
            {calculatedTotal} evaluated
          </span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 sm:mb-4 line-clamp-1">
          Cohort performance categorization across standard grading tiers
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1 sm:pt-2 w-full min-w-0">
        {tiers.map((tier, idx) => {
          const pct = calculatedTotal > 0 ? Math.round((tier.count / calculatedTotal) * 100) : 0;
          const barHeightPct = Math.min(100, Math.max(12, (tier.count / maxCount) * 100));

          return (
            <div
              key={tier.id}
              style={{
                transitionDelay: `${idx * 80}ms`,
              }}
              className={`p-2 sm:p-2.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex flex-col items-center justify-between text-center space-y-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-all duration-500 min-w-0 w-full overflow-hidden ${
                isAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="space-y-0.5 w-full min-w-0">
                <span
                  className="text-[10.5px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate w-full px-0.5 leading-tight"
                  title={tier.label}
                >
                  <span className="hidden xl:inline">{tier.label}</span>
                  <span className="xl:hidden">{tier.shortLabel}</span>
                </span>
                <span className="text-[9.5px] sm:text-[11px] tabular-nums text-slate-400 dark:text-slate-500 block truncate w-full">
                  {tier.range}
                </span>
              </div>

              {/* Animated vertical bar */}
              <div className="h-14 sm:h-16 w-8 sm:w-10 bg-slate-200/60 dark:bg-slate-700/40 rounded-lg flex items-end justify-center p-1 shrink-0">
                <div
                  className="w-full rounded"
                  style={{
                    height: isAnimated ? `${barHeightPct}%` : '0%',
                    backgroundColor: tier.color,
                    transition: `height 850ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 100}ms`,
                  }}
                />
              </div>

              <div className="space-y-0.5 w-full min-w-0">
                <div className="text-sm sm:text-base font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                  {tier.count}
                </div>
                <span className="text-[9.5px] sm:text-[11px] tabular-nums font-semibold text-slate-500 dark:text-slate-400 block">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =========================================================================
// 4. SVG Smooth Trend Line Chart with Draw-in Path Animation
// =========================================================================
interface TrendPoint {
  label: string;
  value: number;
  secondary?: number;
}

export const TrendLineChart: React.FC<{
  title: string;
  subtitle?: string;
  points: TrendPoint[];
  yMin?: number;
  yMax?: number;
  unit?: string;
}> = ({ title, subtitle, points, yMin = 0, yMax = 5.0, unit = '/ 5.0' }) => {
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const width = 460;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const validPoints = points.filter((p) => p.value !== undefined && !isNaN(p.value));

  const getCoordinates = (point: TrendPoint, index: number) => {
    const x = paddingX + (index / Math.max(1, validPoints.length - 1)) * (width - 2 * paddingX);
    const yClamped = Math.max(yMin, Math.min(yMax, point.value));
    const y = height - paddingY - ((yClamped - yMin) / (yMax - yMin)) * (height - 2 * paddingY);
    return { x, y };
  };

  const coords = validPoints.map(getCoordinates);

  // Generate smooth SVG path
  let pathD = '';
  if (coords.length > 0) {
    pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cx = (prev.x + curr.x) / 2;
      pathD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }

  // Area path for gradient fill
  const areaD =
    coords.length > 0
      ? `${pathD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`
      : '';

  return (
    <div
      className={`p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-col justify-between transition-all duration-700 ease-out hover:border-slate-300 dark:hover:border-slate-700 ${
        isAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            {title}
          </h3>
          {hoveredPoint ? (
            <span className="text-[11px] tabular-nums font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
              {hoveredPoint.label}: {hoveredPoint.value.toFixed(2)} {unit}
            </span>
          ) : (
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              Scale {yMin} - {yMax}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">{subtitle}</p>}
      </div>

      <div className="w-full flex items-center justify-center my-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map((step, idx) => {
            const y = height - paddingY - step * (height - 2 * paddingY);
            const val = (yMin + step * (yMax - yMin)).toFixed(1);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-slate-200 dark:text-slate-800"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[11px] fill-slate-400 dark:fill-slate-600 tabular-nums"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Filled area with fade-in */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#trendGradient)"
              className={`transition-opacity duration-1000 delay-300 ${
                isAnimated ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Stroke line with drawing animation */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={1000}
              strokeDashoffset={isAnimated ? 0 : 1000}
              style={{
                transition: 'stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="drop-shadow-xs"
            />
          )}

          {/* Interactive nodes with scale pop */}
          {coords.map((c, idx) => {
            const p = validPoints[idx];
            const isHovered = hoveredPoint?.label === p.label;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                style={{
                  transitionDelay: `${400 + idx * 80}ms`,
                }}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#2563eb' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className={`transition-all duration-300 drop-shadow-sm ${
                    isAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                  }`}
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                <text
                  x={c.x}
                  y={height - 6}
                  textAnchor="middle"
                  className="text-[11px] font-semibold fill-slate-600 dark:fill-slate-400"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
