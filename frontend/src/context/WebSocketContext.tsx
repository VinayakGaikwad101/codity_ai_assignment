import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext.js';

type EventListener = (data: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (event: string, callback: EventListener) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventListener>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) wsRef.current.close();
      setIsConnected(false);
      return;
    }

    const connect = () => {
      try {
        const wsUrl = `ws://localhost:4000/ws?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log('[WebSocket UI] Connected to live event stream');
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const eventName = parsed.event;
            const listeners = listenersRef.current.get(eventName);
            if (listeners) {
              listeners.forEach((fn) => fn(parsed.data));
            }
            // Generic catch-all listener
            const allListeners = listenersRef.current.get('*');
            if (allListeners) {
              allListeners.forEach((fn) => fn(parsed));
            }
          } catch (e) {
            console.error('[WebSocket UI Parse Error]:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        console.error('[WebSocket UI Init Error]:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  const subscribe = (event: string, callback: EventListener) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return ctx;
};
