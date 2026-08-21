# Relational Database Design & Schema Specification

## 1. Entity-Relationship (ER) Diagram

The system employs a 3NF relational database schema modeled in PostgreSQL across **14 core entities**:

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "has members"
    ORGANIZATIONS ||--o{ PROJECTS : "owns"
    
    PROJECTS ||--o{ API_KEYS : "authenticates"
    PROJECTS ||--o{ RETRY_POLICIES : "defines"
    PROJECTS ||--o{ QUEUES : "contains"
    PROJECTS ||--o{ JOBS : "tracks"
    PROJECTS ||--o{ SCHEDULED_JOBS : "schedules"
    PROJECTS ||--o{ DEAD_LETTER_QUEUE : "quarantines"

    QUEUES ||--o{ JOBS : "enqueues"
    QUEUES ||--o{ SCHEDULED_JOBS : "targets"
    QUEUES ||--o{ DEAD_LETTER_QUEUE : "routes"
    RETRY_POLICIES ||--o{ QUEUES : "defaults"
    RETRY_POLICIES ||--o{ JOBS : "governs"

    JOBS ||--o{ JOB_EXECUTIONS : "audit history"
    JOBS ||--o{ JOB_LOGS : "emits"
    JOBS ||--o{ DEAD_LETTER_QUEUE : "quarantine record"
    JOBS ||--o{ JOB_DEPENDENCIES : "parent / child DAG"

    WORKERS ||--o{ WORKER_HEARTBEATS : "pings"
    WORKERS ||--o{ JOB_EXECUTIONS : "executes"
    WORKERS ||--o{ JOBS : "claims"
    
    JOB_EXECUTIONS ||--o{ JOB_LOGS : "captures"

    ORGANIZATIONS {
        uuid id PK
        varchar name
        varchar slug UK
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        uuid id PK
        uuid organization_id FK
        varchar email UK
        varchar password_hash
        varchar name
        enum role
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar slug
        varchar description
        timestamp created_at
    }

    API_KEYS {
        uuid id PK
        uuid project_id FK
        varchar name
        varchar key_prefix
        varchar hashed_key UK
        timestamp last_used_at
        timestamp expires_at
    }

    RETRY_POLICIES {
        uuid id PK
        uuid project_id FK
        varchar name
        enum strategy
        int max_retries
        int base_delay_ms
        int max_delay_ms
        boolean jitter
    }

    QUEUES {
        uuid id PK
        uuid project_id FK
        varchar name
        int priority
        int concurrency_limit
        int rate_limit_per_min
        boolean is_paused
        uuid retry_policy_id FK
    }

    JOBS {
        uuid id PK
        uuid project_id FK
        uuid queue_id FK
        varchar name
        enum handler_type
        enum job_type
        enum status
        int priority
        jsonb payload
        jsonb result
        varchar idempotency_key UK
        timestamp run_at
        int timeout_ms
        int max_retries
        int retry_count
        uuid retry_policy_id FK
        uuid parent_job_id FK
        uuid scheduled_job_id FK
        uuid claimed_by_worker_id FK
        timestamp claimed_at
        timestamp started_at
        timestamp completed_at
    }

    JOB_DEPENDENCIES {
        uuid id PK
        uuid parent_job_id FK
        uuid child_job_id FK
        timestamp created_at
    }

    SCHEDULED_JOBS {
        uuid id PK
        uuid project_id FK
        uuid queue_id FK
        varchar name
        varchar cron_expression
        varchar timezone
        jsonb payload
        boolean is_active
        timestamp next_run_at
    }

    WORKERS {
        uuid id PK
        varchar hostname
        int concurrency_limit
        int active_jobs_count
        enum status
        varchar ip_address
        timestamp last_heartbeat_at
    }

    WORKER_HEARTBEATS {
        uuid id PK
        uuid worker_id FK
        float cpu_usage
        float memory_usage
        int active_jobs
        timestamp recorded_at
    }

    JOB_EXECUTIONS {
        uuid id PK
        uuid job_id FK
        int attempt_number
        uuid worker_id FK
        enum status
        timestamp started_at
        timestamp completed_at
        int duration_ms
        text error_message
    }

    JOB_LOGS {
        uuid id PK
        uuid job_execution_id FK
        uuid job_id FK
        enum level
        text message
        jsonb metadata
        timestamp timestamp
    }

    DEAD_LETTER_QUEUE {
        uuid id PK
        uuid job_id FK
        uuid queue_id FK
        uuid project_id FK
        jsonb original_payload
        text failure_reason
        jsonb error_details
        int total_attempts
        timestamp dead_lettered_at
    }
```

---

## 2. Normalization Analysis (3NF Compliance)

1. **First Normal Form (1NF)**:
   - All attributes are atomic. Payload and results use native JSONB documents for arbitrary unstructured parameters without repeating table columns.
   - Every entity has a strictly unique Primary Key (`UUIDv4`).
2. **Second Normal Form (2NF)**:
   - All non-key attributes are fully functionally dependent on the primary key.
   - For example, `job_executions` depends strictly on `id`, referencing `job_id` and `worker_id` via foreign keys rather than storing worker or job metadata redundantly.
3. **Third Normal Form (3NF)**:
   - No transitive dependencies exist.
   - Queue configurations, retry policy rules, user details, and organization bounds are normalized into dedicated relations.

---

## 3. Referential Integrity & Cascading Behavior

| Relationship | Foreign Key Constraint | Cascading Behavior | Rationale |
| :--- | :--- | :--- | :--- |
| `users` $\rightarrow$ `organizations` | `organization_id` | `ON DELETE CASCADE` | Removing a tenant organization cleanly purges its member accounts. |
| `projects` $\rightarrow$ `organizations` | `organization_id` | `ON DELETE CASCADE` | Removing a tenant organization removes all child projects. |
| `queues` $\rightarrow$ `projects` | `project_id` | `ON DELETE CASCADE` | Deleting a project cascades to its queues and jobs. |
| `jobs` $\rightarrow$ `queues` | `queue_id` | `ON DELETE CASCADE` | Deleting a queue cascades to its contained jobs. |
| `jobs` $\rightarrow$ `retry_policies` | `retry_policy_id` | `ON DELETE SET NULL` | Deleting a retry policy resets jobs to system default fallback without deleting the jobs. |
| `jobs` $\rightarrow$ `workers` | `claimed_by_worker_id` | `ON DELETE SET NULL` | If a worker record is deleted, claimed jobs have their worker reference cleared for reaper reclamation. |
| `job_executions` $\rightarrow$ `jobs` | `job_id` | `ON DELETE CASCADE` | Deleting a job cleanly purges its execution attempt audit logs. |
| `job_logs` $\rightarrow$ `job_executions` | `job_execution_id` | `ON DELETE CASCADE` | Deleting an execution attempt cascades to its log lines. |
| `job_dependencies` $\rightarrow$ `jobs` | `parent_job_id`, `child_job_id` | `ON DELETE CASCADE` | Deleting either parent or child removes the DAG dependency edge. |

---

## 4. Indexing Strategy & Performance Considerations

### Crucial Indices for Atomic Queue Claiming
1. **`jobs(queue_id, status, run_at, priority DESC)`**:
   - **Purpose**: Powers the high-frequency atomic worker claiming query (`SELECT ... FOR UPDATE SKIP LOCKED`).
   - **Optimization**: Avoids full table scans by matching the compound index on non-paused queues, ready statuses (`QUEUED`, `SCHEDULED`), due timestamps (`run_at <= NOW()`), and ordering by highest priority first.
2. **`jobs(project_id, idempotency_key)` [UNIQUE SPARSE]**:
   - **Purpose**: Fast $O(1)$ deduplication check ensuring at-most-once job creation per project.
3. **`worker_heartbeats(worker_id, recorded_at DESC)`**:
   - **Purpose**: Rapid worker liveness checks and CPU/Memory time-series queries.
4. **`job_executions(job_id, attempt_number)`**:
   - **Purpose**: Instant retrieval of attempt history and duration timeline in the Job Explorer drawer.
5. **`scheduled_jobs(is_active, next_run_at)`**:
   - **Purpose**: Allows the CronRunner daemon to scan only active recurring jobs due for execution.
