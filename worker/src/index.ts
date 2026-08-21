import { WorkerProcess } from './worker.js';

const worker = new WorkerProcess();

worker.start().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});

const handleExit = (signal: string) => {
  worker.stop(signal).catch((err) => {
    console.error('[Worker] Error during shutdown:', err);
    process.exit(1);
  });
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
