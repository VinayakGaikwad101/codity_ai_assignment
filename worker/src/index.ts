import dotenv from 'dotenv';
import { Poller, ClaimedJobRecord } from './engine/poller.js';
import { Executor } from './engine/executor.js';
import { CronScheduler } from './engine/cron-scheduler.js';
import { ZombieReaper } from './engine/reaper.js';
import { HeartbeatService } from './heartbeat/heartbeat.service.js';

dotenv.config();

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '5000', 10);
const REAPER_INTERVAL_MS = parseInt(process.env.REAPER_INTERVAL_MS || '15000', 10);

class WorkerService {
  private workerId: string = '';
  private isRunning: boolean = false;
  private isDraining: boolean = false;
  private activeJobs = new Set<string>();
  private heartbeatService = new HeartbeatService();
  private pollTimer: NodeJS.Timeout | null = null;
  private cronTimer: NodeJS.Timeout | null = null;
  private reaperTimer: NodeJS.Timeout | null = null;

  async start() {
    console.log(`[Worker] Starting distributed worker (PID: ${process.pid}, Concurrency: ${CONCURRENCY})...`);

    // 1. Register with Fleet
    this.workerId = await this.heartbeatService.registerWorker(CONCURRENCY);
    console.log(`[Worker] Registered in database with Node ID: ${this.workerId}`);

    // 2. Start Heartbeat Telemetry
    this.heartbeatService.startHeartbeat(() => this.activeJobs.size, HEARTBEAT_INTERVAL_MS);

    this.isRunning = true;

    // 3. Start Polling Loop
    this.scheduleNextPoll(0);

    // 4. Start Cron Scheduler Loop (every 5 seconds)
    this.cronTimer = setInterval(async () => {
      if (!this.isRunning || this.isDraining) return;
      try {
        const spawned = await CronScheduler.tick();
        if (spawned > 0) {
          console.log(`[Cron] Spawned ${spawned} recurring job(s) into queue`);
        }
      } catch (err) {
        console.error('[Cron Error]:', err);
      }
    }, 5000);

    // 5. Start Zombie Reaper Loop
    this.reaperTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        const recovered = await ZombieReaper.reapDeadWorkers();
        if (recovered > 0) {
          console.log(`[Reaper] Recovered ${recovered} orphaned job(s) from offline workers`);
        }
      } catch (err) {
        console.error('[Reaper Error]:', err);
      }
    }, REAPER_INTERVAL_MS);

    // 6. Hook Process Termination Signals for Graceful Shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));

    console.log(`[Worker Engine] Ready and polling for jobs using SELECT ... FOR UPDATE SKIP LOCKED`);
  }

  private scheduleNextPoll(delayMs = POLL_INTERVAL_MS) {
    if (!this.isRunning || this.isDraining) return;

    this.pollTimer = setTimeout(async () => {
      await this.pollAndDispatch();
      this.scheduleNextPoll();
    }, delayMs);
  }

  private async pollAndDispatch() {
    const availableSlots = CONCURRENCY - this.activeJobs.size;
    if (availableSlots <= 0) {
      return;
    }

    try {
      const claimedJobs = await Poller.claimJobs(this.workerId, availableSlots);

      for (const job of claimedJobs) {
        this.activeJobs.add(job.id);
        console.log(`[Worker] Claimed job ${job.name} (${job.id}) from queue [${job.queueId}]`);

        // Execute asynchronously without blocking the poller loop
        this.runJob(job);
      }
    } catch (err) {
      console.error('[Poller Error]:', err);
    }
  }

  private async runJob(job: ClaimedJobRecord) {
    try {
      await Executor.execute(job, this.workerId);
    } catch (err) {
      console.error(`[Executor Error for job ${job.id}]:`, err);
    } finally {
      this.activeJobs.delete(job.id);
      console.log(`[Worker] Finished processing job ${job.id} (Active slots: ${this.activeJobs.size}/${CONCURRENCY})`);
    }
  }

  async shutdown(signal: string) {
    if (this.isDraining) return;
    console.log(`\n[Worker] Received ${signal}. Initiating graceful shutdown...`);

    this.isDraining = true;
    this.isRunning = false;

    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.cronTimer) clearInterval(this.cronTimer);
    if (this.reaperTimer) clearInterval(this.reaperTimer);

    await this.heartbeatService.setDraining();

    // Wait for in-flight active jobs to complete
    const drainTimeout = 30000;
    const startDrain = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startDrain < drainTimeout) {
      console.log(`[Worker] Draining ${this.activeJobs.size} in-flight active job(s)...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    await this.heartbeatService.setOffline();
    console.log('[Worker] Graceful shutdown complete. Exiting process.');
    process.exit(0);
  }
}

const worker = new WorkerService();
worker.start().catch((err) => {
  console.error('[Worker Boot Failure]:', err);
  process.exit(1);
});
