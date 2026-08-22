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
import { toast } from 'sonner';

export const App: React.FC = () => {
  const { user, login, refreshProjects } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Login Modal (if logged out)
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('Admin@12345');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await login(email, password);
      toast.success('Logged in successfully');
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-surface-border p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
              <span className="text-xl font-bold text-white">DJS</span>
            </div>
            <h2 className="text-xl font-bold text-white">Distributed Job Scheduler</h2>
            <p className="text-xs text-slate-400">Sign in to access your high-concurrency cluster control plane</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoggingIn}>
              Sign In
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
