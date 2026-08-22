import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'queued'
  | 'scheduled'
  | 'claimed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead_lettered'
  | 'cancelled'
  | 'healthy'
  | 'degraded'
  | 'offline'
  | 'draining'
  | 'primary'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant | string;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  QUEUED: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  queued: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  SCHEDULED: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-500/20' },
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-500/20' },
  CLAIMED: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400', border: 'border-indigo-500/20' },
  RUNNING: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400 animate-ping', border: 'border-purple-500/20' },
  running: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400 animate-ping', border: 'border-purple-500/20' },
  COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
  FAILED: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400', border: 'border-rose-500/20' },
  failed: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400', border: 'border-rose-500/20' },
  DEAD_LETTERED: { bg: 'bg-red-950/40', text: 'text-red-400', dot: 'bg-red-500', border: 'border-red-600/30' },
  dead_lettered: { bg: 'bg-red-950/40', text: 'text-red-400', dot: 'bg-red-500', border: 'border-red-600/30' },
  CANCELLED: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400', border: 'border-slate-500/20' },
  HEALTHY: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
  DEGRADED: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  OFFLINE: { bg: 'bg-slate-800', text: 'text-slate-400', dot: 'bg-slate-500', border: 'border-slate-700' },
  DRAINING: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  primary: { bg: 'bg-indigo-500/10', text: 'text-indigo-300', dot: 'bg-indigo-400', border: 'border-indigo-500/20' },
  default: { bg: 'bg-slate-800/80', text: 'text-slate-300', dot: 'bg-slate-400', border: 'border-slate-700' },
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className, dot = true }) => {
  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all duration-150',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)} />}
      {children}
    </span>
  );
};
