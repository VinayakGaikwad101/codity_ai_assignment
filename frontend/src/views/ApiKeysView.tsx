import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { Plus, Trash2, Copy, Check } from 'lucide-react';

export const ApiKeysView: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      if (!projectId) return;

      const res: any = await apiClient.get('/auth/api-keys', { params: { projectId } });
      setApiKeys(res.data || []);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      if (!projectId) return;

      const res: any = await apiClient.post('/auth/api-keys', {
        projectId,
        name: newKeyName,
      });

      setGeneratedKey(res.data);
      setNewKeyName('');
      await fetchKeys();
    } catch (err: any) {
      alert(`Error creating API key: ${err.message || 'Action failed'}`);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      const projectsRes: any = await apiClient.get('/projects');
      const projectId = projectsRes.data[0]?.id;
      await apiClient.delete(`/auth/api-keys/${id}`, { data: { projectId } });
      await fetchKeys();
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">API Keys & Machine Access</h2>
          <p className="text-xs text-slate-400 mt-0.5">Programmatic Bearer authentication tokens for external ingest clients and microservices</p>
        </div>
        <button
          onClick={() => {
            setGeneratedKey(null);
            setShowModal(true);
          }}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Generate API Key</span>
        </button>
      </div>

      {/* Keys Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-medium">Key Name</th>
                <th className="p-3 font-medium">Prefix</th>
                <th className="p-3 font-medium">Last Used At</th>
                <th className="p-3 font-medium">Created At</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-slate-200">{k.name}</td>
                  <td className="p-3 font-mono text-brand-400">{k.keyPrefix}...</td>
                  <td className="p-3 font-mono text-slate-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-semibold text-slate-100">
              {generatedKey ? 'API Key Generated' : 'Generate New API Key'}
            </h3>

            {generatedKey ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                  Please copy your secret key now. You will not be able to see it again!
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedKey.rawApiKey}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-brand-400"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedKey.rawApiKey)}
                    className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setGeneratedKey(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-3">
                <div>
                  <label className="font-medium text-slate-400">Key Name</label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Analytics Pipeline Ingest"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-500"
                  >
                    Generate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
