import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default('super_secret_jwt_key_for_dev_change_in_production_12345'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(500),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(5000),
  WORKER_STALE_THRESHOLD_MS: z.coerce.number().default(15000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
