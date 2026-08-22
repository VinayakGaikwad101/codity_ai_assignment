# Distributed Job Scheduler: REST API Reference

Base URL: `http://localhost:4000/api/v1`

---

## 1. Authentication & RBAC

### `POST /auth/login`
Authenticates a user and returns a signed JWT.
- **Request Body**:
  ```json
  { "email": "admin@acme.com", "password": "Admin@12345" }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "name": "Vinayak Gaikwad", "email": "admin@acme.com", "role": "ADMIN" },
      "token": "eyJhbGci..."
    }
  }
  ```

### `POST /auth/register`
Creates an organization workspace and initial tenant user.
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

### `POST /auth/api-keys`
Generates a SHA-256 hashed machine API key for background microservices.
- **Header**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  { "name": "Ingestion Worker Key", "role": "OPERATOR", "expiresInDays": 90 }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "apiKey": { "id": "...", "name": "Ingestion Worker Key", "keyPrefix": "djs_live_a1b2..." },
      "rawKey": "djs_live_a1b2c3d4e5f6789012345678abcdef"
    }
  }
  ```

---

## 2. Projects & Queues

### `GET /projects`
Lists all project namespaces under the authenticated tenant organization.

### `POST /queues`
Creates an asynchronous work queue.
- **Request Body**:
  ```json
  {
    "projectId": "...",
    "name": "high-priority-settlements",
    "priority": 95,
    "concurrencyLimit": 20,
    "rateLimitPerMin": 600,
    "retryPolicyId": "..."
  }
  ```

### `POST /queues/:id/pause`
Toggles the execution gate for a queue.
- **Request Body**: `{ "isPaused": true }`

---

## 3. Job Ingestion & Management

### `POST /jobs`
Ingests an immediate or delayed task.
- **Request Body**:
  ```json
  {
    "projectId": "...",
    "queueId": "...",
    "name": "Settle Ledger Transaction TX_8801",
    "handlerType": "LEDGER_SETTLEMENT",
    "jobType": "IMMEDIATE",
    "priority": 90,
    "payload": { "account": "ACC_9921", "amount": 1450.75, "currency": "USD" },
    "idempotencyKey": "tx_8801_settle_v1"
  }
  ```

### `POST /jobs/batch`
Atomically ingests a batch parent orchestrator and child items in a single PostgreSQL transaction.

### `POST /jobs/dag`
Ingests multi-stage DAG workflow nodes with prerequisite parent dependencies.

### `GET /jobs`
Lists jobs with pagination, status filtering (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTERED`), and search.

### `GET /jobs/:id`
Retrieves full job details, execution history attempts, and streamed console logs.

---

## 4. Dead Letter Queue (DLQ) & Replay

### `GET /jobs/dlq`
Lists active quarantined jobs that exhausted all configured retries.

### `POST /jobs/dlq/:id/replay`
Atomically resets a quarantined dead-lettered job retry counter, sets `status = 'QUEUED'`, and restarts execution.

---

## 5. Worker Fleet Telemetry & Cron

### `GET /workers`
Lists all distributed worker nodes with live CPU, memory, active slot meters, and heartbeat statuses (`HEALTHY`, `DRAINING`, `OFFLINE`).

### `POST /scheduled-jobs`
Creates a recurring cron trigger using standard 5-part cron syntax (e.g. `0 * * * *`).
