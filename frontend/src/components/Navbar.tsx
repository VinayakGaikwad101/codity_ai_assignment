import React from 'react';
import { Activity, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  userRole?: string;
  userName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ isConnected, userRole = 'ADMIN', userName = 'Vinayak Gaikwad' }) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-semibold text-slate-100 text-sm tracking-tight flex items-center gap-2">
            Distributed Job Scheduler
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">v1.0.0</span>
          </h1>
          <p className="text-xs text-slate-400">High-Concurrency Asynchronous Task Platform</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Live WebSocket indicator */}
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{isConnected ? 'LIVE SYNC' : 'DISCONNECTED'}</span>
        </div>

        {/* Role badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
          <span className="font-mono">{userRole}</span>
        </div>

        {/* User profile */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
            {userName.charAt(0)}
          </div>
          <span className="text-xs font-medium text-slate-300 hidden sm:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
};
