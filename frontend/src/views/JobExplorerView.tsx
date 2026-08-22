import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  RotateCcw,
  Ban,
  Clock,
  Terminal,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const JobExplorerView: React.FC = () => {
  const { currentProject } = useAuth();
  const { subscribe } = useWebSocket();

  const [jobs, setJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Detail Modal State
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Ingest Job Modal State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    name: '',
    queueId: '',
    handlerType: 'LEDGER_SETTLEMENT',
    jobType: 'IMMEDIATE',
    delayMs: 0,
    priority: 50,
    payloadText: '{\n  "amount": 500,\n  "currency": "USD"\n}',
    idempotencyKey: '',
  });

  const isInitialLoad = useRef(true);

  const fetchJobs = async (showToast = false, showFullLoader = false) => {
    if (!currentProject) return;
    if (showFullLoader) setIsLoading(true);

    try {
      let url = `/jobs?projectId=${currentProject.id}&page=${page}&limit=${limit}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const [jobsRes, queuesRes] = await Promise.all([
        apiRequest<{ items: any[]; total: number; totalPages: number }>(url),
        apiRequest<any[]>(`/queues?projectId=${currentProject.id}`),
      ]);

      setJobs(jobsRes.items || []);
      setTotalJobs(jobsRes.total || 0);
      setTotalPages(jobsRes.totalPages || 1);
      setQueues(queuesRes || []);

      if (queuesRes.length > 0 && !ingestForm.queueId) {
        setIngestForm((prev) => ({ ...prev, queueId: queuesRes[0].id }));
      }

      if (showToast) toast.success('Job list refreshed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch jobs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isInitialLoad.current = false;
    }
  };

  useEffect(() => {
    fetchJobs(false, true);

    // Auto-update list in real time whenever worker completes/updates a job
    const unsubscribe = subscribe('job:*', () => fetchJobs(false, false));
    return () => unsubscribe();
  }, [currentProject?.id, page, statusFilter]);

  const handleOpenDetail = async (jobId: string) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const data = await apiRequest(`/jobs/${jobId}`);
      setSelectedJob(data);
    } catch (err: any) {
      toast.error('Failed to load job details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await apiRequest(`/jobs/${jobId}/cancel`, { method: 'POST' });
      toast.success('Job cancelled');
      await fetchJobs();
      if (selectedJob?.id === jobId) handleOpenDetail(jobId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel job');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await apiRequest(`/jobs/${jobId}/retry`, { method: 'POST' });
      toast.success('Job re-queued successfully');
      await fetchJobs();
      if (selectedJob?.id === jobId) handleOpenDetail(jobId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry job');
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(ingestForm.payloadText);
    } catch {
      toast.error('Invalid JSON payload');
      return;
    }

    setIsIngesting(true);
    try {
      await apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProject.id,
          queueId: ingestForm.queueId,
          name: ingestForm.name,
          handlerType: ingestForm.handlerType,
          jobType: ingestForm.jobType,
          delayMs: ingestForm.jobType === 'DELAYED' ? Number(ingestForm.delayMs) : undefined,
          priority: Number(ingestForm.priority),
          payload: parsedPayload,
          idempotencyKey: ingestForm.idempotencyKey || undefined,
        }),
      });

      toast.success(`Job "${ingestForm.name}" ingested into queue!`);
      setIsIngestModalOpen(false);
      setIngestForm({
        name: '',
        queueId: queues[0]?.id || '',
        handlerType: 'LEDGER_SETTLEMENT',
        jobType: 'IMMEDIATE',
        delayMs: 0,
        priority: 50,
        payloadText: '{\n  "amount": 500,\n  "currency": "USD"\n}',
        idempotencyKey: '',
      });
      await fetchJobs(false, true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to ingest job');
    } finally {
      setIsIngesting(false);
    }
  };

  const statusTabs = [
    'ALL',
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'DEAD_LETTERED',
    'SCHEDULED',
    'CANCELLED',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Job Explorer</h2>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, inspect execution logs, and monitor background tasks across all queues
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchJobs(true, true);
            }}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsIngestModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Ingest Job
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-3 rounded-xl border border-surface-border">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by job name or UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                fetchJobs(false, true);
              }
            }}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl min-h-[380px] flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Job Details</th>
                <th className="py-3.5 px-4 font-semibold">Queue</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Priority</th>
                <th className="py-3.5 px-4 font-semibold">Attempts</th>
                <th className="py-3.5 px-4 font-semibold">Timeline</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No jobs match the current filter <span className="text-indigo-400 font-semibold">&quot;{statusFilter}&quot;</span>.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white max-w-xs truncate">{job.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{job.id}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-indigo-400 font-semibold">{job.handlerType}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono font-medium text-slate-300">
                        {job.queue?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={job.status}>{job.status}</Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {job.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {job.retryCount > 0 ? (
                        <span className="text-amber-400 font-bold">
                          #{job.retryCount + 1} / {job.maxRetries + 1}
                        </span>
                      ) : (
                        '1 / ' + (job.maxRetries + 1)
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(job.id)}
                          title="View Execution History & Logs"
                        >
                          <Eye className="w-4 h-4 text-indigo-400" />
                        </Button>
                        {(job.status === 'FAILED' || job.status === 'DEAD_LETTERED' || job.status === 'CANCELLED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetryJob(job.id)}
                            title="Re-queue Job"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-400" />
                          </Button>
                        )}
                        {(job.status === 'QUEUED' || job.status === 'SCHEDULED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelJob(job.id)}
                            title="Cancel Job"
                          >
                            <Ban className="w-4 h-4 text-rose-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-elevated/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{jobs.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-white">{Math.min(page * limit, totalJobs)}</strong> of{' '}
            <strong className="text-white">{totalJobs}</strong> jobs
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

      {/* Job Details Modal with Logs */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedJob ? `Job: ${selectedJob.name}` : 'Job Details'}
        description={selectedJob ? `UUID: ${selectedJob.id}` : ''}
        maxWidth="2xl"
      >
        {isLoadingDetail || !selectedJob ? (
          <div className="space-y-4 py-6">
            <div className="skeleton-shimmer h-6 w-48 rounded" />
            <div className="skeleton-shimmer h-32 w-full rounded" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-elevated rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                <div className="mt-1">
                  <Badge variant={selectedJob.status}>{selectedJob.status}</Badge>
                </div>
              </div>
              <div className="p-3 bg-surface-elevated rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Queue</span>
                <p className="text-xs font-mono font-bold text-white mt-1 truncate">
                  {selectedJob.queue?.name}
                </p>
              </div>
              <div className="p-3 bg-surface-elevated rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Handler</span>
                <p className="text-xs font-mono font-bold text-indigo-400 mt-1">
                  {selectedJob.handlerType}
                </p>
              </div>
              <div className="p-3 bg-surface-elevated rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Worker</span>
                <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                  {selectedJob.claimedByWorker?.hostname || 'None'}
                </p>
              </div>
            </div>

            {/* Payload & Result Viewers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Job Payload
                </span>
                <pre className="p-3 bg-slate-950 border border-surface-border rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-36">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Execution Result
                </span>
                <pre className="p-3 bg-slate-950 border border-surface-border rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-36">
                  {selectedJob.result ? JSON.stringify(selectedJob.result, null, 2) : 'null'}
                </pre>
              </div>
            </div>

            {/* Execution Attempts & Streamed Logs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Live Execution Logs & Attempts
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-surface-border rounded-xl space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
                {selectedJob.jobLogs?.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No logs recorded yet.</p>
                ) : (
                  selectedJob.jobLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 text-[10px] flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1 rounded ${
                          log.level === 'ERROR'
                            ? 'bg-rose-950 text-rose-400'
                            : log.level === 'WARN'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-indigo-950 text-indigo-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Ingest Job Modal */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title="Ingest Background Job"
        description="Dispatch an asynchronous task to the distributed worker fleet"
        maxWidth="lg"
      >
        <form onSubmit={handleIngestSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Job Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Settle Ledger Transaction TX_9901"
              value={ingestForm.name}
              onChange={(e) => setIngestForm({ ...ingestForm, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Target Queue *
              </label>
              <select
                required
                value={ingestForm.queueId}
                onChange={(e) => setIngestForm({ ...ingestForm, queueId: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} (Pri: {q.priority})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Handler Type *
              </label>
              <select
                required
                value={ingestForm.handlerType}
                onChange={(e) => setIngestForm({ ...ingestForm, handlerType: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500 font-mono text-xs"
              >
                <option value="LEDGER_SETTLEMENT">LEDGER_SETTLEMENT</option>
                <option value="SEND_NOTIFICATION">SEND_NOTIFICATION</option>
                <option value="SEND_EMAIL">SEND_EMAIL</option>
                <option value="KYC_VERIFY">KYC_VERIFY</option>
                <option value="SYSTEM_HEALTH_CHECK">SYSTEM_HEALTH_CHECK</option>
                <option value="HOURLY_RECON">HOURLY_RECON</option>
                <option value="HTTP_WEBHOOK">HTTP_WEBHOOK</option>
                <option value="FAILING_TASK">FAILING_TASK (Retry/DLQ Test)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Job Type
              </label>
              <select
                value={ingestForm.jobType}
                onChange={(e) => setIngestForm({ ...ingestForm, jobType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="IMMEDIATE">IMMEDIATE</option>
                <option value="DELAYED">DELAYED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Delay (ms)
              </label>
              <input
                type="number"
                disabled={ingestForm.jobType !== 'DELAYED'}
                value={ingestForm.delayMs}
                onChange={(e) => setIngestForm({ ...ingestForm, delayMs: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Priority
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={ingestForm.priority}
                onChange={(e) => setIngestForm({ ...ingestForm, priority: parseInt(e.target.value, 10) || 50 })}
                className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              JSON Payload
            </label>
            <textarea
              rows={4}
              value={ingestForm.payloadText}
              onChange={(e) => setIngestForm({ ...ingestForm, payloadText: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-emerald-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Idempotency Key (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. tx_order_8821"
              value={ingestForm.idempotencyKey}
              onChange={(e) => setIngestForm({ ...ingestForm, idempotencyKey: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsIngestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isIngesting}>
              Ingest Job
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
