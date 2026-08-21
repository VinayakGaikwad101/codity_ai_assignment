# Production Distributed Job Scheduler Platform

A production-inspired, highly scalable, and fault-tolerant distributed job scheduling platform capable of reliably executing asynchronous background jobs across multiple concurrent workers.

---

## 1. Key System Capabilities

- **Atomic Job Claiming**: Non-blocking atomic job acquisition via PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` (zero race conditions, zero duplicate claims across concurrent workers).
- **Multi-Tenant Projects & Queues**: Projects own isolated queues with custom priority weighting (0-100), concurrency limits, rate limiting, and instant Pause / Resume controls.
- **Rich Job Ingress**: Supports Immediate, Delayed (`delayMs`), Scheduled (`runAt`), Recurring (`cron`), Batch parent-child jobs, and DAG Workflow dependencies (`dependsOnJobIds`).
- **Resilient Worker Fleet**: Autonomous worker processes with bounded concurrency slot pools, live heartbeat telemetry (CPU/Memory/Active tasks), and dead-worker Reaper daemon for automatic orphaned job reclamation.
- **Configurable Retry Policies**: Full Jitter Exponential Backoff, Linear Backoff, and Fixed Delay strategies.
- **Dead Letter Queue (DLQ)**: Quarantines exhausted failures with complete error diagnostics, payload snapshots, and single-click manual replay.
- **Real-Time Observability UI**: Modern React 18 + Vite + TailwindCSS v4 dashboard with live WebSocket event streaming, execution attempt history, and streaming log inspection.
- **RBAC & Machine Auth**: Dual authentication supporting signed JWT sessions (`ADMIN`, `OPERATOR`, `VIEWER`) and cryptographically hashed Project API Keys (`djs_live_...`).

---

## 2. Directory Structure

```
├── backend/       # Express REST API Server & WebSocket Hub (TypeScript)
├── worker/        # Autonomous Distributed Worker Fleet & Scheduler Daemons (TypeScript)
├── frontend/      # React 18 + Vite + TailwindCSS v4 Web Dashboard
├── shared/        # Shared Domain Enums, Models, DTOs, and Zod Schemas
├── tests/         # Automated Unit, Concurrency Race Condition, and Integration Tests
├── docs/          # Architecture Diagrams, ER Diagrams, API Specs, and Design Decisions
└── docker-compose.yml # PostgreSQL 16 local environment
```

---

## 3. Quickstart & Local Setup Instructions

### Prerequisites
- **Node.js**: v18.0+ (Tested on v22.11.0)
- **Docker Desktop**: For running local PostgreSQL 16 (or an existing PostgreSQL instance on port 5433 / 5432)

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/VinayakGaikwad101/codity-ai-assignment.git
cd codity-ai-assignment

# Install all workspace dependencies
npm install
```

### Step 2: Start PostgreSQL Database
```bash
# Starts PostgreSQL 16 on port 5433
docker compose up -d
```

### Step 3: Run Database Migrations & Seeder
```bash
# Push Prisma schema to PostgreSQL
npm run prisma:push --workspace=backend

# Seed database with sample organization, RBAC users, queues, and cron triggers
npm run prisma:seed --workspace=backend
```

### Step 4: Start All Services

Open three terminal windows (or run in background):

**Terminal 1 (Backend API & WebSocket Server):**
```bash
npm run dev:backend
# API running on http://localhost:4000
# WebSocket listening on ws://localhost:4000/ws
```

**Terminal 2 (Distributed Worker Fleet):**
```bash
npm run dev:worker
# Worker process initialized and polling with SKIP LOCKED
```

**Terminal 3 (React Dashboard):**
```bash
npm run dev:frontend
# Dashboard running on http://localhost:3000
```

---

## 4. Default Seeded Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@acme.com` | `Admin@12345` |
| **Operator** | `operator@acme.com` | `Operator@12345` |
| **Viewer** | `viewer@acme.com` | `Viewer@12345` |
| **Sample API Key** | `djs_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d` | Project Scoped |

---

## 5. Running Automated Tests

Run the complete test suite (Unit, Concurrency Stress, and Integration):
```bash
# Run Vitest test runner
npx vitest run
```

### Test Coverage Highlights:
- **Unit Tests**: Delay arithmetic for exponential backoff with full jitter, linear backoff, and cron schedule parsing.
- **Concurrency Stress Tests**: 5 concurrent worker processes contending for 50 jobs simultaneously in PostgreSQL to verify zero duplicate executions and zero dropped claims.
- **Integration Tests**: End-to-end job state transitions (`QUEUED` $\rightarrow$ `CLAIMED` $\rightarrow$ `RUNNING` $\rightarrow$ `COMPLETED`), simulated failure retries, and automatic Dead Letter Queue (DLQ) routing.

---

## 6. Project Documentation & Deliverables

- **[System Architecture & Data Flow](docs/ARCHITECTURE.md)**
- **[Relational Database Design & 14-Entity ER Diagram](docs/DATABASE_DESIGN.md)**
- **[Complete REST API & WebSocket Documentation](docs/API_DOCUMENTATION.md)**
- **[Design Decisions & Engineering Trade-offs](docs/DESIGN_DECISIONS.md)**
- **[Contributing & Conventional Commits Guidelines](CONTRIBUTING.md)**
