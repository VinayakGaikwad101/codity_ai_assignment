# Design Decisions & Architectural Trade-Offs

## 1. Engine Choice: PostgreSQL `SKIP LOCKED` vs Redis BullMQ vs Apache Kafka

| Feature / Metric | PostgreSQL `SKIP LOCKED` (Chosen) | Redis BullMQ / Sidekiq | Apache Kafka / RabbitMQ |
| :--- | :--- | :--- | :--- |
| **Transaction Atomicity** | **Native ACID**: Ingestion, status updates, and DAG dependencies occur in 1 transaction. | Non-transactional across DB and Redis without 2-phase commit. | No native DB transaction support; requires outbox pattern. |
| **Durability & Persistence** | **Zero Data Loss**: WAL-backed, strictly crash-resilient. | In-memory with snapshotting (AOF/RDB); risk of data loss on crash. | Durable disk partitions, but heavy operational complexity. |
| **Complex Queries & Audit** | **Full SQL**: Filter by tenant, status, priority, timestamps, and JSON payloads. | Limited key-value lookups; complex sorting requires Redis Lua scripts. | Append-only streams; querying past arbitrary job states requires custom indices. |
| **Operational Simplicity** | **Single Infrastructure Dependency**: Zero Redis/Zookeeper clusters to manage. | Requires maintaining both Redis and a relational DB. | Requires JVM runtime, Zookeeper/KRaft, and broker topologies. |

**Rationale**: For mission-critical background jobs (e.g. financial ledger settlements, KYC verifications, billing workflows), transactional integrity and deterministic auditing outweigh ultra-high-throughput streaming. PostgreSQL with `FOR UPDATE SKIP LOCKED` easily processes $> 5,000$ jobs/sec per table with composite indexes while providing complete relational auditability.

---

## 2. Concurrency & Race Condition Elimination

### Row-Level Locking Protocol
When multiple distributed workers poll a shared queue:
1. Worker issues `SELECT id FROM jobs WHERE "queueId" = $1 AND status = 'QUEUED' AND "runAt" <= NOW() ORDER BY priority DESC, "runAt" ASC LIMIT $2 FOR UPDATE SKIP LOCKED`.
2. PostgreSQL locks the selected rows.
3. Concurrent workers issuing the same query instantly skip those rows without blocking, deadlocking, or claiming duplicates.
4. The worker updates the status to `CLAIMED` and assigns its `claimedByWorkerId` in the same transaction.

---

## 3. Resilience & Failure Modes

### Monotonic Execution History
When a job fails and is retried or replayed:
- Attempt numbers monotonically increment ($1 \rightarrow 2 \rightarrow 3 \rightarrow \text{Replay} \rightarrow 4$).
- Every execution attempt is persisted in `job_executions` alongside duration, worker ID, error message, and stack trace.
- Console output is streamed into `job_logs` with log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`).

### Full Jitter Backoff
To prevent the **Thundering Herd** problem where hundreds of retrying jobs hammer downstream services at the exact same second:
$$D_{\text{actual}} = D_{\text{calculated}} \times \text{Uniform}(0.75, 1.25)$$

### Dead Worker Detection (Zombie Reaper)
- Workers report heartbeats every 5 seconds.
- The Reaper marks nodes `OFFLINE` if silent for $> 15$ seconds.
- In-flight jobs claimed by dead nodes are automatically recovered and returned to `QUEUED` status.
