import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useWebSocket } from '../../context/WebSocketContext.js';
import { LogOut, Building2 } from 'lucide-react';
import { clsx } from 'clsx';

interface HeaderProps {
  onOpenProjectModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProjectModal }) => {
  const { user, currentProject, projects, setCurrentProject, logout } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-surface-border px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Project Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated border border-surface-border rounded-xl">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-400">Project:</span>
          <select
            value={currentProject?.id || ''}
            onChange={(e) => {
              const selected = projects.find((p) => p.id === e.target.value);
              if (selected) setCurrentProject(selected);
            }}
            className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-2"
          >
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id} className="bg-surface text-white">
                {proj.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenProjectModal}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
        >
          + New Project
        </button>
      </div>

      {/* Right Controls: Live Sync Pulse & User Badge */}
      <div className="flex items-center gap-4">
        {/* WebSocket Live Status */}
        <div
          className={clsx(
            'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          )}
        >
          <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400')} />
          <span>{isConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 pl-4 border-l border-surface-border">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'V'}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-white leading-tight">{user?.name || 'Vinayak Gaikwad'}</div>
            <div className="text-[10px] text-slate-400 font-medium tracking-wide">
              {user?.role === 'ADMIN' ? 'Administrator' : user?.role || 'Operator'}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
