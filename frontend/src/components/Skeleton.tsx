import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-850 via-slate-800 to-slate-850 rounded-lg ${className}`}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => {
  return (
    <div className="w-full space-y-3 p-4">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center space-x-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-6 ${cIdx === 0 ? 'w-1/4' : cIdx === 1 ? 'w-1/6' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-850/50">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
};
