import { createApp } from './app.js';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const app = createApp();

// Mount fallback 404 & error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`[API Server] Running on http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
});

// Graceful server shutdown
const handleShutdown = (signal: string) => {
  console.log(`[API Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('[API Server] Closed HTTP server connections.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
