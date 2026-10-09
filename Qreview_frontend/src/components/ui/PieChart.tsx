import React, { useState, useEffect, useMemo } from 'react';

export interface PieChartItem {
  label: string;
  value: number;
  color: string;
  subtext?: string;
}

interface PieChartProps {
  data: PieChartItem[];
  title?: string;
  subtitle?: string;
  centerValue?: string | number;
  centerLabel?: string;
  size?: number;
  donutThickness?: number;
  className?: string;
  legendPosition?: 'bottom' | 'right';
  formatValue?: (val: number) => string;
  /** Show each slice's share of the total next to its value. Turn off when the values are
   *  already percentages, otherwise the legend shows the same number twice. */
  showShare?: boolean;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  subtitle,
  centerValue,
  centerLabel,
  size = 180,
  donutThickness = 24,
  className = '',
  legendPosition = 'right',
  formatValue = (v) => v.toString(),
  showShare = true,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 60);
    return () => clearTimeout(timer);
  }, [data]);

  const total = useMemo(
    () => data.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0),
    [data]
  );
  const validItems = useMemo(
    () => data.filter((item) => item.value > 0),
    [data]
  );

  const center = size / 2;
  const radius = (size - donutThickness - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute offset and stroke length for each slice
  const slices = useMemo(() => {
    let currentOffset = 0;
    return validItems.map((item, idx) => {
      const ratio = total > 0 ? item.value / total : 0;
      const arcLength = ratio * circumference;
      const offset = currentOffset;
      currentOffset += arcLength;
      const percent = total > 0 ? Math.round(ratio * 100) : 0;

      return {
        ...item,
        originalIndex: idx,
        arcLength,
        offset,
        percent,
      };
    });
  }, [validItems, total, circumference]);

  const activeItem = hoveredIndex !== null && hoveredIndex < validItems.length ? validItems[hoveredIndex] : null;
  const activePercent = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : null;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 transition-all duration-500 hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-700 ${
        isAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.99]'
      } ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div
        className={`flex ${
          legendPosition === 'bottom' ? 'flex-col items-center' : 'flex-col sm:flex-row items-center justify-between'
        } gap-4`}
      >
        {/* SVG Donut */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible transform -rotate-90 origin-center">
            {/* Background track circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={donutThickness}
              className="text-slate-100 dark:text-slate-800/80 transition-colors"
            />

            {/* Animated Donut Slices */}
            {total > 0 &&
              slices.map((slice, idx) => {
                const isHovered = hoveredIndex === idx;
                const gap = validItems.length > 1 ? 2.5 : 0;
                const targetDash = Math.max(0, slice.arcLength - gap);
                const strokeDasharray = isAnimated ? `${targetDash} ${circumference}` : `0 ${circumference}`;
                const strokeDashoffset = -slice.offset;

                return (
                  <circle
                    key={slice.label + idx}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? donutThickness + 4 : donutThickness}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    className="cursor-pointer hover:opacity-95"
                    style={{
                      transition:
                        'stroke-dasharray 850ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 850ms cubic-bezier(0.16, 1, 0.3, 1), stroke-width 200ms ease, opacity 200ms ease',
                    }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
          </svg>

          {/* Donut Center Info */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2 transition-all duration-500 ease-out ${
              isAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {activeItem ? (
              <>
                <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-tight animate-in fade-in zoom-in-95 duration-150">
                  {formatValue(activeItem.value)}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                  {activeItem.label}
                </span>
                <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                  {activePercent}% of total
                </span>
              </>
            ) : (
              <>
                {centerValue !== undefined && (
                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-tight">
                    {centerValue}
                  </span>
                )}
                {centerLabel && (
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[85px]">
                    {centerLabel}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="w-full flex-1 space-y-1.5 min-w-0">
          {data.map((item, idx) => {
            const isHovered = hoveredIndex === idx;
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div
                key={item.label + idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer text-xs ${
                  isHovered
                    ? 'bg-slate-100 dark:bg-slate-800/80 font-medium'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-slate-700 dark:text-slate-200 text-xs">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums text-xs">
                    {formatValue(item.value)}
                  </span>
                  {showShare && (
                    <span className="text-[11px] text-slate-400 tabular-nums w-7 text-right">
                      {percent}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
