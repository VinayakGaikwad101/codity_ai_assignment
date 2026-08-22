import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

export const CronView: React.FC = () => {
  const { currentProject } = useAuth();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    queueId: '',
    handlerType: 'SYSTEM_HEALTH_CHECK',
    cronExpression: '0 * * * *',
    timezone: 'UTC',
    payloadText: '{\n  "checkDatabase": true\n}',
  });

  const fetchSchedules = async (showToast = false) => {
    if (!currentProject) return;
    try {
      const [schedRes, queuesRes] = await Promise.all([
        apiRequest<any[]>(`/scheduled-jobs?projectId=${currentProject.id}`),
        apiRequest<any[]>(`/queues?projectId=${currentProject.id}`),
      ]);

      setSchedules(schedRes);
      setQueues(queuesRes);

      if (queuesRes.length > 0 && !form.queueId) {
        setForm((prev) => ({ ...prev, queueId: queuesRes[0].id }));
      }

      if (showToast) toast.success('Scheduled cron triggers refreshed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch schedules');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchSchedules();
  }, [currentProject?.id]);

  const handleToggle = async (sched: any) => {
    setTogglingId(sched.id);
    const newActive = !sched.isActive;
    try {
      await apiRequest(`/scheduled-jobs/${sched.id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newActive }),
      });
      toast.success(`Schedule "${sched.name}" ${newActive ? 'activated' : 'paused'}`);
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle schedule');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await apiRequest(`/scheduled-jobs/${id}`, { method: 'DELETE' });
      toast.success('Schedule deleted');
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete schedule');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    let payload = {};
    try {
      payload = JSON.parse(form.payloadText);
    } catch {
      toast.error('Invalid JSON payload');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/scheduled-jobs', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProject.id,
          queueId: form.queueId,
          name: form.name,
          handlerType: form.handlerType,
          cronExpression: form.cronExpression,
          timezone: form.timezone,
          payload,
        }),
      });

      toast.success(`Scheduled job "${form.name}" created!`);
      setIsCreateModalOpen(false);
      setForm({
        name: '',
        queueId: queues[0]?.id || '',
        handlerType: 'SYSTEM_HEALTH_CHECK',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        payloadText: '{\n  "checkDatabase": true\n}',
      });
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetExpressions = [
    { label: 'Every 5 Mins', expr: '*/5 * * * *' },
    { label: 'Hourly', expr: '0 * * * *' },
    { label: 'Daily (Midnight)', expr: '0 0 * * *' },
    { label: 'Weekly (Sun)', expr: '0 0 * * 0' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Scheduled (Cron) Jobs</h2>
          <p className="text-sm text-slate-400 mt-1">
            Automate recurring background task execution with standard 5-part cron syntax
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchSchedules(true);
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
            New Schedule
          </Button>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Schedule Name</th>
                <th className="py-3.5 px-4 font-semibold">Cron Expression</th>
                <th className="py-3.5 px-4 font-semibold">Queue</th>
                <th className="py-3.5 px-4 font-semibold">Next Run</th>
                <th className="py-3.5 px-4 font-semibold">State</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No recurring cron schedules created for this project yet.
                  </td>
                </tr>
              ) : (
                schedules.map((sched) => (
                  <tr key={sched.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        {sched.name}
                      </div>
                      <span className="text-[11px] font-mono text-indigo-400">
                        {sched.handlerType}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-amber-300">
                        {sched.cronExpression}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-300">
                      {sched.queue?.name}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div className="text-white font-medium">
                        {format(new Date(sched.nextRunAt), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        ({formatDistanceToNow(new Date(sched.nextRunAt), { addSuffix: true })})
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={sched.isActive ? 'HEALTHY' : 'OFFLINE'}>
                        {sched.isActive ? 'ACTIVE' : 'PAUSED'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={sched.isActive ? 'secondary' : 'success'}
                          size="sm"
                          onClick={() => handleToggle(sched)}
                          isLoading={togglingId === sched.id}
                        >
                          {sched.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sched.id, sched.name)}
                          className="hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Cron Schedule Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Recurring Cron Trigger"
        description="Schedule periodic background job execution using cron expressions"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Schedule Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Daily Metrics Rollup"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                value={form.queueId}
                onChange={(e) => setForm({ ...form, queueId: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
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
                value={form.handlerType}
                onChange={(e) => setForm({ ...form, handlerType: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500 font-mono text-xs"
              >
                <option value="SYSTEM_HEALTH_CHECK">SYSTEM_HEALTH_CHECK</option>
                <option value="HOURLY_RECON">HOURLY_RECON</option>
                <option value="LEDGER_SETTLEMENT">LEDGER_SETTLEMENT</option>
                <option value="SEND_NOTIFICATION">SEND_NOTIFICATION</option>
                <option value="HTTP_WEBHOOK">HTTP_WEBHOOK</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Cron Expression (5 Fields) *
              </label>
              <div className="flex items-center gap-1">
                {presetExpressions.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setForm({ ...form, cronExpression: p.expr })}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated hover:bg-slate-700 text-indigo-300 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              placeholder="* * * * *"
              value={form.cronExpression}
              onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-amber-300 font-mono text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              JSON Payload
            </label>
            <textarea
              rows={3}
              value={form.payloadText}
              onChange={(e) => setForm({ ...form, payloadText: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-emerald-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
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
              Create Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
