# Distributed Job Scheduler: Complete REST API Reference

Base URL: `http://localhost:4000/api/v1`

All responses follow the standard JSON envelope structure:
```json
{
  "success": true,
  "data": { ... }
}
```
Or for errors:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error explanation"
  }
}
```

---

## 1. Authentication & API Key Management

### `POST /auth/register`
Creates a tenant organization workspace and initial administrator account.
- **Request Body**:
  ```json
  {
    "name": "Sarah Connor",
    "email": "sarah@cyberdyne.io",
    "password": "SecurePassword@123",
    "organizationName": "Cyberdyne Systems",
    "role": "ADMIN"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "36db9807-7d95-4dda-9363-fd0863dee9a7",
        "email": "sarah@cyberdyne.io",
        "name": "Sarah Connor",
        "role": "ADMIN",
        "organizationId": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
        "organizationName": "Cyberdyne Systems"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### `POST /auth/login`
Authenticates a user with email and password, returning a signed JWT.
- **Request Body**:
  ```json
  {
    "email": "admin@acme.com",
    "password": "Admin@12345"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "13aecf42-e22e-47ea-9655-854386d46b2d",
        "email": "admin@acme.com",
        "name": "Vinayak Gaikwad (Admin)",
        "role": "ADMIN",
        "organizationId": "36db9807-7d95-4dda-9363-fd0863dee9a7"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### `POST /auth/api-keys`
Generates a SHA-256 hashed machine API key for background microservices.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "name": "Payment Ingestion Service Key",
    "role": "OPERATOR",
    "projectId": "a2426c8f-a0ac-4a6b-900e-93a12e89fe5e",
    "expiresInDays": 90
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "apiKey": {
        "id": "67b93807-1234-4dda-9363-fd0863dee9a7",
        "name": "Payment Ingestion Service Key",
        "keyPrefix": "djs_live_a1b2",
        "role": "OPERATOR",
        "projectId": "a2426c8f-a0ac-4a6b-900e-93a12e89fe5e",
        "expiresAt": "2026-11-20T12:00:00.000Z"
      },
      "rawKey": "djs_live_a1b2c3d4e5f6789012345678abcdef"
    }
  }
  ```

### `GET /auth/api-keys`
Lists all machine API keys issued under the tenant organization.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "67b93807-1234-4dda-9363-fd0863dee9a7",
        "name": "Payment Ingestion Service Key",
        "keyPrefix": "djs_live_a1b2",
        "role": "OPERATOR",
        "lastUsedAt": "2026-08-22T08:00:00.000Z",
        "createdAt": "2026-08-22T05:00:00.000Z"
      }
    ]
  }
  ```

### `DELETE /auth/api-keys/:id`
Revokes an API key permanently.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response `200 OK`**: `{ "success": true, "data": { "revoked": true } }`

---

## 2. Project Workspace Management

### `POST /projects`
Creates an isolated project namespace.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "name": "Payment Gateway Pipeline",
    "description": "High-throughput transaction settlement queues"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
      "name": "Payment Gateway Pipeline",
      "slug": "payment-gateway-pipeline",
      "organizationId": "36db9807-7d95-4dda-9363-fd0863dee9a7"
    }
  }
  ```

### `GET /projects`
Lists all projects belonging to the tenant organization.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
        "name": "Payment Gateway Pipeline",
        "slug": "payment-gateway-pipeline",
        "_count": { "queues": 3, "jobs": 45 }
      }
    ]
  }
  ```

### `GET /projects/:id`
Retrieves single project details including its defined queues and retry policies.

---

## 3. Queue Management & Concurrency Controls

### `POST /queues`
Defines an asynchronous work queue with priority and limits.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "projectId": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
    "name": "instant-settlements",
    "description": "Instant payment transaction settlements",
    "priority": 90,
    "concurrencyLimit": 15,
    "rateLimitPerMin": 500,
    "retryPolicyId": "88ae1eb1-c4e8-42ee-a934-4b66a57f5d3c"
  }
  ```

### `GET /queues?projectId=<uuid>`
Lists all queues in a project with live calculated metrics (`queuedCount`, `runningCount`, `completedCount`, `failedCount`).

### `GET /queues/:id`
Retrieves full queue details by UUID.

### `POST /queues/:id/pause`
Toggles the execution gate for a queue.
- **Request Body**: `{ "isPaused": true }`
- **Response `200 OK`**: `{ "success": true, "data": { "id": "...", "isPaused": true } }`

---

## 4. Retry Policies

### `POST /retry-policies`
Creates a configurable mathematical retry policy.
- **Request Body**:
  ```json
  {
    "projectId": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
    "name": "Exponential Backoff with Full Jitter",
    "strategy": "EXPONENTIAL",
    "maxRetries": 3,
    "initialIntervalMs": 1000,
    "maxIntervalMs": 30000,
    "backoffMultiplier": 2.0,
    "useJitter": true
  }
  ```

### `GET /retry-policies?projectId=<uuid>`
Lists all retry policies configured for a project.

---

## 5. Job Ingestion & Execution Engine

### `POST /jobs`
Ingests an immediate or delayed task.
- **Headers**: `Authorization: Bearer <jwt>` or `X-API-Key: <key>`
- **Request Body**:
  ```json
  {
    "projectId": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
    "queueId": "177e78c5-e79e-46f7-8c9e-3bd6aadac9e5",
    "name": "Settle Ledger Transaction TX_8801",
    "handlerType": "LEDGER_SETTLEMENT",
    "jobType": "IMMEDIATE",
    "priority": 90,
    "payload": { "account": "ACC_9921", "amount": 1450.75, "currency": "USD" },
    "idempotencyKey": "tx_8801_settle_v1"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "843569cb-6585-46a4-be19-df1aa35dbf45",
      "status": "QUEUED",
      "priority": 90,
      "runAt": "2026-08-22T08:00:00.000Z"
    }
  }
  ```

### `POST /jobs/batch`
Atomically spawns a batch parent orchestrator and multiple parallel child items in 1 transaction.
- **Request Body**:
  ```json
  {
    "projectId": "55ae1eb1-c4e8-42ee-a934-4b66a57f5d3c",
    "queueId": "177e78c5-e79e-46f7-8c9e-3bd6aadac9e5",
    "batchName": "Morning KYC Verification Batch",
    "jobs": [
      { "name": "KYC User #1", "handlerType": "KYC_VERIFY", "payload": { "userId": "u101" } },
      { "name": "KYC User #2", "handlerType": "KYC_VERIFY", "payload": { "userId": "u102" } }
    ]
  }
  ```

### `GET /jobs?projectId=<uuid>&status=<status>&page=1&limit=10&search=<term>`
Lists jobs with pagination, status tabs (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTERED`, `SCHEDULED`, `CANCELLED`), and fuzzy search.

### `GET /jobs/:id`
Retrieves full job details, payload, execution result, worker assignment, and timestamped console logs.

### `POST /jobs/:id/cancel`
Cancels a `QUEUED` or `SCHEDULED` task before it is claimed.

### `POST /jobs/:id/retry`
Manually re-queues a `FAILED`, `DEAD_LETTERED`, or `CANCELLED` job.

---

## 6. Dead Letter Queue (DLQ) & LangChain AI Diagnostics

### `GET /jobs/dlq?projectId=<uuid>&page=1&limit=10`
Lists active quarantined jobs that exhausted all retry attempts.

### `GET /jobs/dlq/:id/ai-summary`
Uses LangChain and Gemini LLM (`gemini-3.1-flash-lite`) to diagnose root cause and suggest remediation steps.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "rootCause": "Downstream Service Unavailable (HTTP 503)",
      "category": "DOWNSTREAM_OUTAGE",
      "severity": "HIGH",
      "explanation": "The job failed after 6 attempts because the payment gateway returned HTTP 503.",
      "recommendations": [
        "Verify downstream payment provider operational status page.",
        "Check circuit breaker thresholds.",
        "Trigger an atomic 1-click Replay once the provider recovers."
      ]
    }
  }
  ```

### `POST /jobs/dlq/:id/replay`
Atomically clears the job from quarantine, resets retry counters, and transitions `status = 'QUEUED'`.

---

## 7. Worker Fleet & Scheduled Cron

### `GET /workers`
Lists all distributed worker nodes with live CPU %, RAM %, active slot meters, and heartbeat status (`HEALTHY`, `DRAINING`, `OFFLINE`).

### `POST /scheduled-jobs`
Creates a recurring cron trigger using standard 5-part cron syntax (e.g. `0 * * * *`).

### `GET /scheduled-jobs?projectId=<uuid>`
Lists active cron schedules with `nextRunAt` timestamps and execution history.

### `DELETE /scheduled-jobs/:id`
Deletes a recurring cron schedule.
