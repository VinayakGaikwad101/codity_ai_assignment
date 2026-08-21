# Distributed Job Scheduler Platform

A production-inspired, highly scalable, and fault-tolerant distributed job scheduling platform capable of reliably executing asynchronous background jobs across multiple worker processes.

## Features Overview
- **Multi-Tenant Project & Queue Management**: Projects own isolated queues with custom priority, concurrency limits, rate limiting, and pause/resume capabilities.
- **Rich Job Types**: Immediate, Delayed, Scheduled (`run_at`), Recurring (`cron`), Batch jobs, and DAG Workflows.
- **Atomic Job Claiming**: Non-blocking atomic job acquisition via PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Fault-Tolerant Worker Fleet**: Configurable worker pools, heartbeats, dead-worker reaper daemons, and graceful shutdown drains.
- **Configurable Retry & DLQ**: Fixed delay, linear backoff, and exponential backoff with full jitter, routing exhausted failures to a Dead Letter Queue.
- **Real-Time Observability**: Live dashboard with queue health, worker status, execution logs, throughput metrics, and DLQ management.

## Project Structure
```
├── backend/       # Express/Fastify REST API & WebSockets (TypeScript)
├── worker/        # Distributed worker fleet & scheduler daemon (TypeScript)
├── frontend/      # React + Vite + TailwindCSS dashboard
├── shared/        # Shared DTOs, contracts, and type definitions
├── docs/          # Architecture diagrams, ER diagrams, API specs, Design Decisions
└── tests/         # Unit, integration, and concurrency stress tests
```
