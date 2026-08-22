import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { wsServer } from './websocket/ws.server.js';

const app = createApp();
const server = http.createServer(app);

// Attach WebSocket live event stream
wsServer.init(server);

server.listen(config.PORT, () => {
  console.log(`[API Server] Running on http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
  console.log(`[WebSocket Server] Live streaming on ws://localhost:${config.PORT}/ws`);
});
