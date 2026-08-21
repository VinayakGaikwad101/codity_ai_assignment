import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import {
  Plus,
  RefreshCw,
  Search,
  RotateCcw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Terminal,
  Sparkles,
  X,
} from 'lucide-react';

export const JobsView: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [aiSummary, setAiSummary] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit Job Form State
  const [submitForm, setSubmitForm] = useState({
    name: '',
    queueId: '',
    handlerType: 'CUSTOM_COMPUTE',
    jobType: 'IMMEDIATE',
    priority: 50,
    delaySeconds: 0,
    payloadJson: '{\n  "message": "Hello from background scheduler",\n  "shouldFail": false\n}',
  });

  const fetchJobs = async () => {
    try {
      const params: any = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (queueFilter) params.queueId = queueFilter;
      if (searchQuery) params.search = searchQuery;

      const [jobsRes, queuesRes]: any = await Promise.all([
        apiClient.get('/jobs', { params }),
        apiClient.get('/queues'),
      ]);

      setJobs(jobsRes.data?.items || []);
      setQueues(queuesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [statusFilter, queueFilter, searchQuery]);

  const handleInspectJob = async (id: string) => {
    try {
      setAiSummary(null);
      const res: any = await apiClient.get(`/jobs/${id}`);
      setSelectedJob(res.data);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
    }
  };

  const handleFetchAiSummary = async (id: string) => {
    setLoadingAi(true);
    try {
      const res: any = await apiClient.get(`/jobs/${id}/ai-summary`);
      setAiSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch AI failure summary:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/jobs/${id}/retry`);
      await fetchJobs();
      if (selectedJob?.id === id) {
        handleInspectJob(id);
      }
    } catch (err: any) {
      alert(`Error retrying job: ${err.message || 'Action failed'}`);
    }
  };

  const handleCancel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/jobs/${id}/cancel`);
      await fetchJobs();
      if (selectedJob?.id === id) {
        handleInspectJob(id);
      }
    } catch (err: any) {
      alert(`Error cancelling job: ${err.message || 'Action failed'}`);
    }
  };

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      const targetQueueId = submitForm.queueId || queues[0]?.id;

      if (!projectId || !targetQueueId) {
        alert('Missing project or queue configuration');
        return;
      }

      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(submitForm.payloadJson);
      } catch {
        alert('Invalid JSON in payload');
        return;
      }

      const body: any = {
        projectId,
        queueId: targetQueueId,
        name: submitForm.name,
        handlerType: submitForm.handlerType,
        priority: Number(submitForm.priority),
        payload: parsedPayload,
      };

      if (submitForm.jobType === 'DELAYED' && submitForm.delaySeconds > 0) {
        body.delayMs = submitForm.delaySeconds * 1000;
      }

      await apiClient.post('/jobs', body);
      setShowSubmitModal(false);
      setSubmitForm({
        name: '',
        queueId: '',
        handlerType: 'CUSTOM_COMPUTE',
        jobType: 'IMMEDIATE',
        priority: 50,
        delaySeconds: 0,
        payloadJson: '{\n  "message": "Hello from background scheduler",\n  "shouldFail": false\n}',
      });
      await fetchJobs();
    } catch (err: any) {
      alert(`Error submitting job: ${err.message || 'Submission failed'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return (
          <span className="flex items-center gap-1 text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-xs font-mono">
            <Clock className="w-3 h-3" /> QUEUED
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-xs font-mono">
            <Clock className="w-3 h-3" /> SCHEDULED
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-mono animate-pulse">
            <PlayCircle className="w-3 h-3" /> RUNNING
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-mono">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-xs font-mono">
            <AlertTriangle className="w-3 h-3" /> FAILED
          </span>
        );
      case 'DEAD_LETTERED':
        return (
          <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-xs font-mono">
            <AlertTriangle className="w-3 h-3" /> DLQ
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1 text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-xs font-mono">
            <XCircle className="w-3 h-3" /> CANCELLED
          </span>
        );
      default:
        return <span className="font-mono text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Job Explorer & Logs</h2>
          <p className="text-xs text-slate-400 mt-0.5">Inspect real-time job execution state, attempt history, and streaming logs</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchJobs}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-850 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Job</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by job name or UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">QUEUED</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="DEAD_LETTERED">DEAD LETTERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Queues</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end text-slate-500">
          Showing {jobs.length} jobs
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-medium">Job Name</th>
                <th className="p-3 font-medium">Queue</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Priority</th>
                <th className="p-3 font-medium">Retries</th>
                <th className="p-3 font-medium">Run At / Created</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No jobs found matching the selected filters.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => handleInspectJob(job.id)}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      selectedJob?.id === job.id ? 'bg-slate-800/80' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="font-medium text-slate-200">{job.name}</div>
                      <div className="font-mono text-slate-500 text-[10px] truncate max-w-[180px]">
                        {job.id}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{job.queue?.name}</td>
                    <td className="p-3">{getStatusBadge(job.status)}</td>
                    <td className="p-3 font-mono text-slate-400">{job.jobType}</td>
                    <td className="p-3 font-mono text-slate-300">{job.priority}</td>
                    <td className="p-3 font-mono text-slate-400">
                      {job.retryCount}/{job.maxRetries}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {new Date(job.runAt || job.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {(job.status === 'FAILED' || job.status === 'DEAD_LETTERED') && (
                        <button
                          onClick={(e) => handleRetry(job.id, e)}
                          title="Retry Job"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(job.status === 'QUEUED' || job.status === 'SCHEDULED') && (
                        <button
                          onClick={(e) => handleCancel(job.id, e)}
                          title="Cancel Job"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Job Drawer / Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[560px] bg-slate-900 border-l border-slate-800 z-50 p-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Job Detail</span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedJob.name}</h3>
                <div className="font-mono text-xs text-slate-500 mt-0.5">{selectedJob.id}</div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <div>
                <div className="text-slate-500">Status</div>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              <div>
                <div className="text-slate-500">Queue</div>
                <div className="font-mono text-slate-200 mt-1">{selectedJob.queue?.name}</div>
              </div>
              <div>
                <div className="text-slate-500">Attempts / Retries</div>
                <div className="font-mono text-slate-200 mt-1">
                  {selectedJob.retryCount} / {selectedJob.maxRetries}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Worker Node</div>
                <div className="font-mono text-slate-200 mt-1">
                  {selectedJob.claimedByWorker?.hostname || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* AI Failure Summary Trigger for Failed/DLQ jobs */}
            {(selectedJob.status === 'FAILED' || selectedJob.status === 'DEAD_LETTERED') && (
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-purple-300 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>AI Failure Root-Cause Diagnosis</span>
                  </div>
                  {!aiSummary && (
                    <button
                      onClick={() => handleFetchAiSummary(selectedJob.id)}
                      disabled={loadingAi}
                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
                    >
                      {loadingAi ? 'Analyzing...' : 'Generate Analysis'}
                    </button>
                  )}
                </div>

                {aiSummary && (
                  <div className="text-xs space-y-2 pt-2 border-t border-purple-500/20">
                    <div className="font-medium text-slate-200">{aiSummary.summary}</div>
                    <div className="p-2 rounded bg-slate-950/80 font-mono text-[11px] text-purple-300 border border-purple-500/20">
                      Category: {aiSummary.rootCauseCategory}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-400 mb-1">Recommended Fix Actions:</div>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                        {aiSummary.suggestedActions?.map((act: string, idx: number) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payload Viewer */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Job Payload</h4>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            {/* Result Viewer if completed */}
            {selectedJob.result && (
              <div>
                <h4 className="text-xs font-semibold text-emerald-400 mb-1.5">Execution Result</h4>
                <pre className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs font-mono text-emerald-300 overflow-x-auto">
                  {JSON.stringify(selectedJob.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Execution Attempts Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Execution Attempts & Timeline</h4>
              <div className="space-y-2">
                {selectedJob.executions?.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No execution attempts yet.</div>
                ) : (
                  selectedJob.executions?.map((exec: any) => (
                    <div
                      key={exec.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-200">
                          Attempt #{exec.attemptNumber}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            exec.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {exec.status} ({exec.durationMs ?? 0}ms)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Started: {new Date(exec.startedAt).toLocaleString()}
                      </div>
                      {exec.errorMessage && (
                        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                          {exec.errorMessage}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Logs Viewer */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-brand-500" />
                Execution Output Logs
              </h4>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                {selectedJob.jobLogs?.length === 0 ? (
                  <div className="text-slate-500 italic">No log entries recorded.</div>
                ) : (
                  selectedJob.jobLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-start space-x-2">
                      <span className="text-slate-600 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          log.level === 'ERROR'
                            ? 'text-rose-400'
                            : log.level === 'WARN'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        [{log.level}]
                      </span>
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex space-x-3">
            {(selectedJob.status === 'FAILED' || selectedJob.status === 'DEAD_LETTERED') && (
              <button
                onClick={(e) => handleRetry(selectedJob.id, e)}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Job Now</span>
              </button>
            )}
            <button
              onClick={() => setSelectedJob(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Submit Job Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-100">Submit New Background Job</h3>
            <form onSubmit={handleSubmitJob} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-400">Job Title / Identifier</label>
                <input
                  type="text"
                  required
                  value={submitForm.name}
                  onChange={(e) => setSubmitForm({ ...submitForm, name: e.target.value })}
                  placeholder="e.g. Generate Financial Invoice #1024"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-400">Target Queue</label>
                  <select
                    value={submitForm.queueId}
                    onChange={(e) => setSubmitForm({ ...submitForm, queueId: e.target.value })}
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
                  <label className="font-medium text-slate-400">Handler Type</label>
                  <select
                    value={submitForm.handlerType}
                    onChange={(e) => setSubmitForm({ ...submitForm, handlerType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="CUSTOM_COMPUTE">Custom Compute</option>
                    <option value="SAMPLE_EMAIL">Email Dispatcher</option>
                    <option value="SAMPLE_REPORT">Report Generator</option>
                    <option value="HTTP_WEBHOOK">HTTP Webhook</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-slate-400">Job Type</label>
                  <select
                    value={submitForm.jobType}
                    onChange={(e) => setSubmitForm({ ...submitForm, jobType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="DELAYED">Delayed</option>
                  </select>
                </div>
                {submitForm.jobType === 'DELAYED' && (
                  <div>
                    <label className="font-medium text-slate-400">Delay (Seconds)</label>
                    <input
                      type="number"
                      min="1"
                      value={submitForm.delaySeconds}
                      onChange={(e) => setSubmitForm({ ...submitForm, delaySeconds: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}
                <div>
                  <label className="font-medium text-slate-400">Priority (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={submitForm.priority}
                    onChange={(e) => setSubmitForm({ ...submitForm, priority: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-400">JSON Payload</label>
                <textarea
                  rows={4}
                  value={submitForm.payloadJson}
                  onChange={(e) => setSubmitForm({ ...submitForm, payloadJson: e.target.value })}
                  className="mt-1 w-full p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-500"
                >
                  Enqueue Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
