import { z } from 'zod';
import {
  JobHandlerType,
  JobStatus,
  JobType,
  LogLevel,
  RetryStrategy,
  UserRole,
} from './enums.js';

export const UserRoleSchema = z.nativeEnum(UserRole);
export const JobStatusSchema = z.nativeEnum(JobStatus);
export const JobTypeSchema = z.nativeEnum(JobType);
export const RetryStrategySchema = z.nativeEnum(RetryStrategy);
export const LogLevelSchema = z.nativeEnum(LogLevel);
export const JobHandlerTypeSchema = z.nativeEnum(JobHandlerType);

// Create Project DTO
export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

// Create Queue DTO
export const CreateQueueSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  concurrencyLimit: z.number().int().min(1).max(1000).default(10),
  rateLimitPerMin: z.number().int().min(1).optional().nullable(),
  retryPolicyId: z.string().uuid().optional().nullable(),
});
export type CreateQueueDto = z.infer<typeof CreateQueueSchema>;

export const UpdateQueueSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
  concurrencyLimit: z.number().int().min(1).max(1000).optional(),
  rateLimitPerMin: z.number().int().min(1).optional().nullable(),
  isPaused: z.boolean().optional(),
  retryPolicyId: z.string().uuid().optional().nullable(),
});
export type UpdateQueueDto = z.infer<typeof UpdateQueueSchema>;

// Create Retry Policy DTO
export const CreateRetryPolicySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(100),
  strategy: RetryStrategySchema,
  maxRetries: z.number().int().min(0).max(50).default(3),
  baseDelayMs: z.number().int().min(100).max(86400000).default(1000),
  maxDelayMs: z.number().int().min(100).max(86400000).default(60000),
  jitter: z.boolean().default(true),
});
export type CreateRetryPolicyDto = z.infer<typeof CreateRetryPolicySchema>;

// Create Job DTO
export const CreateJobSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().min(2).max(200),
  handlerType: JobHandlerTypeSchema.default(JobHandlerType.CUSTOM_COMPUTE),
  jobType: JobTypeSchema.default(JobType.IMMEDIATE),
  priority: z.number().int().min(0).max(100).optional(),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().min(1).max(256).optional().nullable(),
  delayMs: z.number().int().min(0).optional(), // For DELAYED jobs
  runAt: z.string().datetime().or(z.date()).optional(), // For SCHEDULED jobs
  timeoutMs: z.number().int().min(1000).max(3600000).default(60000),
  maxRetries: z.number().int().min(0).max(50).optional(),
  retryPolicyId: z.string().uuid().optional().nullable(),
  parentJobId: z.string().uuid().optional().nullable(),
  dependsOnJobIds: z.array(z.string().uuid()).optional(), // For DAG jobs
});
export type CreateJobDto = z.infer<typeof CreateJobSchema>;

// Create Batch Jobs DTO
export const CreateBatchJobsSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  batchName: z.string().min(2).max(200),
  jobs: z.array(
    z.object({
      name: z.string().min(2).max(200),
      handlerType: JobHandlerTypeSchema.default(JobHandlerType.CUSTOM_COMPUTE),
      payload: z.record(z.any()).default({}),
      priority: z.number().int().min(0).max(100).optional(),
      idempotencyKey: z.string().optional(),
    })
  ).min(1).max(1000),
});
export type CreateBatchJobsDto = z.infer<typeof CreateBatchJobsSchema>;

// Create Scheduled / Recurring Cron Job DTO
export const CreateScheduledJobSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().min(2).max(200),
  handlerType: JobHandlerTypeSchema.default(JobHandlerType.CUSTOM_COMPUTE),
  cronExpression: z.string().min(5).max(100),
  timezone: z.string().default('UTC'),
  payload: z.record(z.any()).default({}),
  priority: z.number().int().min(0).max(100).default(50),
  timeoutMs: z.number().int().min(1000).max(3600000).default(60000),
  maxRetries: z.number().int().min(0).max(50).default(3),
  retryPolicyId: z.string().uuid().optional().nullable(),
});
export type CreateScheduledJobDto = z.infer<typeof CreateScheduledJobSchema>;

// Job Filter Query Params
export const JobFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: JobStatusSchema.optional(),
  queueId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'runAt', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type JobFilterQueryDto = z.infer<typeof JobFilterQuerySchema>;
