import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Search,
  Server,
  Clock,
  AlertTriangle,
  Key,
  Shield,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

export type TabType = 'overview' | 'queues' | 'jobs' | 'workers' | 'cron' | 'dlq' | 'apikeys';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  dlqCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  dlqCount = 0,
}) => {
  const navItems = [
    { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
    { id: 'queues' as TabType, label: 'Queues & Concurrency', icon: Layers },
    { id: 'jobs' as TabType, label: 'Job Explorer', icon: Search },
    { id: 'workers' as TabType, label: 'Worker Fleet', icon: Server },
    { id: 'cron' as TabType, label: 'Scheduled (Cron)', icon: Clock },
    { id: 'dlq' as TabType, label: 'Dead Letter Queue', icon: AlertTriangle, badge: dlqCount },
    { id: 'apikeys' as TabType, label: 'API Keys & Access', icon: Key },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-surface-border flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-surface-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">Distributed Scheduler</h1>
          <span className="text-[11px] text-slate-400 font-mono">v1.0.0 (SKIP LOCKED)</span>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Control Plane
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/70'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={clsx(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Engine Architecture Indicator */}
      <div className="p-4 m-3 bg-surface-elevated/50 border border-surface-border rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>Atomic Engine</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          PostgreSQL <code className="text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded">SKIP LOCKED</code> active with multi-worker safety
        </p>
      </div>
    </aside>
  );
};
