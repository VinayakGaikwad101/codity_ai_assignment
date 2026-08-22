import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Search,
  Server,
  Clock,
  AlertTriangle,
  Key,
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
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none">Job Scheduler</h1>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">Distributed Platform</span>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Modules
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
    </aside>
  );
};
