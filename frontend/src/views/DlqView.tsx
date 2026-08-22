import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { AlertOctagon, RotateCcw, RefreshCw, X, FileText } from 'lucide-react';

export const DlqView: React.FC = () => {
  const [dlqItems, setDlqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const fetchDlq = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/jobs/dlq');
      setDlqItems(res.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch DLQ items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDlq();
    const interval = setInterval(fetchDlq, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleReplay = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReplayingId(id);
    try {
      await apiClient.post(`/jobs/dlq/${id}/replay`);
      await fetchDlq();
    } catch (err: any) {
      alert(`Error replaying DLQ job: ${err.message || 'Action failed'}`);
    } finally {
      setReplayingId(null);
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
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-850 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
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
                    onClick={() => setSelectedEntry(item)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
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
                        onClick={(e) => handleReplay(item.id, e)}
                        disabled={replayingId === item.id}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30 text-xs ml-auto transition-colors"
                      >
                        <RotateCcw className={`w-3 h-3 ${replayingId === item.id ? 'animate-spin' : ''}`} />
                        <span>{replayingId === item.id ? 'Replaying...' : 'Replay'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected DLQ Inspection Drawer */}
      {selectedEntry && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-slate-900 border-l border-slate-800 z-50 p-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-rose-400">Quarantined DLQ Record</span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedEntry.job?.name}</h3>
                <div className="font-mono text-xs text-slate-500 mt-0.5">{selectedEntry.jobId}</div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Failure Reason */}
            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1.5 text-xs">
              <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Failure Reason Diagnostic
              </div>
              <div className="font-mono text-slate-200 break-words">{selectedEntry.failureReason}</div>
            </div>

            {/* Original Payload */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-500" />
                Original Job Payload Dump
              </h4>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(selectedEntry.originalPayload, null, 2)}
              </pre>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex space-x-3">
            <button
              onClick={(e) => {
                handleReplay(selectedEntry.id, e);
                setSelectedEntry(null);
              }}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay & Re-enqueue Now</span>
            </button>
            <button
              onClick={() => setSelectedEntry(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
