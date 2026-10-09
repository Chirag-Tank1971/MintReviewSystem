import React from 'react';

type PageSkeletonVariant = 'dashboard' | 'table' | 'hierarchy' | 'generic';

interface PageSkeletonLoaderProps {
  variant?: PageSkeletonVariant;
  rowCount?: number;
  className?: string;
}

export const PageSkeletonLoader: React.FC<PageSkeletonLoaderProps> = ({
  variant = 'generic',
  rowCount = 6,
  className = '',
}) => {
  if (variant === 'dashboard') {
    return (
      <div className={`space-y-6 w-full animate-page-enter ${className}`}>
        {/* Executive Banner Skeleton */}
        <div className="p-5 sm:p-6 bg-slate-900/90 rounded-2xl border border-slate-800 shimmer-effect flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded-md" />
          </div>
          <div className="h-9 w-40 bg-slate-800 rounded-xl shrink-0" />
        </div>

        {/* 6 KPI Cards Strip Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs shimmer-effect space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>

        {/* 3 Donut Charts Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs shimmer-effect space-y-4 flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center">
                <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              {/* Circular donut placeholder */}
              <div className="w-36 h-36 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center my-2">
                <div className="w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              {/* Legend lines */}
              <div className="w-full space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-8 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-4 w-full animate-page-enter ${className}`}>
        {/* Search & Filters Row Skeleton */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs shimmer-effect flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>

        {/* Table Skeleton Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden shimmer-effect">
          {/* Table Header */}
          <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded col-span-2" />
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-14 bg-slate-200 dark:bg-slate-700 rounded ml-auto" />
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3.5 items-center">
                {/* Employee Name & Subtext */}
                <div className="flex items-center gap-3 col-span-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                </div>
                {/* Department */}
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                {/* Score */}
                <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
                {/* Status Badge */}
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                {/* Action */}
                <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'hierarchy') {
    return (
      <div className={`space-y-6 w-full animate-page-enter ${className}`}>
        {/* Hierarchy Stats Bar Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs shimmer-effect space-y-2"
            >
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* 2 Hierarchy Tree Cards Skeleton */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs shimmer-effect space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            {/* Manager blocks */}
            <div className="space-y-3 pl-4 border-l-2 border-slate-100 dark:border-slate-800">
              <div className="h-16 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3" />
              <div className="h-16 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Generic Default Skeleton
  return (
    <div className={`space-y-4 w-full animate-page-enter ${className}`}>
      {/* Top Banner Skeleton */}
      <div className="p-5 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shimmer-effect flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-52 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-3.5 w-80 max-w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
      </div>

      {/* Main Content Skeleton Panel */}
      <div className="p-6 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shimmer-effect min-h-[320px] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="h-40 bg-slate-50 dark:bg-slate-800/40 rounded-xl" />
      </div>
    </div>
  );
};
