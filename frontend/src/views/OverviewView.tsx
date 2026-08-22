import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Layers,
  Cpu,
  TrendingUp,
  Percent,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Skeleton, TableSkeleton } from '../components/Skeleton.js';

export const OverviewView: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [throughput, setThroughput] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [metricsRes, throughputRes, queuesRes]: any = await Promise.all([
        apiClient.get('/metrics/overview'),
        apiClient.get('/metrics/throughput'),
        apiClient.get('/queues'),
      ]);
      setMetrics(metricsRes.data);
      setThroughput(throughputRes.data || []);
      setQueues(queuesRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Active Queues',
      value: metrics?.totalQueues || 0,
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      title: 'Healthy Workers',
      value: metrics?.activeWorkers || 0,
      icon: Cpu,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Running Jobs',
      value: metrics?.jobsRunning || 0,
      icon: PlayCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Queued Backlog',
      value: metrics?.jobsQueued || 0,
      icon: Clock,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      title: 'Total Processed',
      value: metrics?.totalJobsProcessed || 0,
      icon: CheckCircle2,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      title: 'Dead Lettered (DLQ)',
      value: metrics?.jobsDeadLettered || 0,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
    {
      title: 'Success Rate',
      value: `${metrics?.overallSuccessRate ?? 100}%`,
      icon: Percent,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">System Dashboard & Health</h2>
        <p className="text-xs text-slate-400 mt-0.5">Real-time distributed queue throughput and node utilization</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {loading && !metrics
          ? Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </div>
            ))
          : statCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{card.title}</span>
                    <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-2">{card.value}</div>
                </div>
              );
            })}
      </div>

      {/* Throughput Chart */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Job Execution Throughput (Last 24 Hours)
            </h3>
            <p className="text-xs text-slate-500">Hourly completed vs failed job attempts</p>
          </div>
        </div>

        <div className="h-64 w-full">
          {loading && throughput.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput}>
                <defs>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#completedGrad)"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#f43f5e"
                  fillOpacity={1}
                  fill="url(#failedGrad)"
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Active Queues Summary */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Live Queues Status</h3>
        {loading && queues.length === 0 ? (
          <TableSkeleton rows={3} cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="p-3.5">Queue Name</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Concurrency</th>
                  <th className="p-3.5">State</th>
                  <th className="p-3.5">Queued</th>
                  <th className="p-3.5">Running</th>
                  <th className="p-3.5">Completed</th>
                  <th className="p-3.5">Failed</th>
                  <th className="p-3.5">Avg Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {queues.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="p-3.5 font-mono font-medium text-slate-200">{q.name}</td>
                    <td className="p-3.5 font-mono">{q.priority}</td>
                    <td className="p-3.5 font-mono">{q.concurrencyLimit}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          q.isPaused
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-sky-400">{q.statistics?.queuedCount ?? 0}</td>
                    <td className="p-3.5 font-mono text-amber-400">{q.statistics?.runningCount ?? 0}</td>
                    <td className="p-3.5 font-mono text-emerald-400">{q.statistics?.completedCount ?? 0}</td>
                    <td className="p-3.5 font-mono text-rose-400">{q.statistics?.failedCount ?? 0}</td>
                    <td className="p-3.5 font-mono text-slate-400">{q.statistics?.avgDurationMs ?? 0}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
