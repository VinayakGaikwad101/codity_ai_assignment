import {
  UserRole,
  JobStatus,
  JobType,
  RetryStrategy,
  WorkerStatus,
  ExecutionStatus,
  LogLevel,
  JobHandlerType,
} from './enums.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface RetryPolicy {
  id: string;
  projectId: string;
  name: string;
  strategy: RetryStrategy;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Queue {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  priority: number; // 0 to 100
  concurrencyLimit: number; // Max jobs executing concurrently across workers
  rateLimitPerMin?: number | null;
  isPaused: boolean;
  retryPolicyId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: JobHandlerType;
  jobType: JobType;
  status: JobStatus;
  priority: number; // Inherited or overridden
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  idempotencyKey?: string | null;
  runAt: Date;
  timeoutMs: number;
  maxRetries: number;
  retryCount: number;
  retryPolicyId?: string | null;
  parentJobId?: string | null; // For DAG or Batch child
  scheduledJobId?: string | null; // For Recurring/Cron trigger
  claimedByWorkerId?: string | null;
  claimedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDependency {
  id: string;
  parentJobId: string;
  childJobId: string;
  createdAt: Date;
}

export interface ScheduledJob {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: JobHandlerType;
  cronExpression: string;
  timezone: string;
  payload: Record<string, any>;
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

export interface Worker {
  id: string;
  hostname: string;
  concurrencyLimit: number;
  activeJobsCount: number;
  status: WorkerStatus;
  ipAddress?: string | null;
  version: string;
  registeredAt: Date;
  lastHeartbeatAt: Date;
}

export interface WorkerHeartbeat {
  id: string;
  workerId: string;
  cpuUsage: number;
  memoryUsage: number;
  activeJobs: number;
  recordedAt: Date;
}

export interface JobExecution {
  id: string;
  jobId: string;
  attemptNumber: number;
  workerId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  createdAt: Date;
}

export interface JobLog {
  id: string;
  jobExecutionId: string;
  jobId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: Date;
}

export interface DeadLetterQueueEntry {
  id: string;
  jobId: string;
  queueId: string;
  projectId: string;
  originalPayload: Record<string, any>;
  failureReason: string;
  errorDetails?: Record<string, any> | null;
  totalAttempts: number;
  deadLetteredAt: Date;
  replayedAt?: Date | null;
  replayedJobId?: string | null;
}
