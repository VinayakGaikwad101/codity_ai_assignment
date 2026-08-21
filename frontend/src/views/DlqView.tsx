import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { AlertOctagon, RotateCcw, RefreshCw } from 'lucide-react';

export const DlqView: React.FC = () => {
  const [dlqItems, setDlqItems] = useState<any[]>([]);

  const fetchDlq = async () => {
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      if (!projectId) return;

      const res: any = await apiClient.get('/jobs/dlq', { params: { projectId } });
      setDlqItems(res.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch DLQ items:', err);
    }
  };

  useEffect(() => {
    fetchDlq();
    const interval = setInterval(fetchDlq, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleReplay = async (id: string) => {
    try {
      await apiClient.post(`/jobs/dlq/${id}/replay`);
      await fetchDlq();
    } catch (err: any) {
      alert(`Error replaying DLQ job: ${err.message || 'Action failed'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Dead Letter Queue (DLQ) Quarantine</h2>
          <p className="text-xs text-slate-400 mt-0.5">Quarantined jobs that exhausted all retry policies with diagnostic error payloads</p>
        </div>
        <button
          onClick={fetchDlq}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-850 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* DLQ Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-medium">Job Name</th>
                <th className="p-3 font-medium">Queue</th>
                <th className="p-3 font-medium">Failure Reason</th>
                <th className="p-3 font-medium">Attempts</th>
                <th className="p-3 font-medium">Dead Lettered At</th>
                <th className="p-3 font-medium text-right">Replay Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dlqItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertOctagon className="w-6 h-6 text-slate-600" />
                      <div>No quarantined jobs in Dead Letter Queue. Everything is operating cleanly.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                dlqItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-medium text-slate-200">{item.job?.name || 'Unnamed Job'}</div>
                      <div className="font-mono text-slate-500 text-[10px]">{item.jobId}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{item.queue?.name}</td>
                    <td className="p-3 max-w-xs">
                      <div className="text-rose-400 font-mono truncate">{item.failureReason}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{item.totalAttempts}</td>
                    <td className="p-3 font-mono text-slate-400">
                      {new Date(item.deadLetteredAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplay(item.id);
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30 text-xs ml-auto"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Replay</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
