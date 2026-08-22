import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { OverviewView } from './views/OverviewView.js';
import { QueuesView } from './views/QueuesView.js';
import { JobsView } from './views/JobsView.js';
import { WorkersView } from './views/WorkersView.js';
import { CronView } from './views/CronView.js';
import { DlqView } from './views/DlqView.js';
import { ApiKeysView } from './views/ApiKeysView.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { apiClient } from './api/client.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [user, setUser] = useState<any>(null);
  const [dlqCount, setDlqCount] = useState<number>(0);
  const [authReady, setAuthReady] = useState(false);

  const { isConnected } = useWebSocket();

  // Auto-login default seeded user if not logged in
  useEffect(() => {
    const initAuth = async () => {
      const existingToken = localStorage.getItem('auth_token');
      if (!existingToken) {
        try {
          const res: any = await apiClient.post('/auth/login', {
            email: 'admin@acme.com',
            password: 'Admin@12345',
          });
          localStorage.setItem('auth_token', res.data.token);
          setUser(res.data.user);
        } catch (err) {
          console.error('Auto-login error:', err);
        } finally {
          setAuthReady(true);
        }
      } else {
        try {
          const res: any = await apiClient.get('/auth/me');
          setUser(res.data.user);
        } catch {
          localStorage.removeItem('auth_token');
          // Retry login
          try {
            const res: any = await apiClient.post('/auth/login', {
              email: 'admin@acme.com',
              password: 'Admin@12345',
            });
            localStorage.setItem('auth_token', res.data.token);
            setUser(res.data.user);
          } catch {}
        } finally {
          setAuthReady(true);
        }
      }
    };

    initAuth();
  }, []);

  // Fetch DLQ count for sidebar badge
  useEffect(() => {
    if (!authReady) return;

    const fetchDlqCount = async () => {
      try {
        const projectsRes: any = await apiClient.get('/projects');
        const projectId = projectsRes.data[0]?.id;
        if (!projectId) return;
        const res: any = await apiClient.get('/jobs/dlq', { params: { projectId, limit: 1 } });
        setDlqCount(res.data?.total || 0);
      } catch (err) {
        console.error('Failed to fetch DLQ count:', err);
      }
    };

    fetchDlqCount();
    const interval = setInterval(fetchDlqCount, 5000);
    return () => clearInterval(interval);
  }, [authReady]);

  const renderContent = () => {
    if (!authReady) {
      return <div className="p-12 text-center text-slate-500">Connecting to platform control plane...</div>;
    }

    switch (currentTab) {
      case 'overview':
        return <OverviewView />;
      case 'queues':
        return <QueuesView />;
      case 'jobs':
        return <JobsView />;
      case 'workers':
        return <WorkersView />;
      case 'cron':
        return <CronView />;
      case 'dlq':
        return <DlqView />;
      case 'api-keys':
        return <ApiKeysView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        isConnected={isConnected}
        userRole={user?.role || 'ADMIN'}
        userName={user?.name || 'Vinayak Gaikwad (Admin)'}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          dlqCount={dlqCount}
        />

        <main className="flex-1 overflow-y-auto p-8 bg-slate-950/50">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
};
