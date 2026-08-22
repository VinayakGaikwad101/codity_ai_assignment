import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { Key, Plus, Trash2, Copy, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { TableSkeleton } from '../components/Skeleton.js';

export const ApiKeysView: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newKey, setNewKey] = useState({
    name: '',
    role: 'OPERATOR',
    expiresInDays: 90,
  });

  const fetchKeys = async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const res: any = await apiClient.get('/auth/api-keys');
      setApiKeys(res.data || []);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
      if (showSpin) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchKeys(false);
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;

      const res: any = await apiClient.post('/auth/api-keys', {
        name: newKey.name,
        role: newKey.role,
        projectId,
        expiresInDays: Number(newKey.expiresInDays),
      });

      setCreatedKey(res.data?.rawKey);
      setShowCreateModal(false);
      setNewKey({ name: '', role: 'OPERATOR', expiresInDays: 90 });
      await fetchKeys(false);
    } catch (err: any) {
      alert(`Error generating API key: ${err.message || 'Validation error'}`);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is immediate and cannot be undone.')) return;
    try {
      await apiClient.delete(`/auth/api-keys/${id}`);
      await fetchKeys(false);
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">API Keys & Machine Access</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage secure, SHA-256 hashed API keys for external service ingestion</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchKeys(true)}
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
            <span>Generate API Key</span>
          </button>
        </div>
      </div>

      {/* Newly Generated Key Alert */}
      {createdKey && (
        <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-300">API Key Successfully Created</h3>
          </div>
          <p className="text-xs text-slate-300">
            Please copy this key now. For security purposes, you will not be able to view it again once dismissed.
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={createdKey}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-medium transition-all shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setCreatedKey(null)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* API Keys Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        {loading && apiKeys.length === 0 ? (
          <TableSkeleton rows={3} cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="p-3.5">Key Identifier / Name</th>
                  <th className="p-3.5">Key Prefix</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Created At</th>
                  <th className="p-3.5">Expires At</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No active API keys found.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-medium text-slate-200 flex items-center space-x-1.5">
                          <Key className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{key.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{key.keyPrefix}...</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                          {key.role}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 active:scale-95 transition-all ml-auto"
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
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Generate Machine API Key</h3>
            <form onSubmit={handleCreateKey} className="space-y-3">
              <div>
                <label className="font-medium text-slate-400">Key Name</label>
                <input
                  type="text"
                  required
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  placeholder="e.g. Analytics Pipeline Ingest Key"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-400">Role & Permissions</label>
                  <select
                    value={newKey.role}
                    onChange={(e) => setNewKey({ ...newKey, role: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="OPERATOR">OPERATOR (Read/Write)</option>
                    <option value="ADMIN">ADMIN (Full Access)</option>
                    <option value="VIEWER">VIEWER (Read Only)</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-400">Expires In (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newKey.expiresInDays}
                    onChange={(e) => setNewKey({ ...newKey, expiresInDays: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-medium shadow-md shadow-indigo-900/30 transition-all"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
