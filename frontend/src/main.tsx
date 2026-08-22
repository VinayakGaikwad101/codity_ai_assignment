import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { WebSocketProvider } from './context/WebSocketContext.js';
import { Toaster } from 'sonner';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <App />
        <Toaster richColors position="top-right" theme="dark" closeButton={false} />
      </WebSocketProvider>
    </AuthProvider>
  </React.StrictMode>
);
