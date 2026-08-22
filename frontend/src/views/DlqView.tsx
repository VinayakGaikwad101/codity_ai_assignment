import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Clock,
  Terminal,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

export const DlqView: React.FC = () => {
  const { currentProject } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDlq = async (showToast = false) => {
    if (!currentProject) return;
    try {
      const data = await apiRequest<{ items: any[]; total: number }>(
        `/jobs/dlq?projectId=${currentProject.id}`
      );
      setEntries(data.items || []);
      if (showToast) toast.success('Dead Letter Queue updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch DLQ entries');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchDlq();
  }, [currentProject?.id]);

  const handleReplay = async (entry: any) => {
    setReplayingId(entry.id);
    try {
      await apiRequest(`/jobs/dlq/${entry.id}/replay`, { method: 'POST' });
      toast.success(`Job "${entry.job?.name || 'Job'}" replayed and re-queued!`);
      await fetchDlq();
    } catch (err: any) {
      toast.error(err.message || 'Failed to replay dead lettered job');
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            Dead Letter Queue (DLQ) Quarantine
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Quarantined jobs that exhausted all retry policies with diagnostic error payloads
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsRefreshing(true);
            fetchDlq(true);
          }}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* DLQ Entries Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Job Name</th>
                <th className="py-3.5 px-4 font-semibold">Queue</th>
                <th className="py-3.5 px-4 font-semibold">Failure Reason</th>
                <th className="py-3.5 px-4 font-semibold">Attempts</th>
                <th className="py-3.5 px-4 font-semibold">Dead Lettered At</th>
                <th className="py-3.5 px-4 font-semibold text-right">Replay Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        ✓
                      </div>
                      <span className="text-sm font-bold text-slate-200">Dead Letter Queue is Clean</span>
                      <span className="text-xs text-slate-500">All background jobs are processing normally without unrecoverable errors.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-white max-w-xs truncate">
                            {entry.job?.name || 'Unknown Job'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>{entry.jobId}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-300">
                          {entry.queue?.name}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-rose-400 font-medium max-w-xs truncate">
                              {entry.failureReason}
                            </span>
                            {entry.stackTrace && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                className="text-slate-400 hover:text-white p-1 rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                                title="Toggle Stack Trace"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {entry.totalAttempts}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-400">
                          {format(new Date(entry.deadLetteredAt), 'MMM dd, HH:mm:ss')}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReplay(entry)}
                            isLoading={replayingId === entry.id}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          >
                            Replay
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && entry.stackTrace && (
                        <tr className="bg-slate-950/70 border-b border-surface-border">
                          <td colSpan={6} className="p-4">
                            <div className="p-3 bg-slate-950 border border-rose-900/30 rounded-xl space-y-2">
                              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5" /> Exception Stack Trace
                              </span>
                              <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {entry.stackTrace}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
