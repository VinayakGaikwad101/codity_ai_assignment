import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.PORT, () => {
  console.log(`[API Server] Running on http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
});
