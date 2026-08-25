# Distributed Job Scheduling Platform

An enterprise-grade, high-concurrency distributed job scheduling platform built with TypeScript, Node.js, PostgreSQL 16 (using `SELECT ... FOR UPDATE SKIP LOCKED`), React 18, and Tailwind CSS.

---

## Live Production Deployment

The entire platform is deployed live and running 24/7 on an Oracle Cloud Infrastructure (OCI) Always Free VM with automated SSL encryption and process management:

- **Live Production URL**: [https://137.23.40.113.sslip.io](https://137.23.40.113.sslip.io)
- **Live REST API Endpoint**: `https://137.23.40.113.sslip.io/api/v1`
- **Live WebSocket Live Stream**: `wss://137.23.40.113.sslip.io/ws`
- **Pre-Seeded Administrator Login**:
  - **Email**: `admin@acme.com`
  - **Password**: `Admin@12345`
  - *(Or use the 1-click RBAC role selector on the login screen to test as `ADMIN`, `OPERATOR`, or `VIEWER`)*

---

## Key Capabilities & Architectural Highlights

- **Atomic High-Concurrency Worker Engine**: Multi-worker claiming with zero collisions or race conditions using row-level `FOR UPDATE SKIP LOCKED`.
- **14-Table 3NF Relational Database**: Complete multi-tenant isolation across Organizations, Projects, Queues, Jobs, Executions, and DLQ entries.
- **5 Job Ingestion Types**: Immediate, Delayed, Atomic Batch, DAG Workflow Dependencies, and Recurring Cron schedules.
- **Configurable Retry Engine with Full Jitter**: Exponential backoff, Linear backoff, Fixed delay, and Dead Letter Queue (DLQ) quarantine.
- **Real-Time WebSocket Synchronization**: Live events broadcasted to connected dashboards over `wss://137.23.40.113.sslip.io/ws`.
- **Full-Stack React + Tailwind CSS Control Plane**: Live telemetry gauges, shimmer skeleton loaders, status filter pills, and 1-click DLQ replay.
- **LangChain AI Failure Diagnostics**: Automated LLM root-cause analysis and remediation suggestions using Gemini.
- **Automated Vitest Test Suite**: Full concurrency, retry, DAG dependency, and idempotency tests passing with 100% success.

---

## Production Cloud Deployment Architecture

The live production instance is deployed on an Oracle Cloud Always Free compute VM using a decoupled, production-ready stack:

```
[ Client Browser / Microservices ]
               │
               ▼  (Port 443 / HTTPS & WSS)
    ┌────────────────────────────────────────┐
    │  Nginx Reverse Proxy & SSL (Certbot)   │
    └────┬──────────────────┬───────────┬────┘
         │ /                │ /api/v1   │ /ws
         ▼                  ▼           ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│ React 18 SPA     │  │ Express REST API & WebSocket Bus │
│ (PM2 Serve :3000)│  │ (PM2 Node.js Daemon :4000)       │
└──────────────────┘  └─────────────────┬────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────┐
│ Distributed Background Worker Engine (PM2 Daemon)      │
│ - Atomic SELECT FOR UPDATE SKIP LOCKED Poller          │
│ - 5s Heartbeat & Telemetry Emitter                     │
│ - Zombie Worker Node Reaper & Cron Ticker              │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL 16 Alpine (Docker Container - Port 5433)    │
│ - Persistent Volume: postgres_data                     │
│ - Auto-restart policy: always                          │
└────────────────────────────────────────────────────────┘
```

### Production Deployment Components:
1. **Compute Host**: Oracle Cloud Infrastructure `VM.Standard.A1.Flex` (Ampere ARM64, 2 OCPUs, 12 GB RAM, Ubuntu 24.04).
2. **Reverse Proxy & SSL**: Nginx with automated Let's Encrypt TLS/SSL certificates (`certbot`) and HTTP-to-HTTPS redirection on `137.23.40.113.sslip.io`.
3. **Database Engine**: PostgreSQL 16 Alpine running in a Docker container with `restart: always` and persistent volume mounts.
4. **Process Manager (PM2)**: Daemonizes and supervises the Backend API, Worker engine, and Frontend with automatic restarts upon crashes and system reboot hooks (`pm2 startup systemd`).

---

## How to Reproduce the Production Cloud Deployment

To deploy this platform onto any fresh Linux server (Ubuntu 22.04 / 24.04 on Oracle Cloud, AWS EC2, DigitalOcean, or Hetzner):

### 1. Configure Host Firewall (Ingress Ports)
Open inbound TCP traffic on ports **`80`** (HTTP), **`443`** (HTTPS), **`22`** (SSH), **`3000`** (Frontend), and **`4000`** (API) in your cloud security list and OS firewall:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 4000 -j ACCEPT
sudo netfilter-persistent save
```

### 2. Install Runtimes & Dependencies
```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-v2 curl nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
```

### 3. Clone Repository & Initialize Database
```bash
git clone https://github.com/VinayakGaikwad101/codity_ai_assignment.git
cd codity_ai_assignment

npm install
npm run build --workspace=shared
npm run build --workspace=backend
npm run build --workspace=worker
npm run build --workspace=frontend

sudo docker compose up -d
cp .env.example .env
cp .env.example backend/.env

npm run prisma:push --workspace=backend
npm run prisma:seed --workspace=backend
```

### 4. Start Services Under PM2 (24/7 Supervision)
```bash
pm2 start backend/dist/index.js --name "scheduler-backend"
pm2 start worker/dist/index.js --name "scheduler-worker"
pm2 serve frontend/dist 3000 --spa --name "scheduler-frontend"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### 5. Configure Nginx & Let's Encrypt SSL
Create `/etc/nginx/sites-available/default`:
```nginx
server {
    listen 80;
    server_name <YOUR_IP_OR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:4000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
Obtain the free SSL certificate:
```bash
sudo certbot --nginx -d <YOUR_IP_OR_DOMAIN> --non-interactive --agree-tos -m admin@example.com --redirect
```

---

## Local Development Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **Docker Desktop**: (Installed and running) or a local PostgreSQL 16 instance

---

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/VinayakGaikwad101/codity_ai_assignment.git
cd codity_ai_assignment
npm install
npm run build --workspace=shared
```

---

### 3. Start PostgreSQL Database (Docker)
Ensure Docker Desktop is open and running, then start the PostgreSQL container:
```bash
docker compose up -d
```
> **Note**: This starts PostgreSQL 16 Alpine on host port `5433:5432` with database name `job_scheduler` and credentials `postgres:postgres`.

---

### 4. Create Environment Variables (.env)
Create your `.env` files from the provided `.env.example`:

- **Windows PowerShell**:
  ```powershell
  Copy-Item .env.example .env
  Copy-Item .env.example backend\.env
  ```
- **macOS / Linux / Bash**:
  ```bash
  cp .env.example .env
  cp .env.example backend/.env
  ```

---

### 5. Initialize & Seed Database Schema
Push the Prisma schema to generate the client and seed initial multi-tenant test data:
```bash
npm run prisma:push --workspace=backend
npm run prisma:seed --workspace=backend
```

---

## Running the Platform Locally (3 Terminals)

> **Important**: Run all commands from the root `codity_ai_assignment/` directory.

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
