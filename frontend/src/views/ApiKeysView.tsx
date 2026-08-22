import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { TableRowSkeleton } from '../components/ui/Skeleton.js';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  Shield,
  Check,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const ApiKeysView: React.FC = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Generate Key Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const fetchKeys = async (showToast = false) => {
    try {
      const data = await apiRequest<any[]>('/auth/api-keys');
      setKeys(data);
      if (showToast) toast.success('API keys updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch API keys');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchKeys();
  }, []);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await apiRequest<{ apiKey: any; rawKey: string }>('/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: keyName,
          role: 'OPERATOR',
          expiresInDays: Number(expiresInDays),
        }),
      });

      setCreatedKey(res.rawKey);
      toast.success('Machine API key generated successfully!');
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate API key');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = (keyString: string) => {
    navigator.clipboard.writeText(keyString);
    toast.success('API key copied to clipboard!');
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"?`)) return;
    try {
      await apiRequest(`/auth/api-keys/${id}`, { method: 'DELETE' });
      toast.success('API key revoked');
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">API Keys & Machine Access</h2>
          <p className="text-sm text-slate-400 mt-1">
            Generate and manage cryptographically secure SHA-256 hashed API keys for programmatic worker ingestion
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchKeys(true);
            }}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreatedKey(null);
              setKeyName('');
              setIsGenerateModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Generate API Key
          </Button>
        </div>
      </div>

      {/* API Keys Table */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/80 text-slate-300 border-b border-surface-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Key Name</th>
                <th className="py-3.5 px-4 font-semibold">Prefix</th>
                <th className="py-3.5 px-4 font-semibold">Role</th>
                <th className="py-3.5 px-4 font-semibold">Last Used</th>
                <th className="py-3.5 px-4 font-semibold">Expires</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No machine API keys generated yet. Click &quot;Generate API Key&quot; to issue a new key!
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-400" />
                        {key.name}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{key.id}</span>
                    </td>
                    <td className="py-4 px-4">
                      <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-indigo-300">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="primary">{key.role}</Badge>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {key.lastUsedAt ? format(new Date(key.lastUsedAt), 'MMM dd, HH:mm') : 'Never'}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {key.expiresAt ? format(new Date(key.expiresAt), 'MMM dd, yyyy') : 'Never (Perpetual)'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(key.id, key.name)}
                        className="hover:text-rose-400"
                        title="Revoke API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Key Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title={createdKey ? 'API Key Generated' : 'Generate Machine API Key'}
        description={
          createdKey
            ? 'Make sure to copy your API key now. You will not be able to see it again!'
            : 'Issue a cryptographically secure machine token for backend microservices'
        }
      >
        {createdKey ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-xl space-y-2">
              <span className="text-xs font-bold text-amber-400 block">Your Raw API Secret Key</span>
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800">
                <code className="text-xs font-mono text-emerald-400 break-all">{createdKey}</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyKey(createdKey)}
                  leftIcon={<Copy className="w-3.5 h-3.5" />}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="primary" size="sm" onClick={() => setIsGenerateModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Key Identifier Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ingestion Pipeline Worker Node"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Expiry Period (Days)
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsGenerateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isGenerating}>
                Generate Token
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
