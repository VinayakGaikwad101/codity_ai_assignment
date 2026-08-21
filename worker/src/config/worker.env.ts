import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WORKER_ID: z.string().default(`worker-${os.hostname()}-${process.pid}`),
  WORKER_HOSTNAME: z.string().default(os.hostname()),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(10000).default(500),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  WORKER_STALE_THRESHOLD_MS: z.coerce.number().int().min(5000).max(120000).default(15000),
  WORKER_REAPER_INTERVAL_MS: z.coerce.number().int().min(5000).max(120000).default(10000),
  CRON_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  DRAIN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(30000),
});

const parsed = workerEnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid worker configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const workerConfig = parsed.data;
