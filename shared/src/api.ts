import { Job, Worker, Queue, JobLog } from './models.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QueueStatistics {
  queueId: string;
  queueName: string;
  isPaused: boolean;
  concurrencyLimit: number;
  queuedCount: number;
  scheduledCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  deadLetteredCount: number;
  avgDurationMs: number;
  throughputPerMinute: number;
}

export interface SystemMetrics {
  totalQueues: number;
  activeWorkers: number;
  totalJobsProcessed: number;
  jobsRunning: number;
  jobsQueued: number;
  jobsFailed: number;
  jobsDeadLettered: number;
  overallSuccessRate: number;
  timestamp: string;
}

// WebSocket Event Payloads
export type WsEventType =
  | 'JOB_CREATED'
  | 'JOB_CLAIMED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'JOB_RETRY'
  | 'JOB_DEAD_LETTERED'
  | 'JOB_LOG_EMITTED'
  | 'WORKER_HEARTBEAT'
  | 'WORKER_REGISTERED'
  | 'WORKER_DEAD'
  | 'QUEUE_UPDATED'
  | 'SYSTEM_METRICS_UPDATE';

export interface WsMessage<T = any> {
  event: WsEventType;
  timestamp: string;
  payload: T;
}
