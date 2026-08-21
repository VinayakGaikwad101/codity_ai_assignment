import { useEffect, useState, useRef, useCallback } from 'react';

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

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const parsed: WsEvent = JSON.parse(messageEvent.data);
          setLastEvent(parsed);
          if (onEvent) {
            onEvent(parsed);
          }
        } catch (err) {
          console.error('[WebSocket Hook] Parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WebSocket Hook] Connection error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WebSocket Hook] Failed to create socket:', err);
    }
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastEvent };
}
