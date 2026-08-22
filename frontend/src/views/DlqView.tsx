import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Skull,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle,
  KeyRound,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const DlqView: React.FC = () => {
  const { currentProject } = useAuth();
  const { subscribe } = useWebSocket();

  const [dlqEntries, setDlqEntries] = useState<any[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [replayingIds, setReplayingIds] = useState<Set<string>>(new Set());

  // AI Failure Summaries State Map
  const [aiSummaries, setAiSummaries] = useState<Record<string, any>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [loadingAiIds, setLoadingAiIds] = useState<Set<string>>(new Set());

  const fetchDlq = async (showToast = false, showLoader = false) => {
    if (!currentProject) return;
    if (showLoader) setIsLoading(true);

    try {
      const data = await apiRequest<{ items: any[]; total: number; totalPages: number }>(
        `/jobs/dlq?projectId=${currentProject.id}&page=${page}&limit=${limit}`
      );
      setDlqEntries(data.items || []);
      setTotalEntries(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (showToast) toast.success('Dead letter queue refreshed');
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

  const handleReplay = async (id: string) => {
    setReplayingIds((prev) => new Set(prev).add(id));
    try {
      await apiRequest(`/jobs/dlq/${id}/replay`, { method: 'POST' });
      toast.success('Job removed from DLQ and re-queued for execution!');
      setDlqEntries((prev) => prev.filter((item) => item.id !== id));
      setTotalEntries((prev) => Math.max(0, prev - 1));
      fetchDlq(false, false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to replay job');
    } finally {
      setReplayingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleFetchAiSummary = async (id: string) => {
    setLoadingAiIds((prev) => new Set(prev).add(id));
    setExpandedId(id); // Auto-expand drawer
    setAiErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const data = await apiRequest<any>(`/jobs/dlq/${id}/ai-summary`);
      setAiSummaries((prev) => ({ ...prev, [id]: data }));
      toast.success('AI Failure Diagnosis Generated via LangChain');
    } catch (err: any) {
      const msg = err.message || 'Failed to generate AI failure diagnosis';
      setAiErrors((prev) => ({ ...prev, [id]: msg }));
      toast.error(msg);
    } finally {
      setLoadingAiIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const showSkeleton = isLoading || isRefreshing;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Skull className="w-6 h-6 text-rose-500" />
            Dead Letter Queue (Quarantine)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Quarantine area for permanently failed background jobs that exhausted all retry policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchDlq(true, false);
            }}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh DLQ
          </Button>
        </div>
      </div>

      {/* DLQ Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl min-h-[400px] flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold w-10"></th>
                <th className="py-3.5 px-4 font-semibold">Job Details</th>
                <th className="py-3.5 px-4 font-semibold">Queue</th>
                <th className="py-3.5 px-4 font-semibold">Failure Reason</th>
                <th className="py-3.5 px-4 font-semibold">Attempts</th>
                <th className="py-3.5 px-4 font-semibold">Quarantined</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {showSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : dlqEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400">
                    <div className="space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h4 className="text-base font-bold text-white">Quarantine Clean</h4>
                      <p className="text-xs text-slate-400">
                        No permanently failed jobs in the Dead Letter Queue for this project namespace.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                dlqEntries.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const isReplaying = replayingIds.has(item.id);
                  const aiSummary = aiSummaries[item.id];
                  const aiError = aiErrors[item.id];
                  const isLoadingAi = loadingAiIds.has(item.id);

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white max-w-xs truncate">{item.job?.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.job?.handlerType}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-mono font-medium text-slate-300">
                            {item.queue?.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                            <span className="text-xs text-rose-300 font-mono line-clamp-1">
                              {item.failureReason}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="FAILED">{item.totalAttempts} Retries</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {formatDistanceToNow(new Date(item.deadLetteredAt), { addSuffix: true })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFetchAiSummary(item.id)}
                              isLoading={isLoadingAi}
                              leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                            >
                              AI Diagnose
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleReplay(item.id)}
                              isLoading={isReplaying}
                              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                            >
                              Replay
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Drawer: AI Diagnosis & Exception Trace */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-t border-b border-surface-border">
                          <td colSpan={7} className="p-6 space-y-5">
                            {/* AI Diagnosis Shimmer Loader */}
                            {isLoadingAi && (
                              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-3 animate-pulse">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                    LangChain & Gemini LLM Analyzing Failure...
                                  </span>
                                </div>
                                <div className="h-4 bg-indigo-900/40 rounded w-3/4" />
                                <div className="h-4 bg-indigo-900/30 rounded w-1/2" />
                              </div>
                            )}

                            {/* Missing API Key / Error Alert */}
                            {aiError && (
                              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
                                <KeyRound className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <h5 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                                    AI Diagnosis Error
                                  </h5>
                                  <p className="text-xs text-rose-200">{aiError}</p>
                                </div>
                              </div>
                            )}

                            {/* AI Summary Card (When Generated) */}
                            {aiSummary && !isLoadingAi && (
                              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 space-y-3 shadow-xl">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                      LangChain AI Failure Diagnosis
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {aiSummary.category}
                                  </span>
                                </div>

                                <h4 className="text-sm font-bold text-white">
                                  {aiSummary.rootCause}
                                </h4>

                                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                  {aiSummary.explanation}
                                </p>

                                <div className="space-y-1.5 pt-2 border-t border-indigo-500/20">
                                  <span className="text-[11px] font-bold text-slate-300 block">
                                    Recommended Remediation Checklist:
                                  </span>
                                  <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                                    {aiSummary.recommendations.map((rec: string, idx: number) => (
                                      <li key={idx}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Raw Stack Trace Viewer */}
                            <div>
                              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                                Exception Stack Trace & Diagnostics
                              </span>
                              <pre className="p-4 bg-slate-950 border border-surface-border rounded-xl text-xs font-mono text-rose-400 overflow-x-auto max-h-48 leading-relaxed">
                                {item.stackTrace || item.failureReason || 'No stack trace captured.'}
                              </pre>
                            </div>

                            {/* Original Payload Viewer */}
                            <div>
                              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                                Original Input Payload
                              </span>
                              <pre className="p-3 bg-slate-950 border border-surface-border rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-32">
                                {JSON.stringify(item.originalPayload, null, 2)}
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
            {totalEntries > 0 ? (
              <>
                Showing <strong className="text-white">{(page - 1) * limit + 1}</strong> to{' '}
                <strong className="text-white">{Math.min(page * limit, totalEntries)}</strong> of{' '}
                <strong className="text-white">{totalEntries}</strong> quarantined entries
              </>
            ) : (
              <span>0 quarantined entries</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || showSkeleton || totalEntries === 0}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>

            <span className="px-3 py-1 bg-surface border border-surface-border rounded-lg text-xs font-mono font-bold text-white">
              {totalEntries > 0 ? `${page} / ${totalPages}` : '1 / 1'}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || showSkeleton || totalEntries === 0}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => Math.min(totalPages, p + 1));
              }}
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
