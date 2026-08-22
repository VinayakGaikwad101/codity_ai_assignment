import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext.js';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { CardSkeleton } from '../components/ui/Skeleton.js';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const WorkersView: React.FC = () => {
  const { subscribe } = useWebSocket();
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchWorkers = async (showToast = false) => {
    try {
      const data = await apiRequest<any[]>('/workers');
      setWorkers(data);
      if (showToast) toast.success('Worker fleet metrics updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch worker fleet');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchWorkers();

    const unsubscribe = subscribe('worker:*', () => fetchWorkers(false));
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Worker Fleet</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry, active slot concurrency, CPU/RAM utilization, and heartbeat health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsRefreshing(true);
            fetchWorkers(true);
          }}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh Fleet
        </Button>
      </div>

      {/* Worker Fleet Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : workers.length === 0 ? (
          <div className="col-span-3 p-12 bg-surface border border-surface-border rounded-2xl text-center space-y-3">
            <Server className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Active Workers Registered</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Start background workers via <code className="text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded">npm run dev:worker</code> to begin claiming tasks.
            </p>
          </div>
        ) : (
          workers.map((worker) => {
            const cpu = worker.latestMetrics?.cpuUsage || 0;
            const memory = worker.latestMetrics?.memoryUsage || 0;
            const activeJobs = worker.activeJobsCount || 0;
            const concurrency = worker.concurrencyLimit || 5;
            const capacityPct = Math.min(100, Math.round((activeJobs / concurrency) * 100));

            return (
              <div
                key={worker.id}
                className="bg-surface border border-surface-border hover:border-slate-600 rounded-2xl p-5 space-y-5 transition-all duration-200 shadow-xl"
              >
                {/* Node Top info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
                      <Server className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{worker.hostname}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{worker.ipAddress || '127.0.0.1'}</p>
                    </div>
                  </div>
                  <Badge variant={worker.status}>{worker.status}</Badge>
                </div>

                {/* Slot Capacity Meter */}
                <div className="space-y-2 bg-surface-elevated/60 p-3.5 rounded-xl border border-surface-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      Slot Utilization
                    </span>
                    <span className="font-mono text-white font-bold">
                      {activeJobs} / {concurrency} slots ({capacityPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${capacityPct}%` }}
                    />
                  </div>
                </div>

                {/* Telemetry Meters (CPU & Memory) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-elevated/40 rounded-xl border border-surface-border/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" /> CPU
                      </span>
                      <span className="font-mono font-bold text-white">{cpu}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, cpu)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-surface-elevated/40 rounded-xl border border-surface-border/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> RAM
                      </span>
                      <span className="font-mono font-bold text-white">{memory}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, memory)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Telemetry */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-border/50 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Ping: {formatDistanceToNow(new Date(worker.lastHeartbeatAt), { addSuffix: true })}
                  </span>
                  <span className="font-mono">
                    Total Executed: <strong className="text-white">{worker.totalExecutionsCount}</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
