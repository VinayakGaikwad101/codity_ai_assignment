import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsEventType, WsMessage } from '@scheduler/shared';

export class WebSocketHub {
  private static instance: WebSocketHub;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  private constructor() {}

  static getInstance(): WebSocketHub {
    if (!WebSocketHub.instance) {
      WebSocketHub.instance = new WebSocketHub();
    }
    return WebSocketHub.instance;
  }

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send immediate welcome packet
      const welcomeMsg: WsMessage = {
        event: 'SYSTEM_METRICS_UPDATE',
        timestamp: new Date().toISOString(),
        payload: { connected: true, clientsCount: this.clients.size },
      };
      ws.send(JSON.stringify(welcomeMsg));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocketHub] Client socket error:', err);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocketHub] WebSocket server initialized on path /ws');
  }

  broadcast(event: WsEventType, payload: any): void {
    if (this.clients.size === 0) return;

    const message: WsMessage = {
      event,
      timestamp: new Date().toISOString(),
      payload,
    };

    const serialized = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(serialized);
        } catch (err) {
          console.error('[WebSocketHub] Error sending message to client:', err);
        }
      }
    }
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const wsHub = WebSocketHub.getInstance();
