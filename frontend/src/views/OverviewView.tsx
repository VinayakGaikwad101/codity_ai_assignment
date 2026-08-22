import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { apiRequest } from '../api/client.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const OverviewView: React.FC<{ onNavigateTo: (tab: any) => void }> = ({ onNavigateTo }) => {
  const { currentProject } = useAuth();
  const { subscribe } = useWebSocket();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState({
    totalQueued: 0,
    totalRunning: 0,
    totalCompleted: 0,
    totalDlq: 0,
    activeWorkers: 0,
  });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);

  const fetchData = async (showToast = false) => {
    if (!currentProject) return;
    try {
      const [jobsData, queuesData, workersData, dlqData] = await Promise.all([
        apiRequest<{ items: any[]; total: number }>(`/jobs?projectId=${currentProject.id}&limit=6`),
        apiRequest<any[]>(`/queues?projectId=${currentProject.id}`),
        apiRequest<any[]>('/workers'),
        apiRequest<{ total: number }>(`/jobs/dlq?projectId=${currentProject.id}&limit=1`),
      ]);

      const queued = queuesData.reduce((acc, q) => acc + (q.statistics?.queuedCount || 0), 0);
      const running = queuesData.reduce((acc, q) => acc + (q.statistics?.runningCount || 0), 0);
      const completed = queuesData.reduce((acc, q) => acc + (q.statistics?.completedCount || 0), 0);
      const activeWorkersCount = workersData.filter((w) => w.status === 'HEALTHY').length;

      setStats({
        totalQueued: queued,
        totalRunning: running,
        totalCompleted: completed,
        totalDlq: dlqData.total || 0,
        activeWorkers: activeWorkersCount,
      });

      setRecentJobs(jobsData.items || []);
      setQueues(queuesData || []);

      if (showToast) {
        toast.success('Dashboard metrics synchronized');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch overview metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchData();

    // Subscribe to live WebSocket events for real-time overview updates
    const unsubscribeJobs = subscribe('job:*', () => fetchData(false));
    const unsubscribeWorkers = subscribe('worker:*', () => fetchData(false));
    const unsubscribeQueues = subscribe('queue:*', () => fetchData(false));

    return () => {
      unsubscribeJobs();
      unsubscribeWorkers();
      unsubscribeQueues();
    };
  }, [currentProject?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time metrics, queue health, and throughput for{' '}
            <span className="text-indigo-400 font-semibold">{currentProject?.name}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Sync Metrics
        </Button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Queued Jobs"
              value={stats.totalQueued}
              subtitle="Ready for worker claim"
              icon={<Clock className="w-5 h-5" />}
              variant="warning"
            />
            <StatCard
              title="Active In-Flight"
              value={stats.totalRunning}
              subtitle="Currently executing"
              icon={<Activity className="w-5 h-5" />}
              variant="purple"
            />
            <StatCard
              title="Completed Total"
              value={stats.totalCompleted}
              subtitle="Successfully processed"
              icon={<CheckCircle2 className="w-5 h-5" />}
              variant="success"
            />
            <StatCard
              title="Quarantined (DLQ)"
              value={stats.totalDlq}
              subtitle="Exhausted all retries"
              icon={<AlertTriangle className="w-5 h-5" />}
              variant={stats.totalDlq > 0 ? 'danger' : 'primary'}
            />
            <StatCard
              title="Active Workers"
              value={stats.activeWorkers}
              subtitle="Healthy fleet capacity"
              icon={<Server className="w-5 h-5" />}
              variant="primary"
            />
          </>
        )}
      </div>

      {/* Dual Section: Queue Concurrency vs Recent Execution Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue Health & Capacity Card */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Queue Backlog</h3>
            </div>
            <button
              onClick={() => onNavigateTo('queues')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              Configure <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-surface-elevated rounded-lg space-y-2">
                  <div className="skeleton-shimmer h-4 w-32 rounded" />
                  <div className="skeleton-shimmer h-3 w-full rounded" />
                </div>
              ))
            ) : queues.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No queues defined yet.</p>
            ) : (
              queues.map((q) => (
                <div
                  key={q.id}
                  className="p-3 bg-surface-elevated/70 border border-surface-border/50 rounded-xl space-y-2 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{q.name}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      Pri: {q.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Active: <strong className="text-slate-200">{q.statistics?.runningCount || 0}</strong> / {q.concurrencyLimit} slots
                    </span>
                    <span>
                      Queued: <strong className="text-amber-400">{q.statistics?.queuedCount || 0}</strong>
                    </span>
                  </div>
                  {/* Concurrency progress bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (((q.statistics?.runningCount || 0) / (q.concurrencyLimit || 1)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Execution Stream */}
        <div className="lg:col-span-2 bg-surface border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Job Stream</h3>
            </div>
            <button
              onClick={() => onNavigateTo('jobs')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-surface-border">
                  <th className="pb-3 font-semibold">Job Name</th>
                  <th className="pb-3 font-semibold">Queue</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Attempts</th>
                  <th className="pb-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                ) : recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No jobs recorded yet. Ingest immediate or batch jobs to get started!
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="py-3 font-medium text-white max-w-[200px] truncate">
                        {job.name}
                      </td>
                      <td className="py-3 text-slate-300 font-mono">{job.queue?.name}</td>
                      <td className="py-3">
                        <Badge variant={job.status}>{job.status}</Badge>
                      </td>
                      <td className="py-3 text-slate-300">
                        {job.retryCount > 0 ? (
                          <span className="text-amber-400 font-semibold">#{job.retryCount + 1}</span>
                        ) : (
                          '1'
                        )}
                      </td>
                      <td className="py-3 text-slate-400">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
