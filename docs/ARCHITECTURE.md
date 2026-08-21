# System Architecture & Component Design

## 1. High-Level System Architecture

The Distributed Job Scheduling Platform is architected as a modular, decoupled distributed system consisting of four primary tiers:

1. **Presentation Tier (React Web Dashboard)**: Vite-powered single-page application providing real-time operational control, queue configuration, worker fleet monitoring, and log streaming over WebSockets.
2. **API & Control Plane Tier (Express Server)**: Stateless REST API gateway responsible for user authentication (JWT), machine authentication (API Keys), queue/job ingress, validation, and WebSocket broadcasting.
3. **Data Storage & Coordination Tier (PostgreSQL 16)**: Centralized relational persistence and state-coordination engine using transaction isolation and row-level locking (`FOR UPDATE SKIP LOCKED`).
4. **Distributed Worker Fleet Tier (Autonomous Worker Processes)**: Horizontally scalable worker nodes that poll queues, atomically acquire jobs, execute handlers concurrently within bounded slot pools, emit heartbeats, and handle graceful shutdown.

```mermaid
graph TD
    Client["React Web Dashboard (Vite + Tailwind)"] -->|REST API & WebSockets| Gateway["API Gateway / Control Plane (Express + TS)"]
    IngestClient["External API Ingest Client"] -->|REST with API Key| Gateway

    subgraph "Control Plane"
        Gateway --> Auth["Auth & RBAC Middleware"]
        Gateway --> JobAPI["Job & Batch Ingress"]
        Gateway --> QueueAPI["Queue & Policy Manager"]
        Gateway --> WSHub["WebSocket Broadcast Hub"]
    end

    subgraph "Storage & State Machine Tier"
        Database[("PostgreSQL 16 Relational Database")]
    end

    Gateway -->|Read / Write State| Database

    subgraph "Distributed Worker Fleet"
        Worker1["Worker Node 1 (Slot Pool: 5)"]
        Worker2["Worker Node 2 (Slot Pool: 5)"]
        WorkerN["Worker Node N (Slot Pool: 5)"]
    end

    Worker1 -->|Atomic SELECT FOR UPDATE SKIP LOCKED| Database
    Worker2 -->|Atomic SELECT FOR UPDATE SKIP LOCKED| Database
    WorkerN -->|Atomic SELECT FOR UPDATE SKIP LOCKED| Database

    Worker1 -->|Heartbeats & Telemetry| Database
    Worker2 -->|Heartbeats & Telemetry| Database
    WorkerN -->|Heartbeats & Telemetry| Database
```

---

## 2. Distributed Job Lifecycle State Machine

Every background job transitions through a strictly validated finite state machine:

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Immediate Job Submitted
    [*] --> SCHEDULED : Delayed / Scheduled / Workflow Node
    
    SCHEDULED --> QUEUED : Target runAt Reached & Dependencies Resolved
    QUEUED --> CLAIMED : Worker acquires lock via SKIP LOCKED
    CLAIMED --> RUNNING : Worker spawns execution task
    
    RUNNING --> COMPLETED : Execution Success
    RUNNING --> SCHEDULED : Execution Failure (Retries Remaining)
    RUNNING --> DEAD_LETTERED : Execution Failure (Retries Exhausted)
    
    QUEUED --> CANCELLED : User Cancellation
    SCHEDULED --> CANCELLED : User Cancellation
    
    DEAD_LETTERED --> QUEUED : Manual Replay via DLQ Console
    FAILED --> QUEUED : Manual Retry
    
    COMPLETED --> [*]
    CANCELLED --> [*]
```

---

## 3. End-to-End Data Flow Sequence

### A. Atomic Claim & Execution Flow
```mermaid
sequenceDiagram
    autonumber
    participant W as Worker Process
    participant DB as PostgreSQL DB
    participant WS as WebSocket Hub
    participant UI as Web Dashboard

    loop Every Poll Interval (500ms)
        W->>DB: BEGIN TRANSACTION
        W->>DB: SELECT id FROM jobs WHERE status IN ('QUEUED', 'SCHEDULED') AND run_at <= NOW() ORDER BY priority DESC, run_at ASC LIMIT N FOR UPDATE SKIP LOCKED
        Note over W,DB: Non-blocking row-level lock acquired on ready jobs
        W->>DB: UPDATE jobs SET status = 'CLAIMED', claimed_by_worker_id = workerId, claimed_at = NOW() WHERE id = ANY(jobIds)
        W->>DB: COMMIT TRANSACTION
    end

    opt Jobs Claimed > 0
        W->>DB: INSERT INTO job_executions (job_id, attempt_number, status, started_at)
        W->>DB: UPDATE jobs SET status = 'RUNNING', started_at = NOW()
        W->>WS: Broadcast JOB_STARTED
        WS->>UI: Update live UI state & badges

        W->>W: Execute Handler with Timeout Guard
        
        alt Execution Succeeded
            W->>DB: UPDATE job_executions SET status = 'SUCCESS', duration_ms = elapsed
            W->>DB: UPDATE jobs SET status = 'COMPLETED', result = payload, completed_at = NOW()
            W->>WS: Broadcast JOB_COMPLETED
        else Execution Failed & Retries Remain
            W->>W: Calculate Backoff with Jitter (Exponential/Linear/Fixed)
            W->>DB: UPDATE job_executions SET status = 'FAILED', error_message = err
            W->>DB: UPDATE jobs SET status = 'SCHEDULED', retry_count = count + 1, run_at = nextRunAt
            W->>WS: Broadcast JOB_RETRY
        else Retries Exhausted
            W->>DB: UPDATE job_executions SET status = 'FAILED'
            W->>DB: UPDATE jobs SET status = 'DEAD_LETTERED'
            W->>DB: INSERT INTO dead_letter_queue (job_id, queue_id, failure_reason)
            W->>WS: Broadcast JOB_DEAD_LETTERED
        end
    end
```

---

## 4. Concurrency, Fault Tolerance & Worker Reaping

1. **Atomic Concurrency (`SKIP LOCKED`)**:
   - Multiple worker processes poll the same database table concurrently without blocking one another or incurring race conditions.
   - When Worker A locks Job 1, Worker B's transaction immediately skips Job 1 and acquires Job 2 in $O(1)$ index time.
2. **Heartbeat Telemetry**:
   - Workers emit a periodic heartbeat every 5 seconds recording timestamp, active slot load, CPU load, and memory usage.
3. **Dead Worker Reaper Daemon**:
   - A background daemon checks for worker nodes with no heartbeat for $>15$ seconds.
   - When a node is declared `DEAD`, any jobs stranded in `CLAIMED` or `RUNNING` state are automatically re-queued (or sent to DLQ if max retries were exhausted), guaranteeing zero abandoned jobs.
4. **Graceful Drain on Shutdown**:
   - On `SIGINT`/`SIGTERM`, workers stop accepting new claims, pause polling, allow in-flight promises up to 30 seconds to finish, deregister cleanly, and release unstarted claims.
