import { z } from 'zod';
import { JobType, RetryStrategy, UserRole, JobStatus } from './enums.js';

// Auth DTOs
export const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organizationName: z.string().min(2),
});
export type RegisterUserDto = z.infer<typeof RegisterUserSchema>;

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginUserDto = z.infer<typeof LoginUserSchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().min(2).max(64),
  projectId: z.string().uuid().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.OPERATOR),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;

// Project DTOs
export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(256).optional(),
});
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

// Retry Policy DTOs
export const CreateRetryPolicySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(64),
  strategy: z.nativeEnum(RetryStrategy).default(RetryStrategy.EXPONENTIAL),
  maxRetries: z.number().int().min(0).max(20).default(3),
  initialIntervalMs: z.number().int().min(100).max(60000).default(1000),
  maxIntervalMs: z.number().int().min(1000).max(86400000).default(60000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
  useJitter: z.boolean().default(true),
});
export type CreateRetryPolicyDto = z.infer<typeof CreateRetryPolicySchema>;

// Queue DTOs
export const CreateQueueSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(64).regex(/^[a-zA-Z0-9-_]+$/, 'Queue name must contain only alphanumeric, hyphens, and underscores'),
  description: z.string().max(256).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  concurrencyLimit: z.number().int().min(1).max(500).default(10),
  rateLimitPerMin: z.number().int().min(1).max(10000).optional(),
  retryPolicyId: z.string().uuid().optional(),
});
export type CreateQueueDto = z.infer<typeof CreateQueueSchema>;

export const UpdateQueueSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(256).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  concurrencyLimit: z.number().int().min(1).max(500).optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).nullable().optional(),
  isPaused: z.boolean().optional(),
  retryPolicyId: z.string().uuid().nullable().optional(),
});
export type UpdateQueueDto = z.infer<typeof UpdateQueueSchema>;

// Job Ingestion DTOs
export const CreateJobSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().min(2).max(128),
  handlerType: z.string().min(2).max(64),
  jobType: z.nativeEnum(JobType).default(JobType.IMMEDIATE),
  priority: z.number().int().min(0).max(100).optional(),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().max(128).optional(),
  runAt: z.string().datetime().optional(),
  delayMs: z.number().int().min(0).max(31536000000).optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).default(60000),
  maxRetries: z.number().int().min(0).max(20).optional(),
  retryPolicyId: z.string().uuid().optional(),
  parentJobId: z.string().uuid().optional(),
  dependsOnJobIds: z.array(z.string().uuid()).optional(),
});
export type CreateJobDto = z.infer<typeof CreateJobSchema>;

export const CreateBatchJobsSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  batchName: z.string().min(2).max(128),
  jobs: z.array(
    z.object({
      name: z.string().min(2).max(128),
      handlerType: z.string().min(2).max(64),
      priority: z.number().int().min(0).max(100).optional(),
      payload: z.record(z.any()).default({}),
      idempotencyKey: z.string().max(128).optional(),
    })
  ).min(1).max(500),
});
export type CreateBatchJobsDto = z.infer<typeof CreateBatchJobsSchema>;

export const CreateScheduledJobSchema = z.object({
  projectId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().min(2).max(128),
  handlerType: z.string().min(2).max(64),
  cronExpression: z.string().min(9).max(64),
  timezone: z.string().default('UTC'),
  payload: z.record(z.any()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).default(60000),
  maxRetries: z.number().int().min(0).max(20).default(3),
  retryPolicyId: z.string().uuid().optional(),
});
export type CreateScheduledJobDto = z.infer<typeof CreateScheduledJobSchema>;

// Job Filtering Query DTO
export const JobFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(JobStatus).optional(),
  queueId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'priority', 'runAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type JobFilterQueryDto = z.infer<typeof JobFilterQuerySchema>;
