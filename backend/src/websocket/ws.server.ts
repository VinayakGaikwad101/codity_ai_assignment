import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import url from 'url';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { WebSocketEvent } from '@scheduler/shared';

interface ClientConnection {
  ws: WebSocket;
  organizationId: string;
  subscriptions: Set<string>;
}

export class WsServer {
  private static instance: WsServer;
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, ClientConnection>();

  private constructor() {}

  static getInstance(): WsServer {
    if (!WsServer.instance) {
      WsServer.instance = new WsServer();
    }
    return WsServer.instance;
  }

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: WebSocket, req) => {
      try {
        const parsedUrl = url.parse(req.url || '', true);
        const token = (parsedUrl.query.token as string) || '';
        const apiKey = (parsedUrl.query.apiKey as string) || '';

        let organizationId = '';

        if (token) {
          try {
            const decoded = jwt.verify(token, config.JWT_SECRET) as any;
            organizationId = decoded.organizationId;
          } catch {
            ws.close(4001, 'Unauthorized: Invalid JWT');
            return;
          }
        } else if (apiKey) {
          const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
          const keyRecord = await prisma.apiKey.findUnique({ where: { keyHash } });
          if (!keyRecord) {
            ws.close(4001, 'Unauthorized: Invalid API Key');
            return;
          }
          organizationId = keyRecord.organizationId;
        } else {
          ws.close(4001, 'Unauthorized: Token or API Key required');
          return;
        }

        const client: ClientConnection = {
          ws,
          organizationId,
          subscriptions: new Set(['queues', 'jobs', 'workers', 'metrics']),
        };

        this.clients.set(ws, client);
        console.log(`[WebSocket] Client connected for org: ${organizationId}`);

        // Send connection welcome message
        ws.send(
          JSON.stringify({
            event: 'system:connected',
            data: { message: 'Connected to Distributed Job Scheduler Live Stream', organizationId },
            timestamp: new Date().toISOString(),
          })
        );

        ws.on('message', (message: string) => {
          try {
            const parsed = JSON.parse(message.toString());
            if (parsed.action === 'subscribe' && Array.isArray(parsed.channels)) {
              parsed.channels.forEach((ch: string) => client.subscriptions.add(ch));
              ws.send(JSON.stringify({ event: 'system:subscribed', channels: Array.from(client.subscriptions) }));
            } else if (parsed.action === 'unsubscribe' && Array.isArray(parsed.channels)) {
              parsed.channels.forEach((ch: string) => client.subscriptions.delete(ch));
              ws.send(JSON.stringify({ event: 'system:unsubscribed', channels: Array.from(client.subscriptions) }));
            }
          } catch (e) {
            console.error('[WebSocket Message Parse Error]:', e);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          console.log(`[WebSocket] Client disconnected`);
        });

        ws.on('error', (err) => {
          console.error('[WebSocket Socket Error]:', err);
          this.clients.delete(ws);
        });
      } catch (err) {
        console.error('[WebSocket Connection Error]:', err);
        ws.close(4000, 'Internal Server Error');
      }
    });

    console.log('[WebSocket Server] Initialized on path /ws');
  }

  broadcast(channel: string, event: WebSocketEvent) {
    if (!this.wss) return;

    const payload = JSON.stringify(event);
    for (const [_ws, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
        client.ws.send(payload);
      }
    }
  }
}

export const wsServer = WsServer.getInstance();
