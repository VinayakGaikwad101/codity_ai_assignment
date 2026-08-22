import { JobStatus, JobType, RetryStrategy, WorkerStatus, UserRole, LogLevel, ExecutionStatus } from './enums.js';

export interface OrganizationModel {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserModel {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyModel {
  id: string;
  organizationId: string;
  projectId?: string | null;
  name: string;
  keyPrefix: string;
  role: UserRole;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

export interface ProjectModel {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryPolicyModel {
  id: string;
  projectId: string;
  name: string;
  strategy: RetryStrategy;
  maxRetries: number;
  initialIntervalMs: number;
  maxIntervalMs: number;
  backoffMultiplier: number;
  useJitter: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueModel {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  priority: number;
  concurrencyLimit: number;
  rateLimitPerMin?: number | null;
  isPaused: boolean;
  retryPolicyId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobModel {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: string;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  idempotencyKey?: string | null;
  runAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;
  retryPolicyId?: string | null;
  parentJobId?: string | null;
  claimedByWorkerId?: string | null;
  claimedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobExecutionModel {
  id: string;
  jobId: string;
  workerId: string;
  attemptNumber: number;
  status: ExecutionStatus;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  errorStack?: string | null;
}

export interface JobLogModel {
  id: string;
  jobId: string;
  executionId?: string | null;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: Date;
}

export interface ScheduledJobModel {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: string;
  cronExpression: string;
  timezone: string;
  payload?: Record<string, any> | null;
  priority: number;
  timeoutMs: number;
  maxRetries: number;
  retryPolicyId?: string | null;
  isActive: boolean;
  lastRunAt?: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadLetterQueueModel {
  id: string;
  projectId: string;
  queueId: string;
  jobId: string;
  failureReason: string;
  stackTrace?: string | null;
  totalAttempts: number;
  originalPayload: Record<string, any>;
  deadLetteredAt: Date;
  replayedAt?: Date | null;
  replayedJobId?: string | null;
}

export interface WorkerModel {
  id: string;
  hostname: string;
  ipAddress?: string | null;
  status: WorkerStatus;
  concurrencyLimit: number;
  activeJobsCount: number;
  lastHeartbeatAt: Date;
  startedAt: Date;
}

export interface WorkerHeartbeatModel {
  id: string;
  workerId: string;
  cpuUsage: number;
  memoryUsage: number;
  activeJobs: number;
  timestamp: Date;
}
