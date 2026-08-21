# Engineering Design Decisions & Architectural Trade-offs

This document details the technical rationale, architectural decisions, and trade-offs made during the design of the **Distributed Job Scheduling Platform**.

---

## 1. Atomic Job Claiming: PostgreSQL `SKIP LOCKED` vs. Redis (BullMQ / Redis Streams)

### Technical Choice: PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`
For atomic job acquisition across concurrent worker nodes, we chose PostgreSQL's native `FOR UPDATE SKIP LOCKED` mechanism over an in-memory Redis message broker.

### Evaluation & Trade-off Analysis:

| Architectural Dimension | PostgreSQL `SKIP LOCKED` (Chosen) | Redis / BullMQ |
| :--- | :--- | :--- |
| **ACID Guarantees** | **Strong ACID Transactions**: Atomic state transitions from `QUEUED` $\rightarrow$ `CLAIMED` alongside audit log insertions in a single atomic commit. | **Eventual / Memory Consistency**: Redis data loss risk on unexpected node reboot unless append-only file (AOF) sync is enabled (which degrades throughput). |
| **Complex Relational Queries** | **Native**: Instant filtering by tenant organization, project, queue priority, DAG dependency resolution, and retry policies in $O(1)$ index time. | **Complex**: Requires custom Lua scripts, secondary indexing in Redis Hashes, or dual-writing between Redis and a relational database. |
| **Operational Overhead** | **Low**: A single relational database handles state, logs, execution audits, and metrics without coordinating two separate storage layers. | **Medium-High**: Requires managing Redis clusters, memory eviction policies, replication lag, and relational database syncing. |
| **Throughput Ceiling** | **10,000 - 50,000 claims/sec** on properly indexed composite indexes (`queue_id, status, run_at, priority DESC`). | **100,000+ operations/sec** in-memory. |

### Conclusion:
For a production-grade distributed scheduler where reliability, auditability, transactional integrity, and complex relational constraints (e.g., DAG dependencies and multi-tenant RBAC) are paramount, PostgreSQL `FOR UPDATE SKIP LOCKED` provides the highest reliability guarantees with zero external synchronization bugs.

---

## 2. Concurrency Control & Race Condition Elimination

### Challenge:
When $N$ worker processes simultaneously poll for ready jobs, traditional `SELECT ... FOR UPDATE` causes lock contention, blocking workers behind each other and severely bottlenecking throughput.

### Solution:
We combine:
1. **Row-Level Non-Blocking Locks (`SKIP LOCKED`)**:
   ```sql
   SELECT j.id FROM jobs j
   WHERE q.is_paused = FALSE AND j.status IN ('QUEUED', 'SCHEDULED') AND j.run_at <= NOW()
   ORDER BY j.priority DESC, j.run_at ASC
   LIMIT $1
   FOR UPDATE OF j SKIP LOCKED;
   ```
2. **Compound Indexing**:
   ```sql
   CREATE INDEX idx_jobs_claim_composite ON jobs (queue_id, status, run_at, priority DESC);
   ```
   This allows PostgreSQL's index scan to jump directly to ready rows and immediately lock unheld rows without inspecting locked candidates.

---

## 3. Fault Tolerance & Dead Worker Reclamation

### Challenge:
If a worker process experiences a catastrophic crash (`kill -9`, hardware failure, kernel out-of-memory), jobs in `CLAIMED` or `RUNNING` status become orphaned zombies.

### Solution: Dual Liveness & Reaper Architecture:
1. **Active Heartbeat Loop**: Every healthy worker emits a heartbeat every $T_{heartbeat} = 5s$ recording timestamp, CPU load, and active job count.
2. **Reaper Daemon**: A centralized reaper passes through worker records every $T_{reap} = 10s$.
3. **Threshold Strategy**: If a worker has emitted no heartbeat for $T_{stale} > 15s$:
   - Worker status is marked `DEAD`.
   - All in-flight jobs belonging to that worker are reclaimed:
     - If `retryCount < maxRetries`: Re-queued to `QUEUED` state with an explicit failure audit log.
     - If retries exhausted: Routed directly to the `dead_letter_queue` (DLQ).

---

## 4. Retry Backoff Strategy & Thundering Herd Prevention

When an external service or database dependency fails, thousands of retry attempts firing simultaneously at fixed intervals will overwhelm the downstream service (the "thundering herd" problem).

### Solution: Full Jitter Exponential Backoff
We implement exponential backoff with full randomized jitter:
$$\text{Delay} = \min\left(\text{MaxDelay}, \text{random}(200\text{ms}, \text{BaseDelay} \times 2^{\text{Attempt}-1})\right)$$

- **Fixed Interval**: Predictable for periodic internal polling.
- **Linear Backoff**: Stepped scaling for transient rate limits.
- **Exponential with Jitter (Default)**: Spreads retry traffic smoothly across the timeline, allowing downstream systems to recover cleanly.

---

## 5. DAG Workflow Dependency Resolution

To support pipeline execution (Job B and Job C run only after Job A completes):
1. Dependency edges are modeled in a dedicated `job_dependencies(parent_job_id, child_job_id)` table.
2. The atomic claiming query enforces a sub-query constraint:
   ```sql
   AND NOT EXISTS (
     SELECT 1 FROM job_dependencies jd
     JOIN jobs pj ON jd.parent_job_id = pj.id
     WHERE jd.child_job_id = j.id AND pj.status != 'COMPLETED'
   )
   ```
3. Child jobs remain in `SCHEDULED` status until all parent dependencies transition to `COMPLETED`. If a parent permanently fails into DLQ, dependent jobs are prevented from executing.

---

## 6. Scalability Bottlenecks & Future Sharding Roadmap

1. **Queue Sharding**:
   - For high-volume multi-tenant deployments, the `jobs` table can be partitioned by `project_id` or `created_at` using PostgreSQL Declarative Table Partitioning (`PARTITION BY HASH (project_id)` or `PARTITION BY RANGE (created_at)`).
2. **Read/Write Replica Splitting**:
   - Web dashboard metrics, log history, and completed job exploration queries can be routed to read replicas, preserving master database IOPS exclusively for atomic worker claims and status updates.
