import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  organizationId: string;
  organizationName?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (proj: Project) => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, orgName: string, role?: string) => Promise<void>;
  logout: () => void;
  refreshProjects: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('djs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('djs_auth_token'));
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(() => {
    const saved = localStorage.getItem('djs_current_project');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProjects = async () => {
    const storedToken = localStorage.getItem('djs_auth_token');
    if (!storedToken) return;
    try {
      const data = await apiRequest<Project[]>('/projects');
      setProjects(data);
      if (data.length > 0) {
        const exists = data.find((p) => p.id === currentProject?.id);
        if (!exists) {
          setCurrentProject(data[0]);
          localStorage.setItem('djs_current_project', JSON.stringify(data[0]));
        }
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });

    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('djs_user', JSON.stringify(res.user));
    localStorage.setItem('djs_auth_token', res.token);

    const projs = await apiRequest<Project[]>('/projects', {
      headers: { Authorization: `Bearer ${res.token}` },
    });
    setProjects(projs);
    if (projs.length > 0) {
      setCurrentProject(projs[0]);
      localStorage.setItem('djs_current_project', JSON.stringify(projs[0]));
    }
  };

  const register = async (name: string, email: string, pass: string, orgName: string, role = 'ADMIN') => {
    const res = await apiRequest<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password: pass,
        organizationName: orgName,
        role,
      }),
    });

    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('djs_user', JSON.stringify(res.user));
    localStorage.setItem('djs_auth_token', res.token);

    const projs = await apiRequest<Project[]>('/projects', {
      headers: { Authorization: `Bearer ${res.token}` },
    });
    setProjects(projs);
    if (projs.length > 0) {
      setCurrentProject(projs[0]);
      localStorage.setItem('djs_current_project', JSON.stringify(projs[0]));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setProjects([]);
    setCurrentProject(null);
    localStorage.removeItem('djs_user');
    localStorage.removeItem('djs_auth_token');
    localStorage.removeItem('djs_current_project');
  };

  useEffect(() => {
    const init = async () => {
      if (token) {
        await refreshProjects();
      }
      setIsLoading(false);
    };
    init();
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        projects,
        currentProject,
        setCurrentProject: (proj) => {
          setCurrentProject(proj);
          localStorage.setItem('djs_current_project', JSON.stringify(proj));
        },
        login,
        register,
        logout,
        refreshProjects,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
