import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { wsHub } from './lib/websocket.js';

const app = createApp();
const server = http.createServer(app);

// Initialize WebSocket hub on the HTTP server
wsHub.initialize(server);

server.listen(config.PORT, () => {
  console.log(`[API Server] Running on http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
  console.log(`[WebSocket] Listening for live connections on ws://localhost:${config.PORT}/ws`);
});

// Graceful server shutdown
const handleShutdown = (signal: string) => {
  console.log(`[API Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('[API Server] Closed HTTP and WebSocket server connections.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
