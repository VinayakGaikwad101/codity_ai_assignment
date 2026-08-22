import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { Layers, Play, Pause, Plus, RefreshCw, Gauge, Zap } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton.js';

export const QueuesView: React.FC = () => {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQueue, setNewQueue] = useState({
    name: '',
    description: '',
    priority: 50,
    concurrencyLimit: 10,
    rateLimitPerMin: 60,
  });

  const fetchQueues = async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const res: any = await apiClient.get('/queues');
      setQueues(res.data || []);
    } catch (err) {
      console.error('Failed to load queues:', err);
    } finally {
      setLoading(false);
      if (showSpin) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchQueues(false);
  }, []);

  const handleTogglePause = async (id: string, currentPaused: boolean) => {
    try {
      await apiClient.post(`/queues/${id}/pause`, { isPaused: !currentPaused });
      await fetchQueues(false);
    } catch (err) {
      console.error('Failed to toggle queue pause:', err);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      if (!projectId) return;

      await apiClient.post('/queues', {
        projectId,
        name: newQueue.name,
        description: newQueue.description,
        priority: Number(newQueue.priority),
        concurrencyLimit: Number(newQueue.concurrencyLimit),
        rateLimitPerMin: Number(newQueue.rateLimitPerMin),
      });

      setShowCreateModal(false);
      setNewQueue({ name: '', description: '', priority: 50, concurrencyLimit: 10, rateLimitPerMin: 60 });
      await fetchQueues(false);
    } catch (err: any) {
      alert(`Error creating queue: ${err.message || 'Validation error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Queue Management & Concurrency</h2>
          <p className="text-xs text-slate-400 mt-0.5">Control priority queues, concurrency limits, rate limiting, and execution gates</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchQueues(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-850 border border-slate-700/60 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 active:scale-[0.97] transition-all shadow-sm duration-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-medium transition-all shadow-md shadow-indigo-900/30 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Queue</span>
          </button>
        </div>
      </div>

      {/* Queues Cards */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queues.map((q) => {
            const stats = q.statistics || {};
            return (
              <div
                key={q.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-950/20 transition-all duration-200 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                        <Layers className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold font-mono text-slate-100 group-hover:text-indigo-400 transition-colors">{q.name}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                        q.isPaused
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{q.description || 'Standard background processing queue'}</p>
                </div>

                {/* Queue Limits */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-850/70 border border-slate-800/80 text-xs shadow-inner">
                  <div>
                    <div className="text-slate-500 flex items-center gap-1 font-medium">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Priority
                    </div>
                    <div className="font-mono font-bold text-slate-200 mt-1">{q.priority}/100</div>
                  </div>
                  <div>
                    <div className="text-slate-500 flex items-center gap-1 font-medium">
                      <Gauge className="w-3 h-3 text-indigo-400" />
                      Concurrency
                    </div>
                    <div className="font-mono font-bold text-slate-200 mt-1">{q.concurrencyLimit} slots</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Rate Limit</div>
                    <div className="font-mono font-bold text-slate-200 mt-1">{q.rateLimitPerMin ? `${q.rateLimitPerMin}/m` : 'Uncapped'}</div>
                  </div>
                </div>

                {/* Stats Counters */}
                <div className="grid grid-cols-4 gap-1 text-center text-xs pt-3 border-t border-slate-800/80">
                  <div>
                    <div className="text-slate-500 text-[11px]">Queued</div>
                    <div className="font-mono font-bold text-sky-400 mt-0.5">{stats.queuedCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Running</div>
                    <div className="font-mono font-bold text-amber-400 mt-0.5">{stats.runningCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Done</div>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">{stats.completedCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Failed</div>
                    <div className="font-mono font-bold text-rose-400 mt-0.5">{stats.failedCount ?? 0}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2">
                  <button
                    onClick={() => handleTogglePause(q.id, q.isPaused)}
                    className={`w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-medium active:scale-[0.98] transition-all cursor-pointer shadow-sm ${
                      q.isPaused
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50'
                    }`}
                  >
                    {q.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{q.isPaused ? 'Resume Queue' : 'Pause Queue'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Queue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Create New Queue</h3>
            <form onSubmit={handleCreateQueue} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400">Queue Name</label>
                <input
                  type="text"
                  required
                  value={newQueue.name}
                  onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
                  placeholder="e.g. transactional-notifications"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Description</label>
                <input
                  type="text"
                  value={newQueue.description}
                  onChange={(e) => setNewQueue({ ...newQueue, description: e.target.value })}
                  placeholder="Purpose of this queue"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400">Priority (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newQueue.priority}
                    onChange={(e) => setNewQueue({ ...newQueue, priority: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400">Concurrency Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newQueue.concurrencyLimit}
                    onChange={(e) => setNewQueue({ ...newQueue, concurrencyLimit: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-xs font-medium text-white shadow-md shadow-indigo-900/30 transition-all"
                >
                  Create Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
