import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Sidebar, TabType } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { OverviewView } from './views/OverviewView.js';
import { QueuesView } from './views/QueuesView.js';
import { JobExplorerView } from './views/JobExplorerView.js';
import { WorkersView } from './views/WorkersView.js';
import { CronView } from './views/CronView.js';
import { DlqView } from './views/DlqView.js';
import { ApiKeysView } from './views/ApiKeysView.js';
import { Modal } from './components/ui/Modal.js';
import { Button } from './components/ui/Button.js';
import { apiRequest } from './api/client.js';
import { Zap, Shield, UserPlus, LogIn, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const App: React.FC = () => {
  const { user, login, register, refreshProjects } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Auth Screen State (Login vs Register)
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('Admin@12345');
  const [orgName, setOrgName] = useState('Acme Corporation');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const demoAccounts = [
    { role: 'Admin', email: 'admin@acme.com', desc: 'Full cluster & project control' },
    { role: 'Operator', email: 'operator@acme.com', desc: 'Can ingest & manage jobs' },
    { role: 'Viewer', email: 'viewer@acme.com', desc: 'Read-only cluster auditor' },
  ];

  const handleSelectDemoAccount = (acc: typeof demoAccounts[0]) => {
    setEmail(acc.email);
    setPassword('Admin@12345');
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'VIEWER') {
      toast.error('Permission denied: Viewer accounts cannot create projects');
      return;
    }

    setIsCreatingProject(true);
    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc || undefined,
        }),
      });
      toast.success(`Project "${newProjectName}" created successfully!`);
      setIsNewProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      await refreshProjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    try {
      if (authMode === 'LOGIN') {
        await login(email, password);
        toast.success('Signed in successfully');
      } else {
        await register(name, email, password, orgName);
        toast.success(`Organization "${orgName}" & Admin account registered!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="w-full max-w-md bg-surface border border-surface-border p-8 rounded-2xl shadow-2xl space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Distributed Job Scheduler</h2>
            <p className="text-xs text-slate-400">
              {authMode === 'LOGIN'
                ? 'Sign in to access your high-concurrency cluster control plane'
                : 'Create an isolated organization workspace & administrator account'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-surface-elevated p-1 rounded-xl border border-surface-border">
            <button
              type="button"
              onClick={() => setAuthMode('LOGIN')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'LOGIN'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('REGISTER')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'REGISTER'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register Org
            </button>
          </div>

          {/* 1-Click Demo RBAC Role Switcher */}
          {authMode === 'LOGIN' && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Select RBAC Test Role:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map((acc) => {
                  const isSelected = email === acc.email;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleSelectDemoAccount(acc)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/60 shadow-sm shadow-indigo-500/20'
                          : 'bg-surface-elevated border-surface-border hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{acc.role}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{acc.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'REGISTER' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Organization / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cyberdyne Systems"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmittingAuth}
            >
              {authMode === 'LOGIN' ? `Sign In as ${email.split('@')[0]}` : 'Create Organization Workspace'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenProjectModal={() => setIsNewProjectModalOpen(true)} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {activeTab === 'overview' && <OverviewView onNavigateTo={setActiveTab} />}
          {activeTab === 'queues' && <QueuesView />}
          {activeTab === 'jobs' && <JobExplorerView />}
          {activeTab === 'workers' && <WorkersView />}
          {activeTab === 'cron' && <CronView />}
          {activeTab === 'dlq' && <DlqView />}
          {activeTab === 'apikeys' && <ApiKeysView />}
        </main>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create New Project Workspace"
        description="Isolated queue and background job namespace under your organization"
      >
        <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Analytics Pipeline"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Describe the purpose of this project workspace"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreatingProject}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
