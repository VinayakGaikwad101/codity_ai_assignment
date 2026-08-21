import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ListTodo,
  Cpu,
  Clock,
  AlertOctagon,
  Key,
} from 'lucide-react';

export type NavTab = 'overview' | 'queues' | 'jobs' | 'workers' | 'cron' | 'dlq' | 'api-keys';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  dlqCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, dlqCount = 0 }) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'queues' as NavTab, label: 'Queues & Concurrency', icon: Layers },
    { id: 'jobs' as NavTab, label: 'Job Explorer', icon: ListTodo },
    { id: 'workers' as NavTab, label: 'Worker Fleet', icon: Cpu },
    { id: 'cron' as NavTab, label: 'Scheduled (Cron)', icon: Clock },
    { id: 'dlq' as NavTab, label: 'Dead Letter Queue', icon: AlertOctagon, badge: dlqCount },
    { id: 'api-keys' as NavTab, label: 'API Keys & Access', icon: Key },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Control Plane
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
        <div className="text-xs font-medium text-slate-300">Atomic Engine</div>
        <div className="text-xs text-slate-500 mt-0.5">PostgreSQL SKIP LOCKED active with full multi-worker safety</div>
      </div>
    </aside>
  );
};
