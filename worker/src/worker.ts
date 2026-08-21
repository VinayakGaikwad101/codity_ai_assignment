import { workerConfig } from './config/worker.env.js';
import { JobPoller } from './engine/poller.js';
import { JobExecutor } from './engine/executor.js';
import { HeartbeatManager } from './engine/heartbeat.js';
import { ReaperDaemon } from './engine/reaper.js';
import { CronRunner } from './engine/cron.runner.js';

export class WorkerProcess {
  private workerId: string = '';
  private isRunning: boolean = false;
  private isStopping: boolean = false;
  private inFlightJobs: Set<Promise<void>> = new Set();
  private pollTimeout: NodeJS.Timeout | null = null;

  private heartbeatManager: HeartbeatManager;
  private reaperDaemon: ReaperDaemon;
  private cronRunner: CronRunner;

  constructor() {
    this.heartbeatManager = new HeartbeatManager(
      workerConfig.WORKER_HOSTNAME,
      workerConfig.WORKER_CONCURRENCY,
      workerConfig.WORKER_HEARTBEAT_INTERVAL_MS,
      () => this.inFlightJobs.size
    );

    this.reaperDaemon = new ReaperDaemon(
      workerConfig.WORKER_REAPER_INTERVAL_MS,
      workerConfig.WORKER_STALE_THRESHOLD_MS
    );

    this.cronRunner = new CronRunner(workerConfig.CRON_POLL_INTERVAL_MS);
  }

  async start(): Promise<void> {
    console.log(`[Worker] Initializing worker process on host "${workerConfig.WORKER_HOSTNAME}"...`);

    // 1. Register worker in DB
    this.workerId = await this.heartbeatManager.registerWorker();
    console.log(`[Worker] Successfully registered with ID: ${this.workerId}`);

    // 2. Start heartbeats, reaper, and cron runner
    this.heartbeatManager.startHeartbeat(this.workerId);
    this.reaperDaemon.start();
    this.cronRunner.start();

    this.isRunning = true;
    console.log(`[Worker] Started polling with concurrency limit of ${workerConfig.WORKER_CONCURRENCY} jobs.`);

    // 3. Begin main polling loop
    this.scheduleNextPoll(0);
  }

  private scheduleNextPoll(delayMs = workerConfig.WORKER_POLL_INTERVAL_MS): void {
    if (!this.isRunning || this.isStopping) return;

    this.pollTimeout = setTimeout(async () => {
      await this.pollAndExecute();
      this.scheduleNextPoll();
    }, delayMs);
  }

  private async pollAndExecute(): Promise<void> {
    if (this.isStopping) return;

    const availableSlots = workerConfig.WORKER_CONCURRENCY - this.inFlightJobs.size;
    if (availableSlots <= 0) {
      return; // Full capacity
    }

    try {
      const claimedJobs = await JobPoller.claimJobs(this.workerId, availableSlots);

      if (claimedJobs.length > 0) {
        console.log(`[Worker] Atomically claimed ${claimedJobs.length} job(s). In-flight: ${this.inFlightJobs.size + claimedJobs.length}/${workerConfig.WORKER_CONCURRENCY}`);

        for (const job of claimedJobs) {
          const jobPromise = JobExecutor.executeJob(this.workerId, job)
            .catch((err) => {
              console.error(`[Worker] Unhandled error executing job ${job.id}:`, err);
            })
            .finally(() => {
              this.inFlightJobs.delete(jobPromise);
            });

          this.inFlightJobs.add(jobPromise);
        }
      }
    } catch (error) {
      console.error('[Worker] Polling loop iteration failed:', error);
    }
  }

  async stop(signal: string): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;
    this.isRunning = false;

    console.log(`[Worker] Received ${signal}. Initiating graceful shutdown...`);

    // Clear polling timer
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Stop cron and reaper
    this.cronRunner.stop();
    this.reaperDaemon.stop();

    // Drain in-flight jobs with timeout
    if (this.inFlightJobs.size > 0) {
      console.log(`[Worker] Draining ${this.inFlightJobs.size} in-flight job(s) (Timeout: ${workerConfig.DRAIN_TIMEOUT_MS}ms)...`);
      
      const drainPromise = Promise.all(Array.from(this.inFlightJobs));
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => {
          console.warn('[Worker] Drain timeout reached. Forcefully terminating remaining in-flight jobs.');
          resolve(null);
        }, workerConfig.DRAIN_TIMEOUT_MS)
      );

      await Promise.race([drainPromise, timeoutPromise]);
    }

    // Deregister worker and stop heartbeats
    await this.heartbeatManager.stopHeartbeat();

    console.log('[Worker] Graceful shutdown complete. Exiting.');
    process.exit(0);
  }
}
