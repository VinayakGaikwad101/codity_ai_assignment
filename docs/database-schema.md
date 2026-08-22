# Database Schema & Entity-Relationship Design

## 1. Entity-Relationship (ER) Diagram

The platform utilizes a 14-entity relational schema in PostgreSQL designed to Third Normal Form (3NF), guaranteeing data integrity, multi-tenant isolation, and high-concurrency indexing.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "employs"
    ORGANIZATIONS ||--o{ PROJECTS : "owns"
    ORGANIZATIONS ||--o{ API_KEYS : "issues"

    PROJECTS ||--o{ QUEUES : "defines"
    PROJECTS ||--o{ RETRY_POLICIES : "configures"
    PROJECTS ||--o{ JOBS : "contains"
    PROJECTS ||--o{ SCHEDULED_JOBS : "schedules"
    PROJECTS ||--o{ DEAD_LETTER_QUEUE_ENTRIES : "quarantines"

    RETRY_POLICIES ||--o{ QUEUES : "governs"
    RETRY_POLICIES ||--o{ JOBS : "applies_to"

    QUEUES ||--o{ JOBS : "enqueues"
    QUEUES ||--o{ SCHEDULED_JOBS : "routes_to"
    QUEUES ||--o{ DEAD_LETTER_QUEUE_ENTRIES : "records"

    JOBS ||--o{ JOB_EXECUTIONS : "attempts"
    JOBS ||--o{ JOB_LOGS : "logs"
    JOBS ||--o{ JOB_DEPENDENCIES : "depends_on"
    JOBS ||--o{ DEAD_LETTER_QUEUE_ENTRIES : "fails_to"

    WORKERS ||--o{ JOB_EXECUTIONS : "executes"
    WORKERS ||--o{ WORKER_HEARTBEATS : "telemetry"
    WORKERS ||--o{ JOBS : "claims"

    ORGANIZATIONS {
        uuid id PK
        string name
        string slug UK
        datetime createdAt
        datetime updatedAt
    }

    USERS {
        uuid id PK
        uuid organizationId FK
        string email UK
        string name
        string passwordHash
        enum role "ADMIN | OPERATOR | VIEWER"
        datetime createdAt
        datetime updatedAt
    }

    PROJECTS {
        uuid id PK
        uuid organizationId FK
        string name
        string slug
        string description
        datetime createdAt
        datetime updatedAt
    }

    QUEUES {
        uuid id PK
        uuid projectId FK
        uuid retryPolicyId FK
        string name
        string description
        int priority "0-100"
        int concurrencyLimit
        int rateLimitPerMin
        boolean isPaused
        datetime createdAt
        datetime updatedAt
    }

    JOBS {
        uuid id PK
        uuid projectId FK
        uuid queueId FK
        uuid retryPolicyId FK
        uuid parentJobId FK
        uuid scheduledJobId FK
        uuid claimedByWorkerId FK
        string name
        string handlerType
        enum jobType "IMMEDIATE | DELAYED | CRON | BATCH_PARENT | WORKFLOW_NODE"
        enum status "QUEUED | SCHEDULED | CLAIMED | RUNNING | COMPLETED | FAILED | DEAD_LETTERED | CANCELLED"
        int priority "0-100"
        jsonb payload
        jsonb result
        string idempotencyKey
        int retryCount
        int maxRetries
        int timeoutMs
        datetime runAt
        datetime startedAt
        datetime completedAt
        datetime claimedAt
        datetime createdAt
        datetime updatedAt
    }

    JOB_DEPENDENCIES {
        uuid id PK
        uuid parentJobId FK
        uuid childJobId FK
        datetime createdAt
    }

    JOB_EXECUTIONS {
        uuid id PK
        uuid jobId FK
        uuid workerId FK
        int attemptNumber
        enum status "RUNNING | SUCCESS | FAILED | TIMED_OUT"
        int durationMs
        string errorMessage
        string errorStack
        datetime startedAt
        datetime finishedAt
    }

    JOB_LOGS {
        uuid id PK
        uuid jobId FK
        uuid executionId FK
        enum level "DEBUG | INFO | WARN | ERROR"
        string message
        datetime timestamp
    }

    DEAD_LETTER_QUEUE_ENTRIES {
        uuid id PK
        uuid projectId FK
        uuid queueId FK
        uuid jobId FK
        string failureReason
        string stackTrace
        jsonb originalPayload
        int totalAttempts
        datetime deadLetteredAt
        datetime replayedAt
    }

    WORKERS {
        uuid id PK
        string hostname
        string ipAddress
        enum status "HEALTHY | DEGRADED | DRAINING | OFFLINE"
        int concurrencyLimit
        int activeJobsCount
        int totalExecutionsCount
        datetime lastHeartbeatAt
        datetime startedAt
        datetime updatedAt
    }

    WORKER_HEARTBEATS {
        uuid id PK
        uuid workerId FK
        float cpuUsage
        float memoryUsage
        int activeJobs
        datetime timestamp
    }
```

---

## 2. Indexing Strategy & Concurrency Performance

### The Critical Poller Index:
```prisma
@@index([queueId, status, runAt, priority(sort: Desc)])
```
- **Why It Matters**: The worker poller queries:
  ```sql
  WHERE "queueId" = $1 AND status = 'QUEUED' AND "runAt" <= NOW() ORDER BY priority DESC, "runAt" ASC
  ```
  Without this composite B-Tree index, PostgreSQL would execute a full table scan across millions of historical jobs on every tick. This index narrows the search space to $O(\log N)$ and evaluates the `FOR UPDATE SKIP LOCKED` filter in sub-millisecond execution time.

### Idempotency Index:
```prisma
@@index([projectId, idempotencyKey])
```
- Ensures fast $O(1)$ duplicate checking within the 24-hour retention window.

### Multi-Tenant Organization Isolation:
- Every tenant boundary has a foreign key to `Organization` and `Project` with composite unique constraints (`@@unique([organizationId, slug])`) preventing cross-tenant name collisions and data leakage.
