import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
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
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

export const DlqView: React.FC = () => {
  const { currentProject } = useAuth();
  const { subscribe } = useWebSocket();

  const [entries, setEntries] = useState<any[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDlq = async (showToast = false, showLoader = false) => {
    if (!currentProject) return;
    if (showLoader) setIsLoading(true);

    try {
      const data = await apiRequest<{ items: any[]; total: number; totalPages: number }>(
        `/jobs/dlq?projectId=${currentProject.id}&page=${page}&limit=${limit}`
      );
      setEntries(data.items || []);
      setTotalEntries(data.total || 0);
      setTotalPages(data.totalPages || 1);

      if (showToast) toast.success('Dead Letter Queue updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch DLQ entries');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDlq(false, true);

    const unsubscribe = subscribe('job:*', () => fetchDlq(false, false));
    return () => unsubscribe();
  }, [currentProject?.id, page]);

  const handleReplay = async (entry: any) => {
    setReplayingId(entry.id);
    try {
      await apiRequest(`/jobs/dlq/${entry.id}/replay`, { method: 'POST' });
      toast.success(`Job "${entry.job?.name || 'Job'}" replayed and re-queued into worker pipeline!`);
      // Optimistically remove from active list
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setTotalEntries((prev) => Math.max(0, prev - 1));
      await fetchDlq(false, false);
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
            fetchDlq(true, true);
          }}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* DLQ Entries Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl min-h-[380px] flex flex-col justify-between">
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
                  <td colSpan={6} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" />
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-elevated/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{entries.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-white">{Math.min(page * limit, totalEntries)}</strong> of{' '}
            <strong className="text-white">{totalEntries}</strong> quarantined entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>

            <span className="px-3 py-1 bg-surface border border-surface-border rounded-lg text-xs font-mono font-bold text-white">
              {page} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
