import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

export const CronView: React.FC = () => {
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCron, setNewCron] = useState({
    name: '',
    queueId: '',
    cronExpression: '*/15 * * * *',
    timezone: 'UTC',
    handlerType: 'CUSTOM_COMPUTE',
    payloadJson: '{\n  "reportType": "automated_health"\n}',
  });

  const fetchCronJobs = async () => {
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      if (!projectId) return;

      const [cronRes, queuesRes]: any = await Promise.all([
        apiClient.get('/scheduled-jobs', { params: { projectId } }),
        apiClient.get('/queues'),
      ]);
      setCronJobs(cronRes.data || []);
      setQueues(queuesRes.data || []);
    } catch (err) {
      console.error('Failed to load scheduled cron jobs:', err);
    }
  };

  useEffect(() => {
    fetchCronJobs();
  }, []);

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await apiClient.patch(`/scheduled-jobs/${id}/toggle`, { isActive: !currentActive });
      await fetchCronJobs();
    } catch (err) {
      console.error('Failed to toggle cron job:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) return;
    try {
      await apiClient.delete(`/scheduled-jobs/${id}`);
      await fetchCronJobs();
    } catch (err) {
      console.error('Failed to delete scheduled job:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      const queueId = newCron.queueId || queues[0]?.id;

      let payload = {};
      try {
        payload = JSON.parse(newCron.payloadJson);
      } catch {
        alert('Invalid JSON in payload');
        return;
      }

      await apiClient.post('/scheduled-jobs', {
        projectId,
        queueId,
        name: newCron.name,
        cronExpression: newCron.cronExpression,
        timezone: newCron.timezone,
        handlerType: newCron.handlerType,
        payload,
      });

      setShowCreateModal(false);
      setNewCron({
        name: '',
        queueId: '',
        cronExpression: '*/15 * * * *',
        timezone: 'UTC',
        handlerType: 'CUSTOM_COMPUTE',
        payloadJson: '{\n  "reportType": "automated_health"\n}',
      });
      await fetchCronJobs();
    } catch (err: any) {
      alert(`Error creating scheduled job: ${err.message || 'Validation error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Recurring Scheduled Jobs (Cron)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Automated time-based recurring job dispatch with timezone support</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchCronJobs}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-850 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Cron Trigger</span>
          </button>
        </div>
      </div>

      {/* Cron Jobs Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-medium">Job Name</th>
                <th className="p-3 font-medium">Queue</th>
                <th className="p-3 font-medium">Cron Expression</th>
                <th className="p-3 font-medium">Timezone</th>
                <th className="p-3 font-medium">Next Run At</th>
                <th className="p-3 font-medium">Active</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cronJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No recurring scheduled cron jobs configured.
                  </td>
                </tr>
              ) : (
                cronJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/50">
                    <td className="p-3 font-medium text-slate-200">{job.name}</td>
                    <td className="p-3 font-mono text-slate-300">{job.queue?.name}</td>
                    <td className="p-3 font-mono font-bold text-brand-400">{job.cronExpression}</td>
                    <td className="p-3 font-mono text-slate-400">{job.timezone}</td>
                    <td className="p-3 font-mono text-slate-300">
                      {new Date(job.nextRunAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggle(job.id, job.isActive)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {job.isActive ? (
                          <ToggleRight className="w-6 h-6 text-brand-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Cron Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-semibold text-slate-100">Create Recurring Cron Trigger</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="font-medium text-slate-400">Trigger Name</label>
                <input
                  type="text"
                  required
                  value={newCron.name}
                  onChange={(e) => setNewCron({ ...newCron, name: e.target.value })}
                  placeholder="e.g. Daily Data Backup"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-400">Queue</label>
                  <select
                    value={newCron.queueId}
                    onChange={(e) => setNewCron({ ...newCron, queueId: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    {queues.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-400">Cron Expression</label>
                  <input
                    type="text"
                    required
                    value={newCron.cronExpression}
                    onChange={(e) => setNewCron({ ...newCron, cronExpression: e.target.value })}
                    placeholder="*/15 * * * *"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-brand-400 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-400">Payload JSON</label>
                <textarea
                  rows={3}
                  value={newCron.payloadJson}
                  onChange={(e) => setNewCron({ ...newCron, payloadJson: e.target.value })}
                  className="mt-1 w-full p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-500"
                >
                  Create Cron
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
