import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default('super-secret-jwt-key-for-distributed-scheduler-2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(5000),
  REAPER_INTERVAL_MS: z.coerce.number().default(15000),
});

export const config = EnvSchema.parse(process.env);
