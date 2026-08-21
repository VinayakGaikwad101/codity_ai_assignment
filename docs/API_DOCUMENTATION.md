# REST API Documentation & Specification

Base URL: `http://localhost:4000/api/v1`  
WebSocket URL: `ws://localhost:4000/ws`

---

## 1. Authentication & Standard Envelopes

All protected endpoints require authentication using either:
1. **User JWT Token**: `Authorization: Bearer <jwt_token>`
2. **Project API Key**: `x-api-key: djs_live_...` or `Authorization: Bearer djs_live_...`

### Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

### Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | BAD_REQUEST",
    "message": "Human readable error summary",
    "details": [ ... ]
  }
}
```

---

## 2. Authentication Endpoints

### `POST /auth/login`
Authenticates user and returns JWT token with role metadata.

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "Admin@12345"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "481e317c-6a69-40d5-88d5-4c08310a23b1",
      "name": "Vinayak Gaikwad (Admin)",
      "email": "admin@acme.com",
      "role": "ADMIN",
      "organization": {
        "id": "org_uuid",
        "name": "Acme Cloud Platform",
        "slug": "acme-cloud"
      }
    }
  }
}
```

### `POST /auth/register`
Provisions a new tenant user and organization.

### `GET /auth/me`
Retrieves currently authenticated session context.

### `POST /auth/api-keys` (Requires `ADMIN` or `OPERATOR`)
Generates cryptographically random `djs_live_...` token.

---

## 3. Queue Management Endpoints

### `POST /queues`
Creates a new queue in a project with priority and concurrency bounds.

**Request Body:**
```json
{
  "projectId": "e2dd52b0-0caf-46ec-a87e-03d342f85255",
  "name": "transactional-emails",
  "description": "High priority user emails",
  "priority": 90,
  "concurrencyLimit": 10,
  "rateLimitPerMin": 120,
  "retryPolicyId": "retry_policy_uuid"
}
```

### `GET /queues`
Lists all queues with aggregated live statistics.

### `POST /queues/:id/pause`
Instantly pauses or resumes queue execution across all worker nodes.

**Request Body:**
```json
{
  "isPaused": true
}
```

### `GET /queues/:id/stats`
Returns real-time queue metrics:
```json
{
  "success": true,
  "data": {
    "queueId": "queue_uuid",
    "queueName": "high-priority-emails",
    "isPaused": false,
    "concurrencyLimit": 10,
    "queuedCount": 12,
    "scheduledCount": 3,
    "runningCount": 2,
    "completedCount": 1420,
    "failedCount": 4,
    "deadLetteredCount": 1,
    "avgDurationMs": 240,
    "throughputPerMinute": 85
  }
}
```

---

## 4. Job Submission & Management Endpoints

### `POST /jobs`
Submits an immediate, delayed, scheduled, or DAG workflow job.

**Request Body:**
```json
{
  "projectId": "e2dd52b0-0caf-46ec-a87e-03d342f85255",
  "queueId": "queue_uuid",
  "name": "Process Customer Invoice #9910",
  "handlerType": "CUSTOM_COMPUTE",
  "jobType": "IMMEDIATE",
  "priority": 75,
  "payload": { "invoiceId": 9910, "amount": 250.00 },
  "idempotencyKey": "inv_9910_submit",
  "timeoutMs": 30000,
  "delayMs": 0,
  "dependsOnJobIds": []
}
```

### `POST /jobs/batch`
Atomically enqueues a batch of $N$ jobs under a single parent batch record.

**Request Body:**
```json
{
  "projectId": "project_uuid",
  "queueId": "queue_uuid",
  "batchName": "Bulk Customer Newsletter",
  "jobs": [
    { "name": "Email recipient 1", "handlerType": "SAMPLE_EMAIL", "payload": { "to": "user1@example.com" } },
    { "name": "Email recipient 2", "handlerType": "SAMPLE_EMAIL", "payload": { "to": "user2@example.com" } }
  ]
}
```

### `GET /jobs`
Filterable and paginated job explorer query.
- Query Parameters: `page`, `limit`, `status`, `queueId`, `search`, `sortBy`, `sortOrder`.

### `GET /jobs/:id`
Retrieves comprehensive job details including:
- Payload & Execution Result
- Full list of execution attempts (`startedAt`, `completedAt`, `durationMs`, `errorStack`)
- Streaming output logs (`jobLogs`)
- Parent/child DAG dependencies

### `POST /jobs/:id/retry`
Manually re-enqueues a failed or dead-lettered job.

### `POST /jobs/:id/cancel`
Cancels a queued or scheduled job before worker acquisition.

---

## 5. Dead Letter Queue (DLQ) Endpoints

### `GET /jobs/dlq`
Lists quarantined jobs with diagnostic failure reasons and payload dumps.

### `POST /jobs/dlq/:id/replay`
Replays a quarantined job by resetting retry counters and re-enqueuing it into its original queue.

---

## 6. Scheduled Recurring Cron Endpoints

### `POST /scheduled-jobs`
Creates a recurring cron schedule.

**Request Body:**
```json
{
  "projectId": "project_uuid",
  "queueId": "queue_uuid",
  "name": "Hourly Database Backup",
  "cronExpression": "0 * * * *",
  "timezone": "UTC",
  "payload": { "backupType": "full" }
}
```

### `PATCH /scheduled-jobs/:id/toggle`
Enables or disables an automated cron trigger (`{ "isActive": true }`).

---

## 7. Metrics & Observability Endpoints

### `GET /metrics/overview`
Returns global health metrics: active queues, healthy worker nodes, jobs running, backlog, failure rates, and success percentage.

### `GET /metrics/throughput`
Returns 24-hour time-series throughput aggregation with completed/failed buckets and average duration per hour.

### `GET /workers`
Lists registered worker nodes, status (`HEALTHY`, `STALE`, `DEAD`), active slots, and CPU/Memory load.

---

## 8. WebSocket Live Streaming (`ws://localhost:4000/ws`)

Connect to `/ws` to receive live JSON broadcast messages:
- `JOB_STARTED`: `{ jobId, workerId, timestamp }`
- `JOB_COMPLETED`: `{ jobId, durationMs, result }`
- `JOB_FAILED`: `{ jobId, attemptNumber, error }`
- `JOB_DEAD_LETTERED`: `{ jobId, failureReason }`
- `WORKER_HEARTBEAT`: `{ workerId, cpuUsage, memoryUsage, activeJobs }`
- `SYSTEM_METRICS_UPDATE`: `{ overviewMetrics }`
