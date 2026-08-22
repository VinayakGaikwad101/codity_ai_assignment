# Distributed Job Scheduling Platform

An enterprise-grade, high-concurrency distributed job scheduling platform built with TypeScript, Node.js, PostgreSQL 16 (using `SELECT ... FOR UPDATE SKIP LOCKED`), React 18, and Tailwind CSS.

---

## 🌟 Key Capabilities & Architectural Highlights

- **Atomic High-Concurrency Worker Engine**: Multi-worker claiming with zero collisions or race conditions using row-level `FOR UPDATE SKIP LOCKED`.
- **14-Table 3NF Relational Database**: Complete multi-tenant isolation across Organizations, Projects, Queues, Jobs, Executions, and DLQ entries.
- **5 Job Ingestion Types**: Immediate, Delayed, Atomic Batch, DAG Workflow Dependencies, and Recurring Cron schedules.
- **Configurable Retry Engine with Full Jitter**: Exponential backoff, Linear backoff, Fixed delay, and Dead Letter Queue (DLQ) quarantine.
- **Real-Time WebSocket Synchronization**: Live events broadcasted to connected dashboards over `ws://localhost:4000/ws`.
- **Full-Stack React + Tailwind CSS Control Plane**: Live telemetry gauges, shimmer skeleton loaders, status filter pills, and 1-click DLQ replay.
- **Automated Vitest Test Suite**: Full concurrency, retry, DAG dependency, and idempotency tests passing with 100% success.

---

## 🚀 Quick Start Guide

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
JWT_SECRET="super_secure_enterprise_jwt_secret_key_2026_distributed_job_scheduler_acme"
PORT=4000
NODE_ENV=development
```

Push the database schema and seed demo data:
```bash
npm run prisma:push --workspace=backend
npm run prisma:seed --workspace=backend
```

---

## 🏃‍♂️ Running the Platform (3 Terminals)

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

## 🧪 Running Automated Tests
```bash
npx vitest run
```
Executes all integration tests:
1. `tests/src/concurrency.test.ts` (Parallel worker race condition & atomic lock test)
2. `tests/src/retry-dlq.test.ts` (Exponential retry exhaustion & DLQ quarantine test)
3. `tests/src/dag-dependency.test.ts` (Multi-stage DAG dependency unblocking test)
4. `tests/src/idempotency.test.ts` (Idempotency key deduplication test)

---

## 📚 Deliverables & Documentation Index

- **[System Architecture Document & Mermaid Diagram](docs/architecture.md)**
- **[14-Table 3NF Database Schema & ER Diagram](docs/database-schema.md)**
- **[REST API Reference & Contract Specification](docs/api-reference.md)**
- **[Design Decisions & Architectural Trade-offs](docs/design-decisions.md)**
- **[Bruno / Postman API Collection](bruno/postman_collection.json)**
