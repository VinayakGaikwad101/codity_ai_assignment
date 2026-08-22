import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Layers,
  Plus,
  Play,
  Pause,
  RefreshCw,
  Gauge,
  Sliders,
  Check,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export const QueuesView: React.FC = () => {
  const { currentProject } = useAuth();
  const { subscribe } = useWebSocket();

  const [queues, setQueues] = useState<any[]>([]);
  const [retryPolicies, setRetryPolicies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [togglingQueueId, setTogglingQueueId] = useState<string | null>(null);

  // Create Queue Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 50,
    concurrencyLimit: 10,
    rateLimitPerMin: 300,
    retryPolicyId: '',
  });

  const fetchQueues = async (showToast = false) => {
    if (!currentProject) return;
    try {
      const [queuesData, policiesData] = await Promise.all([
        apiRequest<any[]>(`/queues?projectId=${currentProject.id}`),
        apiRequest<any[]>(`/retry-policies?projectId=${currentProject.id}`),
      ]);
      setQueues(queuesData);
      setRetryPolicies(policiesData);
      if (showToast) toast.success('Queues updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch queues');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchQueues();

    const unsubscribe = subscribe('queue:*', () => fetchQueues(false));
    return () => unsubscribe();
  }, [currentProject?.id]);

  const handleTogglePause = async (queue: any) => {
    setTogglingQueueId(queue.id);
    const newStatus = !queue.isPaused;
    try {
      await apiRequest(`/queues/${queue.id}/pause`, {
        method: 'POST',
        body: JSON.stringify({ isPaused: newStatus }),
      });
      toast.success(`Queue "${queue.name}" ${newStatus ? 'paused' : 'resumed'}`);
      await fetchQueues();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle queue execution gate');
    } finally {
      setTogglingQueueId(null);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    setIsSubmitting(true);
    try {
      await apiRequest('/queues', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProject.id,
          name: form.name.toLowerCase().trim().replace(/\s+/g, '-'),
          description: form.description,
          priority: Number(form.priority),
          concurrencyLimit: Number(form.concurrencyLimit),
          rateLimitPerMin: form.rateLimitPerMin ? Number(form.rateLimitPerMin) : undefined,
          retryPolicyId: form.retryPolicyId || undefined,
        }),
      });

      toast.success(`Queue "${form.name}" created successfully`);
      setIsCreateModalOpen(false);
      setForm({
        name: '',
        description: '',
        priority: 50,
        concurrencyLimit: 10,
        rateLimitPerMin: 300,
        retryPolicyId: '',
      });
      await fetchQueues();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Queues & Concurrency</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure priority weights, worker slot limits, rate limit thresholds, and pause/resume execution gates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchQueues(true);
            }}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Queue
          </Button>
        </div>
      </div>

      {/* Queues Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Queue Name</th>
                <th className="py-3.5 px-4 font-semibold">Priority</th>
                <th className="py-3.5 px-4 font-semibold">Concurrency Limit</th>
                <th className="py-3.5 px-4 font-semibold">Live Load</th>
                <th className="py-3.5 px-4 font-semibold">Gate Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : queues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No queues configured for this project yet. Click &quot;Create Queue&quot; to define your first queue!
                  </td>
                </tr>
              ) : (
                queues.map((q) => (
                  <tr key={q.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        {q.name}
                      </div>
                      {q.description && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-sm truncate">
                          {q.description}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {q.priority} / 100
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-300">
                      <span className="font-semibold text-white">{q.concurrencyLimit}</span> parallel slots
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-purple-400 font-semibold">
                            {q.statistics?.runningCount || 0} active
                          </span>
                          <span className="text-slate-500">|</span>
                          <span className="text-amber-400">
                            {q.statistics?.queuedCount || 0} queued
                          </span>
                        </div>
                        <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                (((q.statistics?.runningCount || 0) / (q.concurrencyLimit || 1)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={q.isPaused ? 'DEGRADED' : 'HEALTHY'}>
                        {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        variant={q.isPaused ? 'success' : 'secondary'}
                        size="sm"
                        onClick={() => handleTogglePause(q)}
                        isLoading={togglingQueueId === q.id}
                        leftIcon={q.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      >
                        {q.isPaused ? 'Resume' : 'Pause'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Queue Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Work Queue"
        description="Define a new asynchronous priority queue with concurrency limits"
      >
        <form onSubmit={handleCreateQueue} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Queue Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. invoice-generation"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="What kind of tasks run in this queue?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Priority (0 - 100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Higher values claimed first</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Concurrency Limit
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={form.concurrencyLimit}
                onChange={(e) => setForm({ ...form, concurrencyLimit: parseInt(e.target.value, 10) })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Max simultaneous jobs</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Retry Policy
            </label>
            <select
              value={form.retryPolicyId}
              onChange={(e) => setForm({ ...form, retryPolicyId: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Default (Exponential Backoff with Jitter)</option>
              {retryPolicies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.strategy}, max {p.maxRetries} retries)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Queue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
