import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { Cpu, RefreshCw, Activity, HardDrive } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton.js';

export const WorkersView: React.FC = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWorkers = async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const res: any = await apiClient.get('/workers');
      setWorkers(res.data || []);
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
      if (showSpin) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchWorkers(false);
    const interval = setInterval(() => fetchWorkers(false), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Worker Fleet & Heartbeats</h2>
          <p className="text-xs text-slate-400 mt-0.5">Distributed execution nodes, live health pings, and concurrency slot loads</p>
        </div>
        <button
          onClick={() => fetchWorkers(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-850 border border-slate-700/60 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 active:scale-[0.97] transition-all shadow-sm duration-200 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && workers.length === 0 ? (
        <CardSkeleton count={2} />
      ) : workers.length === 0 ? (
        <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3 shadow-xl">
          <Cpu className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Active Worker Nodes Detected</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Launch worker processes via <code className="font-mono text-indigo-400">npm run dev:worker</code> to begin claiming and processing jobs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => {
            const isHealthy = worker.status === 'HEALTHY';
            const latestHeartbeat = worker.heartbeats?.[0];
            return (
              <div
                key={worker.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-950/20 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2.5 rounded-lg border ${
                        isHealthy
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500/20'
                      } transition-colors`}
                    >
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-mono text-slate-100 group-hover:text-indigo-400 transition-colors">{worker.hostname}</h3>
                      <div className="text-[10px] font-mono text-slate-500">{worker.id}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isHealthy
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {worker.status}
                  </span>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-850/70 border border-slate-800/80 text-xs shadow-inner">
                  <div>
                    <div className="text-slate-500 flex items-center gap-1 font-medium">
                      <Activity className="w-3 h-3 text-indigo-400" />
                      Active Load
                    </div>
                    <div className="font-mono font-bold text-slate-200 mt-1">
                      {worker.activeJobsCount} / {worker.concurrencyLimit} slots
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 flex items-center gap-1 font-medium">
                      <HardDrive className="w-3 h-3 text-amber-400" />
                      Memory Usage
                    </div>
                    <div className="font-mono font-bold text-slate-200 mt-1">
                      {latestHeartbeat ? `${latestHeartbeat.memoryUsage}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Worker Details Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>IP: {worker.ipAddress || '127.0.0.1'}</span>
                  <span>Ping: {new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
