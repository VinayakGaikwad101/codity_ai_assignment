export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T = any> {
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

export interface SystemMetricsOverview {
  totalQueues: number;
  activeWorkers: number;
  totalJobsProcessed: number;
  jobsRunning: number;
  jobsQueued: number;
  jobsFailed: number;
  jobsDeadLettered: number;
  overallSuccessRate: number;
}

export interface ThroughputDataPoint {
  hour: string;
  completed: number;
  failed: number;
}

export interface WebSocketEvent<T = any> {
  event: 'JOB_QUEUED' | 'JOB_CLAIMED' | 'JOB_RUNNING' | 'JOB_COMPLETED' | 'JOB_FAILED' | 'JOB_DEAD_LETTERED' | 'QUEUE_UPDATED' | 'WORKER_HEARTBEAT';
  timestamp: string;
  payload: T;
}
