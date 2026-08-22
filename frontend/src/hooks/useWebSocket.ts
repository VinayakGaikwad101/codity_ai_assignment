import { useEffect, useState, useRef } from 'react';

export interface WsEvent {
  event: string;
  timestamp: string;
  payload: any;
}

export function useWebSocket(onEvent?: (event: WsEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isUnmountedRef = useRef(false);
  const onEventRef = useRef(onEvent);

  // Keep latest onEvent callback without triggering reconnects
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    isUnmountedRef.current = false;

    const connect = () => {
      if (isUnmountedRef.current) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        // Connect directly to backend port 4000 in dev if on port 3000
        const isDev = window.location.port === '3000';
        const wsUrl = isDev
          ? 'ws://localhost:4000/ws'
          : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isUnmountedRef.current) {
            setIsConnected(true);
          }
        };

        ws.onmessage = (messageEvent) => {
          try {
            const parsed: WsEvent = JSON.parse(messageEvent.data);
            if (!isUnmountedRef.current) {
              setLastEvent(parsed);
            }
            if (onEventRef.current) {
              onEventRef.current(parsed);
            }
          } catch (err) {
            console.error('[WebSocket Hook] Parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isUnmountedRef.current) {
            setIsConnected(false);
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                connect();
              }, 3000);
            }
          }
        };

        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };
      } catch (err) {
        console.error('[WebSocket Hook] Failed to create socket:', err);
      }
    };

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { isConnected, lastEvent };
}
