# Distributed Job Scheduling Platform

An enterprise-grade, high-concurrency distributed job scheduling platform built with TypeScript, Node.js, PostgreSQL 16 (using `SELECT ... FOR UPDATE SKIP LOCKED`), React 18, and Tailwind CSS.

---

## Key Capabilities & Architectural Highlights

- **Atomic High-Concurrency Worker Engine**: Multi-worker claiming with zero collisions or race conditions using row-level `FOR UPDATE SKIP LOCKED`.
- **14-Table 3NF Relational Database**: Complete multi-tenant isolation across Organizations, Projects, Queues, Jobs, Executions, and DLQ entries.
- **5 Job Ingestion Types**: Immediate, Delayed, Atomic Batch, DAG Workflow Dependencies, and Recurring Cron schedules.
- **Configurable Retry Engine with Full Jitter**: Exponential backoff, Linear backoff, Fixed delay, and Dead Letter Queue (DLQ) quarantine.
- **Real-Time WebSocket Synchronization**: Live events broadcasted to connected dashboards over `ws://localhost:4000/ws`.
- **Full-Stack React + Tailwind CSS Control Plane**: Live telemetry gauges, shimmer skeleton loaders, status filter pills, and 1-click DLQ replay.
- **LangChain AI Failure Diagnostics**: Automated LLM root-cause analysis and remediation suggestions using Gemini.
- **Automated Vitest Test Suite**: Full concurrency, retry, DAG dependency, and idempotency tests passing with 100% success.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL 16**: (Local installation or Docker container running on port `5433` or `5432`)

### 2. Install All Monorepo Dependencies
```bash
npm install
```

### 3. Setup PostgreSQL Database
Ensure your `.env` contains your database connection string:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/job_scheduler?schema=public"
JWT_SECRET="super-secret-jwt-key-for-distributed-scheduler-2026"
GEMINI_API_KEY="your_api_key_here"
GEMINI_MODEL="gemini-3.1-flash-lite"
PORT=4000
NODE_ENV=development
```

Push the database schema and seed demo data:
```bash
npm run prisma:push --workspace=backend
npm run prisma:seed --workspace=backend
```

---

## Running the Platform (3 Terminals)

### Terminal 1: Backend REST API & WebSocket Server
```bash
npm run dev:backend
```
- API Base URL: `http://localhost:4000/api/v1`
- WebSocket Live Stream: `ws://localhost:4000/ws`

### Terminal 2: Distributed Background Worker Engine
```bash
npm run dev:worker
```
- Starts atomic poller, cron ticker, and zombie node reaper.

### Terminal 3: React + Tailwind CSS Dashboard UI
```bash
npm run dev:frontend
```
- Dashboard URL: `http://localhost:3000`

---

## Running Automated Tests
```bash
npx vitest run
```
Executes all integration tests:
1. `tests/src/concurrency.test.ts` (Parallel worker race condition & atomic lock test)
2. `tests/src/retry-dlq.test.ts` (Exponential retry exhaustion & DLQ quarantine test)
3. `tests/src/dag-dependency.test.ts` (Multi-stage DAG dependency unblocking test)
4. `tests/src/idempotency.test.ts` (Idempotency key deduplication test)

---

## Deliverables & Technical Documentation Index

All architectural documentation and diagrams are located in the [`docs/`](docs/) directory:

| Document | File Link | Description & Diagram Details |
| :--- | :--- | :--- |
| **System Architecture** | [docs/architecture.md](docs/architecture.md) | High-level system architecture flowchart (Client, Control Plane, PostgreSQL, and Worker Fleet) + subsystem deep dive. |
| **Database Schema & ERD** | [docs/database-schema.md](docs/database-schema.md) | Complete 14-entity 3NF Entity-Relationship Diagram (ERD), indexing strategy, foreign keys, and cascading behaviors. |
| **REST API Reference** | [docs/api-reference.md](docs/api-reference.md) | Complete documentation covering all 27 REST endpoints, request/response JSON schemas, and authentication headers. |
| **Design Decisions & Trade-offs** | [docs/design-decisions.md](docs/design-decisions.md) | Technical comparison of PostgreSQL `SKIP LOCKED` vs Redis BullMQ vs Apache Kafka, race condition elimination, and failure recovery. |
| **Interactive API Collection** | [bruno/postman_collection.json](bruno/postman_collection.json) | Exported Postman / Bruno collection for testing all endpoints. |

> **Viewing Diagrams Note**: 
> - **On GitHub**: All Mermaid architecture and ER diagrams render automatically in GitHub's web interface.
> - **In VS Code / Local Editors**: Press `Ctrl + Shift + V` (or `Cmd + Shift + V` on macOS) to open Markdown Preview and view the rendered diagrams.
